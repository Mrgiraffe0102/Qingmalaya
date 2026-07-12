import { useEffect, useState, useRef, type CSSProperties } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import AppLayout from '../../components/AppLayout'
import { useAuthRedirect } from '../../utils/route-guard'
import { useAuthStore } from '../../store/auth'
import { usePlayerStore } from '../../store/player'
import { useIsDesktop } from '../../components/AppLayout/useIsDesktop'
import { get, del, put } from '../../utils/request'
import { coverUrl, formatCount, formatRelativeTime } from '../../utils/format'
import { playPodcast } from '../../utils/play'
import type { PodcastWithRelations, PodcastStatus, Paginated } from '@qingmalaya/shared'

/**
 * Creation / Review page.
 *
 * For students: lists every podcast authored by the current user (any
 * status), newest first. Each row shows cover, title, status badge,
 * play/like counts and a "more" (⋯) affordance for 编辑 / 删除.
 *
 * For teachers: shows pending podcasts awaiting review, with 通过 / 驳回
 * buttons on each card. Data comes from the admin podcast endpoints
 * (teachers have OPERATOR permissions via RolesGuard).
 *
 * Layout mirrors the Browse page: a viewport-height flex column with a
 * pinned header above a `ScrollView` that owns the page scroll and wires
 * `refresherEnabled` (pull-to-refresh). `rootHeight` mirrors AppLayout's
 * padding so the page fits the viewport without a double-scroll.
 */

/** Status badge spec: label + colors. Orange/green aren't design tokens, so
 *  they're inlined here; red uses the error token. */
const STATUS_SPEC: Record<
  PodcastStatus,
  { label: string; bg: string; text: string }
> = {
  PENDING: { label: '审核中', bg: '#f59e0b', text: '#ffffff' },
  PUBLISHED: { label: '已发布', bg: '#2f8f5e', text: '#ffffff' },
  TAKEN_DOWN: { label: '已下架', bg: '#ba1a1a', text: '#ffffff' },
}

/** Subtle card spec from DESIGN.md: 1px border + soft shadow. */
const CARD_STYLE: React.CSSProperties = {
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
  border: '1px solid rgba(114, 120, 121, 0.10)',
}

export default function Create() {
  const ok = useAuthRedirect()
  const isDesktop = useIsDesktop()
  const hasPodcast = usePlayerStore((s) => s.currentPodcast !== null)
  const { user } = useAuthStore()
  const isTeacher = user?.role === 'TEACHER'

  const [items, setItems] = useState<PodcastWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Desktop split layout: left column height is viewport minus top bar (56px).
  // Mobile: subtract bottom chrome (TabBar + optional PlaybackBar).
  const rootHeight = isDesktop
    ? 'calc(100vh - 56px)'
    : hasPodcast
      ? 'calc(100vh - 160px)'
      : 'calc(100vh - 96px)'

  const firstShowRef = useRef(true)

  useEffect(() => {
    if (!ok) return
    void fetchList(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ok])

  Taro.useDidShow(() => {
    if (firstShowRef.current) {
      firstShowRef.current = false
      return
    }
    if (!ok) return
    void fetchList(false)
  })

  async function fetchList(isRefresh: boolean): Promise<void> {
    if (isRefresh) setRefreshing(true)
    try {
      if (isTeacher) {
        const res = await get<Paginated<PodcastWithRelations>>(
          '/admin/podcasts?status=PENDING&pageSize=50',
        )
        setItems(res.items)
      } else {
        const data = await get<PodcastWithRelations[]>('/users/me/podcasts')
        setItems(data)
      }
    } catch {
      // request.ts surfaces a toast; leave the existing list intact.
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  function goToUpload(id?: number): void {
    const url = id
      ? `/pages/upload/index?id=${id}`
      : '/pages/upload/index'
    Taro.navigateTo({ url })
  }

  function goToPlayback(id: number): void {
    void playPodcast(id)
  }

  function onMore(podcast: PodcastWithRelations): void {
    Taro.showActionSheet({
      itemList: ['编辑', '删除'],
      itemColor: '#1b1c1c',
      success: (res) => {
        if (res.tapIndex === 0) {
          goToUpload(podcast.id)
        } else if (res.tapIndex === 1) {
          void onDelete(podcast)
        }
      },
      fail: () => {
        // user dismissed the sheet — no-op
      },
    })
  }

  async function onDelete(podcast: PodcastWithRelations): Promise<void> {
    const confirmed = await new Promise<boolean>((resolve) => {
      Taro.showModal({
        title: '确认删除',
        content: '删除后不可恢复，确定删除吗？',
        confirmText: '删除',
        confirmColor: '#ba1a1a',
        cancelText: '取消',
        success: (res) => resolve(res.confirm),
        fail: () => resolve(false),
      })
    })
    if (!confirmed) return

    try {
      await del(`/podcasts/${podcast.id}`)
      setItems((prev) => prev.filter((p) => p.id !== podcast.id))
      Taro.showToast({ title: '已删除', icon: 'success' })
    } catch {
      // request.ts already surfaced the error toast.
    }
  }

  async function onApprove(podcast: PodcastWithRelations): Promise<void> {
    try {
      await put(`/admin/podcasts/${podcast.id}/publish`)
      setItems((prev) => prev.filter((p) => p.id !== podcast.id))
      Taro.showToast({ title: '已通过', icon: 'success' })
    } catch {
      // request.ts already surfaced the error toast.
    }
  }

  async function onReject(podcast: PodcastWithRelations): Promise<void> {
    const confirmed = await new Promise<boolean>((resolve) => {
      Taro.showModal({
        title: '确认驳回',
        content: `确定驳回《${podcast.title}》吗？`,
        confirmText: '驳回',
        confirmColor: '#ba1a1a',
        cancelText: '取消',
        success: (res) => resolve(res.confirm),
        fail: () => resolve(false),
      })
    })
    if (!confirmed) return

    try {
      await put(`/admin/podcasts/${podcast.id}/takedown`)
      setItems((prev) => prev.filter((p) => p.id !== podcast.id))
      Taro.showToast({ title: '已驳回', icon: 'success' })
    } catch {
      // request.ts already surfaced the error toast.
    }
  }

  if (!ok || !user) return null

  return (
    <AppLayout currentTab='create'>
      <View
        className='mx-auto flex w-full flex-col bg-surface'
        style={{ height: rootHeight, overflow: 'hidden', maxWidth: isDesktop ? '1024px' : '768px' }}
      >
        {/* ---- Pinned header ---- */}
        <View
          className='flex-shrink-0 border-b border-outline-variant/30 bg-surface/95 px-4 pb-2 pt-4'
          style={{ backdropFilter: 'blur(12px)' }}
        >
          <View className='flex items-center justify-between'>
            <Text className='text-xl font-bold tracking-tight text-primary'>
              {isTeacher ? '审核' : '我的创作'}
            </Text>
            <Text className='text-xs text-on-surface-variant'>
              {items.length > 0
                ? isTeacher
                  ? `${items.length} 期待审核`
                  : `${items.length} 期`
                : ''}
            </Text>
          </View>
        </View>

        {/* ---- Scrollable content ---- */}
        <ScrollView
          scrollY
          refresherEnabled
          refresherTriggered={refreshing}
          onRefresherRefresh={() => void fetchList(true)}
          className='flex-1'
          style={{ minHeight: 0, height: 0 }}
        >
          {loading ? (
            <LoadingState />
          ) : items.length === 0 ? (
            isTeacher ? (
              <ReviewEmptyState />
            ) : (
              <EmptyState onUpload={() => goToUpload()} />
            )
          ) : (
            <View className='grid grid-cols-1 gap-3 px-4 pb-6 pt-4 md:grid-cols-2'>
              {items.map((p) =>
                isTeacher ? (
                  <ReviewCard
                    key={p.id}
                    podcast={p}
                    onApprove={() => void onApprove(p)}
                    onReject={() => void onReject(p)}
                    onTap={() => goToPlayback(p.id)}
                  />
                ) : (
                  <CreationCard
                    key={p.id}
                    podcast={p}
                    onMore={() => onMore(p)}
                    onTap={() => goToPlayback(p.id)}
                  />
                ),
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </AppLayout>
  )
}

/** Inline icon helper — the Material Symbols font is linked in index.html. */
function Icon({ name, className = '', style }: { name: string; className?: string; style?: CSSProperties }) {
  return (
    <Text className={`material-symbols-outlined ${className}`} style={{ fontSize: '16px', ...style }}>
      {name}
    </Text>
  )
}

interface CreationCardProps {
  podcast: PodcastWithRelations
  onMore: () => void
  onTap: () => void
}

function CreationCard({ podcast, onMore, onTap }: CreationCardProps) {
  const status = STATUS_SPEC[podcast.status] ?? STATUS_SPEC.PENDING
  const isDimmed = podcast.status !== 'PUBLISHED'
  const tagLabel = podcast.tags[0]?.name ?? '未分类'
  const cover = coverUrl(podcast.coverPath)

  return (
    <View
      className='flex gap-3 rounded-xl bg-surface-container-lowest p-3'
      style={CARD_STYLE}
    >
      {/* Cover + status badge */}
      <View
        onClick={onTap}
        className='relative h-20 w-20 flex-shrink-0'
      >
        {cover ? (
          <Image
            src={cover}
            className={`h-full w-full rounded-lg object-cover ${isDimmed ? 'opacity-60' : ''}`}
            mode='aspectFill'
          />
        ) : (
          <View
            className={`flex h-full w-full items-center justify-center rounded-lg bg-primary/15 ${isDimmed ? 'opacity-60' : ''}`}
          >
            <Text className='text-lg font-semibold text-on-primary-container'>
              {(podcast.title || '?').charAt(0)}
            </Text>
          </View>
        )}
        <View
          className='absolute left-1 top-1 rounded-full'
          style={{ backgroundColor: status.bg, padding: '1px 6px' }}
        >
          <Text style={{ display: 'block', textAlign: 'center', fontSize: '10px', fontWeight: '700', color: status.text, lineHeight: '14px' }}>
            {status.label}
          </Text>
        </View>
      </View>

      {/* Content */}
      <View className='flex min-w-0 flex-1 flex-col justify-between py-0.5'>
        <View>
          <View className='flex items-start justify-between gap-2'>
            <Text
              className='text-primary'
              style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.05em' }}
            >
              {tagLabel}
            </Text>
            <View
              onClick={(e) => {
                e.stopPropagation?.()
                onMore()
              }}
              className='-mr-1 -mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full'
              style={{ backgroundColor: 'rgba(114, 120, 121, 0.10)' }}
            >
              <Icon name='more_horiz' style={{ fontSize: '18px', color: '#424849' }} />
            </View>
          </View>
          <Text
            onClick={onTap}
            className={`mt-1 block truncate ${isDimmed ? 'text-on-surface/50' : 'text-on-surface'}`}
            style={{ fontSize: '16px', fontWeight: '600', lineHeight: '22px' }}
          >
            {podcast.title}
          </Text>
        </View>
        <View className='flex items-center gap-4 text-on-surface-variant'>
          <View className='flex items-center gap-1'>
            <Icon name='play_circle' style={{ fontSize: '15px', color: '#424849' }} />
            <Text style={{ fontSize: '12px', fontWeight: '600' }}>{formatCount(podcast.playCount)}</Text>
          </View>
          <View className='flex items-center gap-1'>
            <Icon name='favorite' style={{ fontSize: '15px', color: '#424849' }} />
            <Text style={{ fontSize: '12px', fontWeight: '600' }}>{formatCount(podcast.likeCount)}</Text>
          </View>
          <Text className='ml-auto' style={{ fontSize: '11px', fontWeight: '500' }}>
            {formatRelativeTime(podcast.createdAt)}
          </Text>
        </View>
      </View>
    </View>
  )
}

/** Centered empty state: icon-in-circle + guide text + upload button. */
function EmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <View className='flex h-full w-full flex-col items-center justify-center px-6 text-center'>
      <View className='mb-6 flex h-32 w-32 items-center justify-center'>
        <Icon name='mic' style={{ fontSize: '48px', color: '#727879' }} />
      </View>
      <Text
        className='w-full text-on-surface-variant'
        style={{ fontSize: '16px', lineHeight: '24px' }}
      >
        还没有作品，点击加号上传你的第一条播客吧
      </Text>
      <View
        onClick={onUpload}
        className='mt-6 rounded-full bg-primary text-on-primary active:scale-95'
        style={{ padding: '12px 32px', transition: 'transform 0.2s' }}
      >
        <Text style={{ fontSize: '15px', fontWeight: '600' }}>去上传</Text>
      </View>
    </View>
  )
}

/** Teacher review empty state — no pending podcasts to review. */
function ReviewEmptyState() {
  return (
    <View className='flex h-full w-full flex-col items-center justify-center px-6 text-center'>
      <View className='mb-6 flex h-32 w-32 items-center justify-center'>
        <Icon name='fact_check' style={{ fontSize: '48px', color: '#727879' }} />
      </View>
      <Text
        className='w-full text-on-surface-variant'
        style={{ fontSize: '16px', lineHeight: '24px' }}
      >
        暂无待审核的播客
      </Text>
    </View>
  )
}

interface ReviewCardProps {
  podcast: PodcastWithRelations
  onApprove: () => void
  onReject: () => void
  onTap: () => void
}

/** Teacher review card — shows author info + approve/reject buttons. */
function ReviewCard({ podcast, onApprove, onReject, onTap }: ReviewCardProps) {
  const cover = coverUrl(podcast.coverPath)
  const authorLabel = `${podcast.author.name} · 学号 ${podcast.author.studentId}`

  return (
    <View
      className='flex gap-3 rounded-xl bg-surface-container-lowest p-3'
      style={CARD_STYLE}
    >
      {/* Cover + pending badge */}
      <View
        onClick={onTap}
        className='relative h-20 w-20 flex-shrink-0'
      >
        {cover ? (
          <Image
            src={cover}
            className='h-full w-full rounded-lg object-cover'
            mode='aspectFill'
          />
        ) : (
          <View className='flex h-full w-full items-center justify-center rounded-lg bg-primary/15'>
            <Text className='text-lg font-semibold text-on-primary-container'>
              {(podcast.title || '?').charAt(0)}
            </Text>
          </View>
        )}
        <View
          className='absolute left-1 top-1 rounded-full'
          style={{ backgroundColor: '#f59e0b', padding: '1px 6px' }}
        >
          <Text style={{ display: 'block', textAlign: 'center', fontSize: '10px', fontWeight: '700', color: '#ffffff', lineHeight: '14px' }}>
            待审核
          </Text>
        </View>
      </View>

      {/* Content */}
      <View className='flex min-w-0 flex-1 flex-col justify-between py-0.5'>
        <View>
          <Text
            className='block truncate text-primary'
            style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.05em' }}
          >
            {authorLabel}
          </Text>
          <Text
            onClick={onTap}
            className='mt-1 block truncate text-on-surface'
            style={{ fontSize: '16px', fontWeight: '600', lineHeight: '22px' }}
          >
            {podcast.title}
          </Text>
        </View>
        <View className='flex items-center justify-between'>
          <Text className='text-on-surface-variant' style={{ fontSize: '11px', fontWeight: '500' }}>
            {formatRelativeTime(podcast.createdAt)}
          </Text>
          <View className='flex gap-2'>
            <View
              onClick={(e) => {
                e.stopPropagation?.()
                onApprove()
              }}
              className='flex items-center gap-1 rounded-full active:scale-95'
              style={{ backgroundColor: 'rgba(47, 143, 94, 0.12)', padding: '4px 12px', transition: 'transform 0.2s' }}
            >
              <Icon name='check' style={{ fontSize: '14px', color: '#2f8f5e' }} />
              <Text style={{ fontSize: '12px', fontWeight: '600', color: '#2f8f5e' }}>通过</Text>
            </View>
            <View
              onClick={(e) => {
                e.stopPropagation?.()
                onReject()
              }}
              className='flex items-center gap-1 rounded-full active:scale-95'
              style={{ backgroundColor: 'rgba(186, 26, 26, 0.10)', padding: '4px 12px', transition: 'transform 0.2s' }}
            >
              <Icon name='close' style={{ fontSize: '14px', color: '#ba1a1a' }} />
              <Text style={{ fontSize: '12px', fontWeight: '600', color: '#ba1a1a' }}>驳回</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  )
}

/** Initial-load placeholder rows. */
function LoadingState() {
  return (
    <View className='grid grid-cols-1 gap-3 px-4 pt-4 md:grid-cols-2'>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          className='flex gap-3 rounded-xl bg-surface-container-lowest p-3'
          style={CARD_STYLE}
        >
          <View className='h-20 w-20 flex-shrink-0 rounded-lg bg-surface-container-high' />
          <View className='flex flex-1 flex-col gap-2 py-2'>
            <View className='h-3 w-1/3 rounded-full bg-surface-container-high' />
            <View className='h-4 w-2/3 rounded-full bg-surface-container-high' />
            <View className='mt-2 h-3 w-1/2 rounded-full bg-surface-container-high' />
          </View>
        </View>
      ))}
    </View>
  )
}
