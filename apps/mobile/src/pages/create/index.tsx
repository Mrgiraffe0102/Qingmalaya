import { useEffect, useState, useRef, type CSSProperties } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import AppLayout from '../../components/AppLayout'
import ReasonModal from '../../components/ReasonModal'
import { useAuthRedirect } from '../../utils/route-guard'
import { useAuthStore } from '../../store/auth'
import { usePlayerStore } from '../../store/player'
import { useIsDesktop } from '../../components/AppLayout/useIsDesktop'
import { get, del, put, post } from '../../utils/request'
import { coverUrl, formatCount, formatRelativeTime } from '../../utils/format'
import { playPodcast } from '../../utils/play'
import {
  COMMON_REJECT_REASONS,
  type PodcastWithRelations,
  type PodcastStatus,
  type Paginated,
  type FlaggedPodcastItem,
  type ReportedCommentItem,
  type ReviewAssignment,
  type ManagedClass,
} from '@qingmalaya/shared'

/**
 * Creation / Review page.
 *
 * Three modes based on the current user:
 * - Student (non-admin): lists own podcasts (any status), newest first.
 * - Student admin: shows "待审核" section (review queue from /student-review)
 *   with approve/flag/reject actions, then "我的创作" section below.
 * - Teacher: shows four sections — "存疑播客", "被举报评论", "待审核", "已发布"
 *   — filtered to the teacher's managed classes.
 */

const STATUS_SPEC: Record<
  PodcastStatus,
  { label: string; bg: string; text: string }
> = {
  PENDING: { label: '审核中', bg: '#f59e0b', text: '#ffffff' },
  PUBLISHED: { label: '已发布', bg: '#2f8f5e', text: '#ffffff' },
  TAKEN_DOWN: { label: '已下架', bg: '#ba1a1a', text: '#ffffff' },
  FLAGGED: { label: '存疑', bg: '#8b5a2b', text: '#ffffff' },
}

const CARD_STYLE: CSSProperties = {
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
  border: '1px solid rgba(114, 120, 121, 0.10)',
}

export default function Create() {
  const ok = useAuthRedirect()
  const isDesktop = useIsDesktop()
  const hasPodcast = usePlayerStore((s) => s.currentPodcast !== null)
  const { user } = useAuthStore()
  const isTeacher = user?.role === 'TEACHER'
  const isStudentAdmin = user?.isStudentAdmin === true && user?.role === 'STUDENT'

  // --- Student admin state ---
  const [assignment, setAssignment] = useState<ReviewAssignment | null>(null)
  const [reviewQueue, setReviewQueue] = useState<PodcastWithRelations[]>([])

  // --- Teacher state ---
  const [flagged, setFlagged] = useState<FlaggedPodcastItem[]>([])
  const [reported, setReported] = useState<ReportedCommentItem[]>([])
  const [pending, setPending] = useState<PodcastWithRelations[]>([])
  const [published, setPublished] = useState<PodcastWithRelations[]>([])

  // --- Student (non-admin) state ---
  const [myPodcasts, setMyPodcasts] = useState<PodcastWithRelations[]>([])

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // --- ReasonModal state ---
  const [reasonModalVisible, setReasonModalVisible] = useState(false)
  const [reasonModalMode, setReasonModalMode] = useState<'flag' | 'reject' | 'teacherReject'>('flag')
  const [reasonModalPodcastId, setReasonModalPodcastId] = useState<number | null>(null)
  const [reasonTags, setReasonTags] = useState<number[]>([])
  const [reasonText, setReasonText] = useState('')

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
      if (isStudentAdmin) {
        const [assignmentRes, queueRes, myRes] = await Promise.all([
          get<ReviewAssignment>('/student-review/assignment'),
          get<PodcastWithRelations[]>('/student-review/queue'),
          get<PodcastWithRelations[]>('/users/me/podcasts'),
        ])
        setAssignment(assignmentRes)
        setReviewQueue(queueRes)
        setMyPodcasts(myRes)
      } else if (isTeacher) {
        // Fetch managed classes first
        const managed = await get<{ manageAllClasses: boolean; classes: ManagedClass[] }>(
          '/admin/me/managed-classes',
        )
        const classIds = managed.manageAllClasses || managed.classes.length === 0
          ? undefined
          : managed.classes.map((c) => c.id)
        const classParam = classIds ? `&classIds=${classIds.join(',')}` : ''

        const [flaggedRes, reportedRes, pendingRes, publishedRes] = await Promise.all([
          get<FlaggedPodcastItem[]>(`/admin/podcasts/flagged${classParam ? `?classIds=${classIds!.join(',')}` : ''}`),
          get<ReportedCommentItem[]>(`/admin/comments/reported${classParam ? `?classIds=${classIds!.join(',')}` : ''}`),
          get<Paginated<PodcastWithRelations>>(`/admin/podcasts?status=PENDING&pageSize=50${classParam}`),
          get<Paginated<PodcastWithRelations>>(`/admin/podcasts?status=PUBLISHED&pageSize=50${classParam}`),
        ])
        setFlagged(flaggedRes)
        setReported(reportedRes)
        setPending(pendingRes.items)
        setPublished(publishedRes.items)
      } else {
        const data = await get<PodcastWithRelations[]>('/users/me/podcasts')
        setMyPodcasts(data)
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
      fail: () => {},
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
      setMyPodcasts((prev) => prev.filter((p) => p.id !== podcast.id))
      Taro.showToast({ title: '已删除', icon: 'success' })
    } catch {}
  }

  // --- Student admin review actions ---
  async function onStudentApprove(podcast: PodcastWithRelations): Promise<void> {
    const confirmed = await new Promise<boolean>((resolve) => {
      Taro.showModal({
        title: '确认通过',
        content: `确定通过《${podcast.title}》的审核吗？`,
        confirmText: '通过',
        cancelText: '取消',
        success: (res) => resolve(res.confirm),
        fail: () => resolve(false),
      })
    })
    if (!confirmed) return

    try {
      await post(`/student-review/${podcast.id}/review`, { action: 'APPROVE' })
      setReviewQueue((prev) => prev.filter((p) => p.id !== podcast.id))
      Taro.showToast({ title: '已通过', icon: 'success' })
    } catch {}
  }

  function openFlagModal(podcast: PodcastWithRelations): void {
    setReasonModalMode('flag')
    setReasonModalPodcastId(podcast.id)
    setReasonTags([])
    setReasonText('')
    setReasonModalVisible(true)
  }

  function openRejectModal(podcast: PodcastWithRelations, mode: 'reject' | 'teacherReject'): void {
    setReasonModalMode(mode)
    setReasonModalPodcastId(podcast.id)
    setReasonTags([])
    setReasonText('')
    setReasonModalVisible(true)
  }

  async function handleReasonConfirm(): Promise<void> {
    if (reasonModalPodcastId === null) return

    try {
      if (reasonModalMode === 'flag') {
        await post(`/student-review/${reasonModalPodcastId}/review`, {
          action: 'FLAG',
          reason: reasonText.trim(),
        })
        setReviewQueue((prev) => prev.filter((p) => p.id !== reasonModalPodcastId))
        Taro.showToast({ title: '已标记存疑', icon: 'success' })
      } else if (reasonModalMode === 'reject') {
        await post(`/student-review/${reasonModalPodcastId}/review`, {
          action: 'REJECT',
          reasonTags: reasonTags.length > 0 ? reasonTags : undefined,
          reason: reasonText.trim() || undefined,
        })
        setReviewQueue((prev) => prev.filter((p) => p.id !== reasonModalPodcastId))
        Taro.showToast({ title: '已驳回', icon: 'success' })
      } else if (reasonModalMode === 'teacherReject') {
        await put(`/admin/podcasts/${reasonModalPodcastId}/reject`, {
          reasonTags: reasonTags.length > 0 ? reasonTags : undefined,
          reason: reasonText.trim() || undefined,
        })
        setFlagged((prev) => prev.filter((p) => p.id !== reasonModalPodcastId))
        setPending((prev) => prev.filter((p) => p.id !== reasonModalPodcastId))
        Taro.showToast({ title: '已驳回', icon: 'success' })
      }
      setReasonModalVisible(false)
    } catch {}
  }

  // --- Teacher review actions ---
  async function onTeacherApprove(podcast: PodcastWithRelations): Promise<void> {
    const confirmed = await new Promise<boolean>((resolve) => {
      Taro.showModal({
        title: '确认通过',
        content: `确定通过《${podcast.title}》的审核吗？`,
        confirmText: '通过',
        cancelText: '取消',
        success: (res) => resolve(res.confirm),
        fail: () => resolve(false),
      })
    })
    if (!confirmed) return

    try {
      await put(`/admin/podcasts/${podcast.id}/publish`)
      setPending((prev) => prev.filter((p) => p.id !== podcast.id))
      setFlagged((prev) => prev.filter((p) => p.id !== podcast.id))
      Taro.showToast({ title: '已通过', icon: 'success' })
    } catch {}
  }

  async function onResolveReport(
    commentId: number,
    action: 'delete' | 'dismiss',
  ): Promise<void> {
    const confirmed = await new Promise<boolean>((resolve) => {
      Taro.showModal({
        title: action === 'delete' ? '确认删除评论' : '确认忽略举报',
        content:
          action === 'delete'
            ? '确认删除该评论并解除举报？'
            : '确认忽略该举报？',
        confirmText: action === 'delete' ? '删除' : '忽略',
        confirmColor: action === 'delete' ? '#ba1a1a' : '#4d6265',
        cancelText: '取消',
        success: (res) => resolve(res.confirm),
        fail: () => resolve(false),
      })
    })
    if (!confirmed) return

    try {
      await put(`/admin/comments/${commentId}/report/resolve`, { action })
      setReported((prev) =>
        prev.filter((r) => r.comment.id !== commentId),
      )
      Taro.showToast({ title: action === 'delete' ? '已删除' : '已忽略', icon: 'success' })
    } catch {}
  }

  if (!ok || !user) return null

  // Determine what to render based on mode
  const hasContent =
    isStudentAdmin
      ? reviewQueue.length > 0 || myPodcasts.length > 0 || !!assignment
      : isTeacher
        ? flagged.length > 0 || reported.length > 0 || pending.length > 0 || published.length > 0
        : myPodcasts.length > 0

  const headerTitle = isTeacher ? '审核' : isStudentAdmin ? '审核 / 创作' : '我的创作'
  const headerCount =
    isStudentAdmin
      ? reviewQueue.length > 0
        ? `${reviewQueue.length} 待审核`
        : myPodcasts.length > 0
          ? `${myPodcasts.length} 期`
          : ''
      : isTeacher
        ? pending.length + flagged.length > 0
          ? `${pending.length + flagged.length} 待处理`
          : ''
        : myPodcasts.length > 0
          ? `${myPodcasts.length} 期`
          : ''

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
              {headerTitle}
            </Text>
            <Text className='text-xs text-on-surface-variant'>
              {headerCount}
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
          ) : !hasContent ? (
            isTeacher || isStudentAdmin ? (
              <ReviewEmptyState />
            ) : (
              <EmptyState onUpload={() => goToUpload()} />
            )
          ) : (
            <View className='px-4 pb-6 pt-4'>
              {/* ===== Student admin mode ===== */}
              {isStudentAdmin && (
                <>
                  {assignment && (
                    <View
                      className='mb-4 rounded-xl bg-secondary-container p-3'
                      style={CARD_STYLE}
                    >
                      <Text className='text-sm font-semibold text-on-secondary-container'>
                        审核范围
                      </Text>
                      <Text className='mt-1 block text-xs text-on-secondary-container/80'>
                        {assignment.summary}
                      </Text>
                      <Text className='mt-1 block text-xs text-on-secondary-container/80'>
                        另可举报所有播客下属的评论，被举报的评论将推送给老师处理
                      </Text>
                    </View>
                  )}
                  <SectionHeader title='待审核' count={reviewQueue.length} />
                  {reviewQueue.length === 0 ? (
                    <View className='mb-6 flex items-center justify-center py-8'>
                      <Text className='text-sm text-on-surface-variant'>暂无待审核的播客</Text>
                    </View>
                  ) : (
                    <View className='mb-6 grid grid-cols-1 gap-3 md:grid-cols-2'>
                      {reviewQueue.map((p) => (
                        <ReviewCard
                          key={p.id}
                          podcast={p}
                          onApprove={() => void onStudentApprove(p)}
                          onFlag={() => openFlagModal(p)}
                          onReject={() => openRejectModal(p, 'reject')}
                          onTap={() => goToPlayback(p.id)}
                        />
                      ))}
                    </View>
                  )}
                  {myPodcasts.length > 0 && (
                    <SectionHeader title='我的创作' count={myPodcasts.length} />
                  )}
                  <View className='grid grid-cols-1 gap-3 md:grid-cols-2'>
                    {myPodcasts.map((p) => (
                      <CreationCard
                        key={p.id}
                        podcast={p}
                        onMore={() => onMore(p)}
                        onTap={() => goToPlayback(p.id)}
                      />
                    ))}
                  </View>
                </>
              )}

              {/* ===== Teacher mode ===== */}
              {isTeacher && (
                <>
                  {/* Flagged podcasts (emphasized) */}
                  {flagged.length > 0 && (
                    <>
                      <SectionHeader
                        title='存疑播客'
                        count={flagged.length}
                        emphasis
                      />
                      <View className='mb-6 grid grid-cols-1 gap-3 md:grid-cols-2'>
                        {flagged.map((p) => (
                          <ReviewCard
                            key={p.id}
                            podcast={p}
                            badgeText='存疑'
                            badgeColor='#8b5a2b'
                            flagInfo={
                              p.flagReason
                                ? { reason: p.flagReason, reviewer: p.flagReviewer?.name ?? '' }
                                : undefined
                            }
                            onApprove={() => void onTeacherApprove(p)}
                            onReject={() => openRejectModal(p, 'teacherReject')}
                            onTap={() => goToPlayback(p.id)}
                          />
                        ))}
                      </View>
                    </>
                  )}

                  {/* Reported comments (emphasized) */}
                  {reported.length > 0 && (
                    <>
                      <SectionHeader
                        title='被举报评论'
                        count={reported.length}
                        emphasis
                      />
                      <View className='mb-6 space-y-3'>
                        {reported.map((r) => (
                          <ReportedCommentCard
                            key={r.reportId}
                            report={r}
                            onDelete={() => void onResolveReport(r.comment.id, 'delete')}
                            onDismiss={() => void onResolveReport(r.comment.id, 'dismiss')}
                          />
                        ))}
                      </View>
                    </>
                  )}

                  {/* Pending podcasts */}
                  {pending.length > 0 && (
                    <SectionHeader title='待审核' count={pending.length} />
                  )}
                  <View className='mb-6 grid grid-cols-1 gap-3 md:grid-cols-2'>
                    {pending.map((p) => (
                      <ReviewCard
                        key={p.id}
                        podcast={p}
                        onApprove={() => void onTeacherApprove(p)}
                        onReject={() => openRejectModal(p, 'teacherReject')}
                        onTap={() => goToPlayback(p.id)}
                      />
                    ))}
                  </View>

                  {/* Published podcasts */}
                  {published.length > 0 && (
                    <SectionHeader title='已发布' count={published.length} />
                  )}
                  <View className='grid grid-cols-1 gap-3 md:grid-cols-2'>
                    {published.map((p) => (
                      <CreationCard
                        key={p.id}
                        podcast={p}
                        onMore={() => onMore(p)}
                        onTap={() => goToPlayback(p.id)}
                      />
                    ))}
                  </View>
                </>
              )}

              {/* ===== Student (non-admin) mode ===== */}
              {!isTeacher && !isStudentAdmin && (
                <View className='grid grid-cols-1 gap-3 md:grid-cols-2'>
                  {myPodcasts.map((p) => (
                    <CreationCard
                      key={p.id}
                      podcast={p}
                      onMore={() => onMore(p)}
                      onTap={() => goToPlayback(p.id)}
                    />
                  ))}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </View>

      {/* ReasonModal — shared by student admin flag/reject + teacher reject */}
      <ReasonModal
        visible={reasonModalVisible}
        title={
          reasonModalMode === 'flag'
            ? '标记存疑'
            : '驳回播客'
        }
        reasons={
          reasonModalMode === 'flag'
            ? undefined
            : COMMON_REJECT_REASONS
        }
        reasonTags={reasonTags}
        onReasonTagsChange={setReasonTags}
        reason={reasonText}
        onReasonChange={setReasonText}
        reasonRequired={reasonModalMode === 'flag'}
        reasonPlaceholder={
          reasonModalMode === 'flag'
            ? '请输入存疑点…'
            : '请输入驳回原因…'
        }
        onConfirm={() => void handleReasonConfirm()}
        onCancel={() => setReasonModalVisible(false)}
        confirmText={reasonModalMode === 'flag' ? '提交存疑' : '确认驳回'}
        confirmDanger={reasonModalMode !== 'flag'}
      />
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

/** Section header — large title with count badge. */
function SectionHeader({
  title,
  count,
  emphasis = false,
}: {
  title: string
  count: number
  emphasis?: boolean
}) {
  return (
    <View className='mb-3 flex items-center gap-2'>
      <Text
        className='text-lg font-bold'
        style={{ color: emphasis ? '#8b5a2b' : '#1b1c1c' }}
      >
        {title}
      </Text>
      <View
        className='flex items-center justify-center rounded-full'
        style={{
          backgroundColor: emphasis ? 'rgba(139, 90, 43, 0.12)' : 'rgba(77, 98, 101, 0.12)',
          padding: '2px 8px',
          minWidth: '20px',
        }}
      >
        <Text
          className='text-xs font-semibold'
          style={{ color: emphasis ? '#8b5a2b' : '#4d6265' }}
        >
          {count}
        </Text>
      </View>
    </View>
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

/** Teacher/student-admin review empty state — no pending podcasts to review. */
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
  onApprove?: () => void
  onFlag?: () => void
  onReject: () => void
  onTap: () => void
  badgeText?: string
  badgeColor?: string
  flagInfo?: { reason: string; reviewer: string }
}

/** Review card — shows author info + action buttons.
 *  - onApprove provided → 通过 button
 *  - onFlag provided → 存疑 button (student admin only)
 *  - Always: 驳回 button */
function ReviewCard({
  podcast,
  onApprove,
  onFlag,
  onReject,
  onTap,
  badgeText = '待审核',
  badgeColor = '#f59e0b',
  flagInfo,
}: ReviewCardProps) {
  const cover = coverUrl(podcast.coverPath)
  const authorLabel = `${podcast.author.name} · 学号 ${podcast.author.studentId}`

  return (
    <View
      className='flex gap-3 rounded-xl bg-surface-container-lowest p-3'
      style={CARD_STYLE}
    >
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
          style={{ backgroundColor: badgeColor, padding: '1px 6px' }}
        >
          <Text style={{ display: 'block', textAlign: 'center', fontSize: '10px', fontWeight: '700', color: '#ffffff', lineHeight: '14px' }}>
            {badgeText}
          </Text>
        </View>
      </View>

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
          {flagInfo && (
            <View className='mt-1 rounded-lg p-2' style={{ backgroundColor: 'rgba(139, 90, 43, 0.08)' }}>
              <Text className='block text-xs' style={{ color: '#8b5a2b' }}>
                存疑点: {flagInfo.reason}
              </Text>
              {flagInfo.reviewer && (
                <Text className='mt-0.5 block text-xs text-on-surface-variant'>
                  标记人: {flagInfo.reviewer}
                </Text>
              )}
            </View>
          )}
        </View>
        <View className='flex items-center justify-between'>
          <Text className='text-on-surface-variant' style={{ fontSize: '11px', fontWeight: '500' }}>
            {formatRelativeTime(podcast.createdAt)}
          </Text>
          <View className='flex gap-2'>
            {onApprove && (
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
            )}
            {onFlag && (
              <View
                onClick={(e) => {
                  e.stopPropagation?.()
                  onFlag()
                }}
                className='flex items-center gap-1 rounded-full active:scale-95'
                style={{ backgroundColor: 'rgba(139, 90, 43, 0.12)', padding: '4px 12px', transition: 'transform 0.2s' }}
              >
                <Icon name='help' style={{ fontSize: '14px', color: '#8b5a2b' }} />
                <Text style={{ fontSize: '12px', fontWeight: '600', color: '#8b5a2b' }}>存疑</Text>
              </View>
            )}
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

/** Reported comment card — shows reporter, reason, comment content, resolve buttons. */
function ReportedCommentCard({
  report,
  onDelete,
  onDismiss,
}: {
  report: ReportedCommentItem
  onDelete: () => void
  onDismiss: () => void
}) {
  return (
    <View
      className='rounded-xl bg-surface-container-lowest p-3'
      style={CARD_STYLE}
    >
      <View className='flex items-center justify-between'>
        <View className='flex items-center gap-2'>
          <View
            className='rounded-full'
            style={{ backgroundColor: 'rgba(139, 90, 43, 0.12)', padding: '2px 8px' }}
          >
            <Text style={{ fontSize: '10px', fontWeight: '700', color: '#8b5a2b' }}>
              举报
            </Text>
          </View>
          <Text className='text-xs text-on-surface-variant'>
            {report.reporter.name} · {formatRelativeTime(report.createdAt)}
          </Text>
        </View>
      </View>

      <Text className='mt-2 block text-sm' style={{ color: '#8b5a2b' }}>
        原因: {report.reason}
      </Text>

      <View className='mt-2 rounded-lg bg-surface-container p-2'>
        <View className='flex items-center gap-2'>
          <Text className='text-xs font-medium text-on-surface'>
            {report.comment.user.name}
          </Text>
          <Text className='text-xs text-on-surface-variant'>
            《{report.comment.podcast.title}》
          </Text>
        </View>
        <Text className='mt-1 block text-sm text-on-surface-variant'>
          {report.comment.content}
        </Text>
      </View>

      <View className='mt-3 flex justify-end gap-2'>
        <View
          onClick={onDismiss}
          className='flex items-center rounded-full active:scale-95'
          style={{ backgroundColor: 'rgba(114, 120, 121, 0.12)', padding: '4px 16px', transition: 'transform 0.2s' }}
        >
          <Text style={{ fontSize: '12px', fontWeight: '600', color: '#4d6265' }}>忽略</Text>
        </View>
        <View
          onClick={onDelete}
          className='flex items-center rounded-full active:scale-95'
          style={{ backgroundColor: 'rgba(186, 26, 26, 0.10)', padding: '4px 16px', transition: 'transform 0.2s' }}
        >
          <Text style={{ fontSize: '12px', fontWeight: '600', color: '#ba1a1a' }}>删除</Text>
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
