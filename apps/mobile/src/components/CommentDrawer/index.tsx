import { useEffect, useRef, useState, useCallback, type CSSProperties } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image, Input, ScrollView } from '@tarojs/components'
import ReasonModal from '../ReasonModal'
import { get, post, del } from '../../utils/request'
import { coverUrl, formatRelativeTime, formatCount } from '../../utils/format'
import { useAuthStore } from '../../store/auth'
import type { CommentWithUser, Class, Paginated } from '@qingmalaya/shared'

/**
 * Comment drawer (Task 20).
 *
 * A bottom sheet with three snap points — closed, 50% (half), and 100% (full).
 * The user drags the header handle to move between snap points. The body is a
 * paginated comment list with one level of nested replies, and a fixed input
 * bar at the bottom supports both top-level comments and replies.
 *
 * The drawer is always mounted by the parent; visibility is driven by the
 * `visible` prop which animates the height between 0 and the snap points.
 */

const PAGE_SIZE = 20

interface CommentDrawerProps {
  podcastId: number
  visible: boolean
  onClose: () => void
  commentCount: number
  onCommentDeleted: () => void
  onCommentAdded: () => void
  variant?: 'mobile' | 'desktop'
}

/** Glassmorphism spec from DESIGN.md: 20px backdrop-blur + 80% white fill. */
const GLASS_STYLE: CSSProperties = {
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  backgroundColor: 'rgba(251, 249, 248, 0.85)',
}

/** Inline Material Symbols icon helper (font linked in src/index.html on H5). */
function Icon({ name, style }: { name: string; style?: CSSProperties }) {
  return (
    <Text className='material-symbols-outlined' style={{ fontSize: '18px', ...style }}>
      {name}
    </Text>
  )
}

/** Stable hue derived from a user id for placeholder avatar backgrounds. */
function hueFor(seed: number): number {
  return (seed * 47) % 360
}

export default function CommentDrawer({
  podcastId,
  visible,
  onClose,
  commentCount,
  onCommentDeleted,
  onCommentAdded,
  variant = 'mobile',
}: CommentDrawerProps) {
  const { user } = useAuthStore()

  // --- Comment list state ---
  const [comments, setComments] = useState<CommentWithUser[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)

  // --- Input state ---
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [replyTarget, setReplyTarget] = useState<CommentWithUser | null>(null)

  // --- Class catalog (for class-name pills) ---
  const [classes, setClasses] = useState<Class[]>([])

  // --- Drawer geometry ---
  const [viewportH, setViewportH] = useState(800)
  const [height, setHeight] = useState(0)
  const [dragging, setDragging] = useState(false)
  const touchStartY = useRef(0)
  const startHeight = useRef(0)

  // Build a classId -> name lookup so we can render class pills next to names.
  const classMap = new Map<number, string>()
  classes.forEach((c) => classMap.set(c.id, c.name))

  // --- Fetch classes once on mount ---
  useEffect(() => {
    get<Class[]>('/classes', { silent: true })
      .then(setClasses)
      .catch(() => {})
  }, [])

  // --- Viewport height for snap-point math ---
  useEffect(() => {
    if (typeof window === 'undefined') return
    setViewportH(window.innerHeight)
  }, [])

  // --- Open/close animation + initial fetch ---
  useEffect(() => {
    if (visible) {
      if (variant !== 'desktop') {
        setHeight(viewportH * 0.5)
      }
      fetchComments(true)
    } else {
      if (variant !== 'desktop') {
        setHeight(0)
      }
      setReplyTarget(null)
      setInput('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  const fetchComments = useCallback(
    async (reset: boolean): Promise<void> => {
      const nextPage = reset ? 1 : page + 1
      if (reset) setLoading(true)
      else setLoadingMore(true)
      try {
        const res = await get<Paginated<CommentWithUser>>(
          `/podcasts/${podcastId}/comments?page=${nextPage}&pageSize=${PAGE_SIZE}`,
        )
        setComments((prev) => (reset ? res.items : [...prev, ...res.items]))
        setPage(nextPage)
        setHasMore(res.hasMore)
      } catch {
        // request.ts surfaces a toast; nothing else to do.
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [podcastId, page],
  )

  const loadMore = useCallback((): void => {
    if (loadingMore || loading || !hasMore) return
    void fetchComments(false)
  }, [loadingMore, loading, hasMore, fetchComments])

  // --- Drag handle touch handlers ---
  // Taro's View touch handlers are typed as CommonEventFunction (BaseEventOrig)
  // which doesn't expose `touches` at the type level. We accept `any` to satisfy
  // the handler signature and read `touches` at runtime.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onHandleTouchStart = (e: any): void => {
    const touches: Array<{ clientY: number }> | undefined = e?.touches
    if (!touches || touches.length === 0) return
    touchStartY.current = touches[0].clientY
    startHeight.current = height
    setDragging(true)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onHandleTouchMove = (e: any): void => {
    const touches: Array<{ clientY: number }> | undefined = e?.touches
    if (!touches || touches.length === 0) return
    const delta = touches[0].clientY - touchStartY.current
    const next = startHeight.current - delta
    const clamped = Math.max(0, Math.min(viewportH, next))
    setHeight(clamped)
  }

  const onHandleTouchEnd = (): void => {
    setDragging(false)
    const half = viewportH * 0.5
    const full = viewportH
    // Snap to the nearest of the three thresholds.
    if (height < viewportH * 0.25) {
      setHeight(0)
      onClose()
    } else if (height < viewportH * 0.75) {
      setHeight(half)
    } else {
      setHeight(full)
    }
  }

  // --- Send comment / reply ---
  const handleSend = async (): Promise<void> => {
    const content = input.trim()
    if (!content || sending) return
    setSending(true)
    try {
      const body: Record<string, unknown> = { content }
      if (replyTarget) body.parentId = replyTarget.id
      const created = await post<CommentWithUser>(
        `/podcasts/${podcastId}/comments`,
        body,
      )
      if (replyTarget) {
        // Append the reply to its parent's replies array.
        setComments((prev) =>
          prev.map((c) =>
            c.id === replyTarget.id
              ? { ...c, replies: [...(c.replies ?? []), created] }
              : c,
          ),
        )
      } else {
        // Prepend the new top-level comment.
        setComments((prev) => [created, ...prev])
        onCommentAdded()
      }
      setInput('')
      setReplyTarget(null)
    } catch {
      // toast handled by request.ts
    } finally {
      setSending(false)
    }
  }

  // --- Like a comment (or reply) ---
  const toggleLike = async (commentId: number, isReply: boolean, parentId?: number): Promise<void> => {
    const findComment = (list: CommentWithUser[]): CommentWithUser | undefined => {
      if (isReply) {
        for (const c of list) {
          const r = c.replies?.find((x) => x.id === commentId)
          if (r) return r
        }
      }
      return list.find((c) => c.id === commentId)
    }
    const target = findComment(comments)
    if (!target) return
    const wasLiked = !!target.liked

    // Optimistic update
    const apply = (list: CommentWithUser[]): CommentWithUser[] => {
      if (isReply && parentId != null) {
        return list.map((c) =>
          c.id === parentId
            ? {
                ...c,
                replies: c.replies?.map((r) =>
                  r.id === commentId
                    ? { ...r, liked: !wasLiked, likeCount: r.likeCount + (wasLiked ? -1 : 1) }
                    : r,
                ),
              }
            : c,
        )
      }
      return list.map((c) =>
        c.id === commentId
          ? { ...c, liked: !wasLiked, likeCount: c.likeCount + (wasLiked ? -1 : 1) }
          : c,
      )
    }
    setComments(apply)

    try {
      if (wasLiked) {
        await del<{ liked: boolean; likeCount: number }>(`/comments/${commentId}/like`)
      } else {
        await post<{ liked: boolean; likeCount: number }>(`/comments/${commentId}/like`)
      }
    } catch {
      // Revert on failure
      setComments(apply)
    }
  }

  // --- Delete a comment (author or TEACHER/OPERATOR+) ---
  const canDeleteBy = (authorId: number): boolean => {
    if (!user) return false
    if (authorId === user.id) return true
    return user.role === 'TEACHER' || user.role === 'OPERATOR' || user.role === 'SUPER_ADMIN'
  }

  // --- Report a comment (student admins only, not on own/teacher comments) ---
  const isStudentAdmin = user?.isStudentAdmin === true && user?.role === 'STUDENT'
  const canReport = (authorId: number, authorRole?: string): boolean => {
    if (!isStudentAdmin) return false
    if (authorId === user?.id) return false
    if (authorRole === 'TEACHER') return false
    return true
  }

  const [reportVisible, setReportVisible] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reportCommentId, setReportCommentId] = useState<number | null>(null)

  const openReport = (commentId: number): void => {
    Taro.showModal({
      title: '举报评论',
      content: '确定要举报这条评论吗？',
      confirmText: '举报',
      cancelText: '取消',
      confirmColor: '#ba1a1a',
      success: (res) => {
        if (!res.confirm) return
        setReportCommentId(commentId)
        setReportReason('')
        setReportVisible(true)
      },
    })
  }

  const handleReportConfirm = async (): Promise<void> => {
    if (reportCommentId === null) return
    const reason = reportReason.trim()
    if (!reason) return
    try {
      await post(`/comments/${reportCommentId}/report`, { reason })
      Taro.showToast({ title: '已举报', icon: 'success' })
      setReportVisible(false)
    } catch {
      // request.ts surfaces the error toast
    }
  }

  const handleDelete = (commentId: number, isReply: boolean, parentId?: number): void => {
    Taro.showModal({
      title: '删除评论',
      content: '确定要删除这条评论吗？',
      confirmText: '删除',
      cancelText: '取消',
      confirmColor: '#ba1a1a',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await del(`/comments/${commentId}`)
          if (isReply && parentId != null) {
            setComments((prev) =>
              prev.map((c) =>
                c.id === parentId
                  ? { ...c, replies: c.replies?.filter((r) => r.id !== commentId) }
                  : c,
              ),
            )
          } else {
            setComments((prev) => prev.filter((c) => c.id !== commentId))
            onCommentDeleted()
          }
          Taro.showToast({ title: '已删除', icon: 'success' })
        } catch {
          // toast handled by request.ts
        }
      },
    })
  }

  // --- Render ---
  const overlayVisible = visible || height > 0
  const drawerStyle: CSSProperties = {
    height: `${height}px`,
    transition: dragging ? 'none' : 'height 0.3s ease',
  }

  // Shared comment list (used by both mobile and desktop variants)
  const commentList = (
    <ScrollView
      scrollY
      onScrollToLower={loadMore}
      lowerThreshold={80}
      className='flex-1'
      style={{ minHeight: 0 }}
    >
      <View className='px-5 py-4'>
        {loading && comments.length === 0 ? (
          <View className='flex items-center justify-center py-12'>
            <Text className='text-sm text-on-surface-variant'>加载中...</Text>
          </View>
        ) : comments.length === 0 ? (
          <View className='flex flex-col items-center justify-center py-12'>
            <Icon name='chat_bubble_outline' style={{ fontSize: '40px', color: '#c2c7c8' }} />
            <Text className='mt-3 text-sm text-on-surface-variant'>
              暂无评论，快来抢沙发吧
            </Text>
          </View>
        ) : (
          <View className='space-y-5'>
            {comments.map((c) => (
              <CommentItem
                key={c.id}
                comment={c}
                classMap={classMap}
                canDelete={canDeleteBy}
                canReport={canReport}
                onLike={(id) => toggleLike(id, false)}
                onReply={setReplyTarget}
                onDelete={(id) => handleDelete(id, false)}
                onReport={(commentId) => openReport(commentId)}
                onLikeReply={(id, pid) => toggleLike(id, true, pid)}
                onDeleteReply={(id, pid) => handleDelete(id, true, pid)}
              />
            ))}
          </View>
        )}

        {/* Load-more / end states */}
        {!loading && comments.length > 0 && (
          <View className='mt-4 flex items-center justify-center py-3'>
            {loadingMore ? (
              <Text className='text-xs text-on-surface-variant'>加载中...</Text>
            ) : !hasMore ? (
              <Text className='text-xs text-outline'>没有更多评论了</Text>
            ) : null}
          </View>
        )}
      </View>
    </ScrollView>
  )

  const replyBanner = replyTarget && (
    <View className='flex-shrink-0 flex items-center justify-between bg-surface-container px-5 py-2'>
      <Text className='text-xs text-on-surface-variant'>
        回复 @{replyTarget.user.name}
      </Text>
      <View
        onClick={() => setReplyTarget(null)}
        className='flex h-6 w-6 items-center justify-center rounded-full text-outline'
      >
        <Icon name='close' style={{ fontSize: '16px' }} />
      </View>
    </View>
  )

  const inputBar = (
    <View
      className='flex-shrink-0 border-t border-outline-variant/20 bg-surface px-4 py-3'
      style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
    >
      <View className='flex items-center gap-3 rounded-full bg-surface-container px-4 py-2'>
        <Input
          type='text'
          value={input}
          placeholder={replyTarget ? `回复 @${replyTarget.user.name}` : '写下你的评论...'}
          placeholderClass='text-outline'
          onInput={(e) => setInput(e.detail.value)}
          onConfirm={() => void handleSend()}
          confirmType='send'
          className='flex-1 bg-transparent text-sm text-on-surface'
          style={{ fontSize: '14px', lineHeight: '20px' }}
        />
        <View
          onClick={() => void handleSend()}
          className={`flex h-8 items-center justify-center rounded-full px-4 text-sm font-semibold ${
            input.trim() && !sending
              ? 'bg-primary text-on-primary'
              : 'bg-surface-container-high text-outline'
          }`}
        >
          <Text>{sending ? '...' : '发送'}</Text>
        </View>
      </View>
    </View>
  )

  const reportModal = (
    <ReasonModal
      visible={reportVisible}
      title='举报评论'
      reason={reportReason}
      onReasonChange={setReportReason}
      reasonRequired
      reasonPlaceholder='请输入举报原因...'
      onConfirm={() => void handleReportConfirm()}
      onCancel={() => setReportVisible(false)}
      confirmText='提交举报'
      confirmDanger
    />
  )

  // --- Desktop variant: right-side panel at 50% width ---
  if (variant === 'desktop') {
    return (
      <View
        className={`fixed inset-0 z-[60] ${visible ? '' : 'pointer-events-none'}`}
        catchMove
      >
        {/* Overlay */}
        <View
          onClick={onClose}
          className='absolute inset-0 bg-black/50 transition-opacity duration-300'
          style={{ opacity: visible ? 1 : 0 }}
        />

        {/* Panel body — slides in from the right, occupies 50% width */}
        <View
          className='absolute right-0 top-0 flex h-full flex-col overflow-hidden bg-surface shadow-2xl'
          style={{
            width: '50%',
            transform: visible ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 0.3s ease',
          }}
        >
          {/* Header */}
          <View
            style={GLASS_STYLE}
            className='flex-shrink-0 border-b border-outline-variant/20 px-5 py-3'
          >
            <View className='flex items-center justify-between'>
              <Text className='text-base font-semibold text-on-surface'>
                评论 ({formatCount(commentCount)})
              </Text>
              <View
                onClick={onClose}
                className='flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant'
              >
                <Icon name='close' style={{ fontSize: '20px' }} />
              </View>
            </View>
          </View>

          {commentList}
          {replyBanner}
          {inputBar}
        </View>
        {reportModal}
      </View>
    )
  }

  // --- Mobile variant: bottom sheet ---
  return (
    <View
      className={`fixed inset-0 z-[60] ${overlayVisible ? '' : 'pointer-events-none'}`}
      catchMove
    >
      {/* Overlay */}
      <View
        onClick={onClose}
        className='absolute inset-0 bg-black/50 transition-opacity duration-300'
        style={{ opacity: overlayVisible ? 1 : 0 }}
      />

      {/* Drawer body */}
      <View
        className='absolute bottom-0 left-0 right-0 flex flex-col overflow-hidden rounded-t-2xl bg-surface shadow-2xl'
        style={drawerStyle}
      >
        {/* Drag handle + header */}
        <View
          onTouchStart={onHandleTouchStart}
          onTouchMove={onHandleTouchMove}
          onTouchEnd={onHandleTouchEnd}
          style={GLASS_STYLE}
          className='flex-shrink-0 border-b border-outline-variant/20 px-5 pb-3 pt-3'
        >
          <View className='mx-auto mb-3 h-1.5 w-10 rounded-full bg-surface-variant' />
          <View className='flex items-center justify-between'>
            <Text className='text-base font-semibold text-on-surface'>
              评论 ({formatCount(commentCount)})
            </Text>
            <View
              onClick={onClose}
              className='flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant'
            >
              <Icon name='close' style={{ fontSize: '20px' }} />
            </View>
          </View>
        </View>

        {commentList}
        {replyBanner}
        {inputBar}
      </View>
      {reportModal}
    </View>
  )
}

/* ---------------- Sub-components ---------------- */

interface CommentItemProps {
  comment: CommentWithUser
  classMap: Map<number, string>
  canDelete: (authorId: number) => boolean
  canReport: (authorId: number, authorRole?: string) => boolean
  onLike: (id: number) => void
  onReply: (comment: CommentWithUser) => void
  onDelete: (id: number) => void
  onReport: (commentId: number) => void
  onLikeReply: (id: number, parentId: number) => void
  onDeleteReply: (id: number, parentId: number) => void
}

function CommentItem({
  comment,
  classMap,
  canDelete,
  canReport,
  onLike,
  onReply,
  onDelete,
  onReport,
  onLikeReply,
  onDeleteReply,
}: CommentItemProps) {
  const commentCanDelete = canDelete(comment.user.id)
  const commentCanReport = canReport(comment.user.id, comment.user.role)

  return (
    <View className='flex gap-3'>
      <Avatar userId={comment.user.id} avatar={comment.user.avatar} name={comment.user.name} size={36} />
      <View className='min-w-0 flex-1'>
        {/* Header: name + class + role + time */}
        <View className='flex flex-wrap items-center gap-1.5'>
          <Text className='text-sm font-medium text-on-surface'>{comment.user.name}</Text>
          {comment.user.role === 'TEACHER' && (
            <Text className='rounded-full bg-secondary-container px-2 py-0.5 text-xs font-medium text-on-secondary-container'>
              教师
            </Text>
          )}
          {comment.user.classId != null && (
            <Text className='rounded-full bg-tertiary-container px-2 py-0.5 text-xs font-medium text-on-tertiary-container'>
              {classMap.get(comment.user.classId) ?? '未分班'}
            </Text>
          )}
          <Text className='text-xs text-outline'>
            {formatRelativeTime(comment.createdAt)}
          </Text>
        </View>

        {/* Content */}
        <Text className='mt-1 block text-sm leading-relaxed text-on-surface-variant'>
          {comment.content}
        </Text>

        {/* Actions: like + reply + delete */}
        <View className='mt-2 flex items-center gap-4'>
          <View
            onClick={() => onLike(comment.id)}
            className='flex items-center gap-1'
          >
            <Text
              className='text-sm'
              style={{ color: comment.liked ? '#ba1a1a' : '#727879' }}
            >
              {comment.liked ? '♥' : '♡'}
            </Text>
            <Text className='text-xs text-outline'>
              {formatCount(comment.likeCount)}
            </Text>
          </View>
          <View onClick={() => onReply(comment)}>
            <Text className='text-xs text-outline'>回复</Text>
          </View>
          {commentCanReport && (
            <View onClick={() => onReport(comment.id)}>
              <Text className='text-xs' style={{ color: '#ba1a1a' }}>举报</Text>
            </View>
          )}
          {commentCanDelete && (
            <View onClick={() => onDelete(comment.id)}>
              <Text className='text-xs' style={{ color: '#ba1a1a' }}>删除</Text>
            </View>
          )}
        </View>

        {/* Replies (one level deep) */}
        {comment.replies && comment.replies.length > 0 && (
          <View className='mt-3 space-y-3 rounded-lg bg-surface-container/60 p-3'>
            {comment.replies.map((reply) => {
              const replyCanDelete = canDelete(reply.user.id)
              const replyCanReport = canReport(reply.user.id, reply.user.role)
              return (
                <View key={reply.id} className='flex gap-2.5'>
                  <Avatar
                    userId={reply.user.id}
                    avatar={reply.user.avatar}
                    name={reply.user.name}
                    size={28}
                  />
                  <View className='min-w-0 flex-1'>
                    <View className='flex flex-wrap items-center gap-1.5'>
                      <Text className='text-xs font-medium text-on-surface'>
                        {reply.user.name}
                      </Text>
                      {reply.user.role === 'TEACHER' && (
                        <Text className='rounded-full bg-secondary-container px-1.5 py-0.5 text-xs font-medium text-on-secondary-container'>
                          教师
                        </Text>
                      )}
                      {reply.user.classId != null && (
                        <Text className='rounded-full bg-tertiary-container px-1.5 py-0.5 text-xs font-medium text-on-tertiary-container'>
                          {classMap.get(reply.user.classId) ?? '未分班'}
                        </Text>
                      )}
                      <Text className='text-xs text-outline'>
                        {formatRelativeTime(reply.createdAt)}
                      </Text>
                    </View>
                    <Text className='mt-1 block text-xs leading-relaxed text-on-surface-variant'>
                      {reply.content}
                    </Text>
                    <View className='mt-1.5 flex items-center gap-4'>
                      <View
                        onClick={() => onLikeReply(reply.id, comment.id)}
                        className='flex items-center gap-1'
                      >
                        <Text
                          className='text-xs'
                          style={{ color: reply.liked ? '#ba1a1a' : '#727879' }}
                        >
                          {reply.liked ? '♥' : '♡'}
                        </Text>
                        <Text className='text-xs text-outline'>
                          {formatCount(reply.likeCount)}
                        </Text>
                      </View>
                      {replyCanReport && (
                        <View onClick={() => onReport(reply.id)}>
                          <Text className='text-xs' style={{ color: '#ba1a1a' }}>举报</Text>
                        </View>
                      )}
                      {replyCanDelete && (
                        <View onClick={() => onDeleteReply(reply.id, comment.id)}>
                          <Text className='text-xs' style={{ color: '#ba1a1a' }}>删除</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              )
            })}
          </View>
        )}
      </View>
    </View>
  )
}

/** Circular avatar with an initial-based placeholder fallback. */
function Avatar({
  userId,
  avatar,
  name,
  size,
}: {
  userId: number
  avatar: string | null
  name: string
  size: number
}) {
  const url = coverUrl(avatar)
  const dim = `${size}px`
  if (url) {
    return (
      <Image
        src={url}
        className='shrink-0 rounded-full bg-surface-container object-cover'
        style={{ width: dim, height: dim }}
        mode='aspectFill'
      />
    )
  }
  return (
    <View
      className='flex shrink-0 items-center justify-center rounded-full text-white'
      style={{
        width: dim,
        height: dim,
        backgroundColor: `hsl(${hueFor(userId)} 40% 60%)`,
        fontSize: `${size * 0.4}px`,
        fontWeight: 600,
      }}
    >
      {(name || '?').charAt(0)}
    </View>
  )
}
