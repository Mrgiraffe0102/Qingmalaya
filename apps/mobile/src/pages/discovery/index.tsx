import { useEffect, useState, useRef, type CSSProperties } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import AppLayout from '../../components/AppLayout'
import PageContainer from '../../components/AppLayout/PageContainer'
import { useAuthRedirect } from '../../utils/route-guard'
import { get } from '../../utils/request'
import { coverUrl, formatDuration, formatCount } from '../../utils/format'
import {
  BannerLinkType,
  type Banner,
  type DiscoveryResponse,
  type PodcastWithRelations,
} from '@qingmalaya/shared'

/** Number of items shown per leaderboard column. */
const HOT_TOP_N = 5

/** Subtle card spec from DESIGN.md: 1px border + soft shadow. */
const CARD_STYLE: React.CSSProperties = {
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
  border: '1px solid rgba(114, 120, 121, 0.10)',
}

/** Inline Material Symbols icon (font linked in src/index.html on H5). */
function Icon({ name, className = '', style }: { name: string; className?: string; style?: CSSProperties }) {
  return (
    <Text className={`material-symbols-outlined ${className}`} style={{ fontSize: '16px', ...style }}>
      {name}
    </Text>
  )
}

/** Navigate to the playback detail page for a podcast. */
function goToPodcast(id: number): void {
  Taro.navigateTo({ url: `/pages/playback/index?id=${id}` })
}

/** Banner tap handler — routes by linkType. */
function onBannerTap(banner: Banner): void {
  if (banner.linkType === BannerLinkType.PODCAST && banner.linkTarget) {
    Taro.navigateTo({ url: `/pages/playback/index?id=${banner.linkTarget}` })
  } else if (banner.linkType === BannerLinkType.PODCAST_LIST) {
    Taro.switchTab({ url: '/pages/browse/index' })
  } else if (banner.linkType === BannerLinkType.COLLECTION && banner.linkTarget) {
    Taro.navigateTo({ url: `/pages/collection/index?id=${banner.linkTarget}` })
  } else if (banner.linkType === BannerLinkType.MARKDOWN) {
    Taro.navigateTo({ url: `/pages/markdown/index?id=${banner.id}` })
  }
  // NONE → no-op
}

/**
 * Cover image with a colored placeholder fallback for podcasts that have no
 * coverPath. The placeholder fills the same box and centers the first letter
 * of the title so the layout never collapses.
 */
interface CoverProps {
  path: string | null | undefined
  title: string
  className: string
  letterClass?: string
}

function Cover({ path, title, className, letterClass }: CoverProps) {
  const url = coverUrl(path)
  if (url) {
    return <Image src={url} className={className} mode='aspectFill' />
  }
  return (
    <View className={`${className} flex items-center justify-center bg-primary/15`}>
      <Text className={letterClass ?? 'text-on-primary-container font-semibold'}>
        {(title || '?').charAt(0)}
      </Text>
    </View>
  )
}

/** Rank badge — top ranks get the primary fill, others a muted tone. */
function RankBadge({ rank }: { rank: number }) {
  const isTop = rank === 1
  const isPodium = rank <= 3
  return (
    <Text
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
        isTop
          ? 'bg-primary text-on-primary'
          : isPodium
            ? 'bg-tertiary text-on-tertiary'
            : 'bg-surface-container-high text-on-surface-variant'
      }`}
    >
      {rank}
    </Text>
  )
}

/** Reusable section header — small primary eyebrow + optional right slot. */
interface SectionHeaderProps {
  label: string
  right?: React.ReactNode
}

function SectionHeader({ label, right }: SectionHeaderProps) {
  return (
    <View className='mb-3 flex items-center justify-between px-4'>
      <Text className='text-sm font-semibold tracking-wider text-primary'>
        {label}
      </Text>
      {right}
    </View>
  )
}

export default function Discovery() {
  const ok = useAuthRedirect()
  const [data, setData] = useState<DiscoveryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [cols, setCols] = useState(2)

  const firstShowRef = useRef(true)

  useEffect(() => {
    if (!ok) return
    fetchDiscovery()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ok])

  Taro.useDidShow(() => {
    if (firstShowRef.current) {
      firstShowRef.current = false
      return
    }
    if (!ok) return
    fetchDiscovery()
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const update = () => {
      const w = window.innerWidth
      setCols(w >= 1024 ? 4 : w >= 768 ? 3 : 2)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  async function fetchDiscovery() {
    setLoading(true)
    try {
      const res = await get<DiscoveryResponse>('/podcasts/discovery')
      setData(res)
    } catch (err) {
      console.warn('[discovery] fetch failed', err)
    } finally {
      setLoading(false)
    }
  }

  if (!ok) return null

  if (loading && !data) {
    return (
      <AppLayout currentTab='discovery'>
        <View className='flex min-h-[60vh] items-center justify-center'>
          <Text className='text-sm text-on-surface-variant'>加载中...</Text>
        </View>
      </AppLayout>
    )
  }

  const banners = data?.banners ?? []
  const byPlay = (data?.hot.byPlay ?? []).slice(0, HOT_TOP_N)
  const byLike = (data?.hot.byLike ?? []).slice(0, HOT_TOP_N)
  const byComment = (data?.hot.byComment ?? []).slice(0, HOT_TOP_N)
  const recentAll = data?.recent ?? []
  const classmates = data?.classmates ?? []

  // Trim recent uploads so the count is always a whole number of grid rows,
  // avoiding orphan cards. Target rows: 5 for 2-col, 4 for 3-col, 3 for 4-col.
  const recentRows = cols === 4 ? 3 : cols === 3 ? 4 : 5
  const recentTarget = Math.min(recentAll.length, cols * recentRows)
  const recent = recentAll.slice(0, Math.floor(recentTarget / cols) * cols)

  return (
    <AppLayout currentTab='discovery'>
      <PageContainer>
      {/* Page header */}
      <View className='px-4 pb-2 pt-4'>
        <Text className='text-xl font-bold tracking-tight text-primary'>
          清马拉雅
        </Text>
        <Text className='mt-0.5 block text-sm font-medium tracking-widest text-on-surface-variant'>
          G25 学生播客平台
        </Text>
      </View>

      {/* 16.1 Banner horizontal scroll */}
      {banners.length > 0 && (
        <View className='mb-8'>
          <ScrollView scrollX className='w-full' enhanced showScrollbar={false}>
            <View className='flex gap-3 px-4 pb-1'>
              {banners.map((b) => (
                <View
                  key={b.id}
                  onClick={() => onBannerTap(b)}
                  className='relative h-40 w-[85%] shrink-0 overflow-hidden rounded-xl bg-surface-container'
                  style={CARD_STYLE}
                >
                  <Cover
                    path={b.coverPath}
                    title={b.title}
                    className='absolute inset-0 h-full w-full'
                  />
                  <View
                    className='absolute inset-0'
                    style={{
                      background:
                        'linear-gradient(to top, rgba(77,98,101,0.85) 0%, rgba(77,98,101,0.15) 55%, transparent 100%)',
                    }}
                  />
                  <View className='absolute bottom-3 left-3 right-3'>
                    <Text className='block text-base font-semibold text-white'>
                      {b.title}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {/* 16.2 Hot podcasts — three leaderboard columns, horizontal scroll */}
      {(byPlay.length > 0 || byLike.length > 0 || byComment.length > 0) && (
        <View className='mb-8'>
          <SectionHeader label='热门播客' />
          <ScrollView scrollX className='w-full' enhanced showScrollbar={false}>
            <View className='flex gap-3 px-4 pb-1'>
              <HotColumn
                title='播放榜'
                icon='play_arrow'
                accent='primary'
                tab='play'
                items={byPlay}
                metricLabel={(p) => `${formatCount(p.playCount)} 播放`}
              />
              <HotColumn
                title='点赞榜'
                icon='thumb_up'
                accent='secondary'
                tab='like'
                items={byLike}
                metricLabel={(p) => `${formatCount(p.likeCount)} 赞`}
              />
              <HotColumn
                title='评论榜'
                icon='chat_bubble'
                accent='tertiary'
                tab='comment'
                items={byComment}
                metricLabel={(p) => `${formatCount(p.commentCount)} 评`}
              />
            </View>
          </ScrollView>
        </View>
      )}

      {/* 16.3 Recent uploads — responsive grid */}
      {recent.length > 0 && (
        <View className='mb-8'>
          <SectionHeader label='最近上传' />
          <View className='grid grid-cols-2 gap-3 px-4 md:grid-cols-3 lg:grid-cols-4'>
            {recent.map((p) => (
              <RecentCard key={p.id} podcast={p} />
            ))}
          </View>
        </View>
      )}

      {/* 16.4 Classmate creations — responsive grid */}
      {classmates.length > 0 && (
        <View className='mb-10'>
          <SectionHeader label='同班同学' />
          <View className='grid grid-cols-1 gap-2 px-4 md:grid-cols-2 lg:grid-cols-3'>
            {classmates.map((p) => (
              <ClassmateRow key={p.id} podcast={p} />
            ))}
          </View>
        </View>
      )}

      {/* Empty state when the API returned no sections at all */}
      {banners.length === 0 &&
        byPlay.length === 0 &&
        recent.length === 0 &&
        classmates.length === 0 && (
          <View className='flex min-h-[40vh] items-center justify-center px-6'>
            <Text className='text-center text-sm text-on-surface-variant'>
              暂无发现内容，稍后再来看看吧
            </Text>
          </View>
        )}
      </PageContainer>
    </AppLayout>
  )
}

/* ---------------- Sub-components ---------------- */

interface HotColumnProps {
  title: string
  icon: string
  accent: 'primary' | 'secondary' | 'tertiary'
  tab: 'play' | 'like' | 'comment'
  items: PodcastWithRelations[]
  metricLabel: (p: PodcastWithRelations) => string
}

function HotColumn({ title, icon, accent, tab, items, metricLabel }: HotColumnProps) {
  const accentText =
    accent === 'primary'
      ? 'text-primary'
      : accent === 'secondary'
        ? 'text-secondary'
        : 'text-tertiary'
  return (
    <View
      className='w-[62%] shrink-0 rounded-xl bg-surface-container-lowest p-3'
      style={CARD_STYLE}
    >
      <View className='mb-3 flex items-center justify-between'>
        <View className='flex items-center gap-1'>
          <Icon name={icon} className={accentText} style={{ fontSize: '16px' }} />
          <Text className={`text-sm font-semibold tracking-wider ${accentText}`}>
            {title}
          </Text>
        </View>
        <View
          onClick={() => Taro.navigateTo({ url: `/pages/ranking/index?tab=${tab}` })}
          className='flex items-center'
        >
          <Text className='text-xs text-on-surface-variant'>查看更多</Text>
          <Icon name='chevron_right' className='text-on-surface-variant' style={{ fontSize: '14px' }} />
        </View>
      </View>
      <View className='flex flex-col gap-3'>
        {items.map((p, idx) => (
          <View
            key={p.id}
            onClick={() => goToPodcast(p.id)}
            className='flex items-center gap-2.5 py-1'
          >
            <RankBadge rank={idx + 1} />
            <Cover
              path={p.coverPath}
              title={p.title}
              className='h-12 w-12 shrink-0 overflow-hidden rounded-md'
              letterClass='text-sm text-on-primary-container font-semibold'
            />
            <View className='min-w-0 flex-1'>
              <Text className='block truncate text-sm font-medium text-on-surface'>
                {p.title}
              </Text>
              <Text className='block truncate text-xs text-on-surface-variant'>
                {metricLabel(p)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}

function RecentCard({ podcast }: { podcast: PodcastWithRelations }) {
  return (
    <View
      onClick={() => goToPodcast(podcast.id)}
      className='relative overflow-hidden rounded-xl bg-surface-container-lowest'
      style={{ ...CARD_STYLE, height: '200px' }}
    >
      <Cover
        path={podcast.coverPath}
        title={podcast.title}
        className='absolute inset-0 h-full w-full'
        letterClass='text-5xl text-on-primary-container font-semibold'
      />
      {/*
        Gradient overlay: fully transparent through the middle-upper region,
        transitioning to opaque dark at the bottom so text stays readable.
      */}
      <View
        className='absolute inset-0'
        style={{
          background:
            'linear-gradient(to bottom, rgba(77,98,101,0) 0%, rgba(77,98,101,0) 25%, rgba(77,98,101,0.95) 100%)',
        }}
      />
      <View className='absolute bottom-0 left-0 right-0 p-2.5'>
        <Text
          className='block truncate text-base font-medium text-white'
          style={{
            lineHeight: '22px',
          }}
        >
          {podcast.title}
        </Text>
        <Text className='mt-1 block truncate text-xs text-white'>
          {podcast.author.name}
        </Text>
        <View className='mt-1 flex items-center justify-between'>
          <Text className='text-xs text-white'>
            {formatDuration(podcast.duration)}
          </Text>
          <Text className='text-xs text-white'>
            {formatCount(podcast.playCount)} 播放
          </Text>
        </View>
      </View>
    </View>
  )
}

function ClassmateRow({ podcast }: { podcast: PodcastWithRelations }) {
  return (
    <View
      onClick={() => goToPodcast(podcast.id)}
      className='flex items-center gap-3 rounded-xl bg-surface-container-lowest p-2.5'
      style={CARD_STYLE}
    >
      <Cover
        path={podcast.coverPath}
        title={podcast.title}
        className='h-14 w-14 shrink-0 overflow-hidden rounded-lg'
        letterClass='text-base text-on-primary-container font-semibold'
      />
      <View className='min-w-0 flex-1'>
        <Text className='block truncate text-sm font-medium text-on-surface'>
          {podcast.title}
        </Text>
        <Text className='mt-0.5 block truncate text-xs text-on-surface-variant'>
          {podcast.author.name}
        </Text>
        <View className='mt-1 flex items-center gap-2'>
          <Text className='rounded-full bg-tertiary-container px-2 py-0.5 text-xs font-medium text-on-tertiary-container'>
            同班同学
          </Text>
          <Text className='text-xs text-outline'>
            {formatDuration(podcast.duration)}
          </Text>
        </View>
      </View>
    </View>
  )
}
