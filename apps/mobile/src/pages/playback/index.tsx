import { useEffect, useRef, useState, useCallback, type CSSProperties } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import { useAuthRedirect } from '../../utils/route-guard'
import { useIsDesktop } from '../../components/AppLayout/useIsDesktop'
import { usePlayerStore, setSeeking } from '../../store/player'
import { get, post, del } from '../../utils/request'
import { coverUrl, formatDuration, formatCount } from '../../utils/format'
import CommentDrawer from '../../components/CommentDrawer'
import type { PodcastWithRelations, Class, TagColor } from '@qingmalaya/shared'

/**
 * Playback detail page (Task 19).
 *
 * Full-screen page (no AppLayout) with its own custom nav bar. Audio playback
 * is handled by the global <GlobalAudioPlayer> (mounted at the app root) — this
 * page only drives the store via `load`/`togglePlayPause`/`seek`. Because the
 * Audio element is global, playback continues and the PlaybackBar stays visible
 * when the user navigates back.
 *
 * Layout: flex column — pinned top bar, scrollable cover/info, pinned controls
 * (progress + play/pause + speed), pinned bottom action bar (like/comment/fav),
 * and the comment drawer overlay.
 */

const SPEEDS = [0.75, 1, 1.25, 1.5, 2]

/** Tag chip palette — 15% tint background + matching text (matches browse page). */
const TAG_COLORS: Record<TagColor, { text: string; bg: string }> = {
  mint: { text: '#2f8f5e', bg: 'rgba(47, 143, 94, 0.15)' },
  purple: { text: '#7c4dd1', bg: 'rgba(124, 77, 209, 0.15)' },
  orange: { text: '#c9701f', bg: 'rgba(201, 112, 31, 0.15)' },
  rose: { text: '#d6336c', bg: 'rgba(214, 51, 108, 0.15)' },
  sky: { text: '#1c7ed6', bg: 'rgba(28, 126, 214, 0.15)' },
  teal: { text: '#0ca678', bg: 'rgba(12, 166, 120, 0.15)' },
  indigo: { text: '#4263eb', bg: 'rgba(66, 99, 235, 0.15)' },
  amber: { text: '#b8860b', bg: 'rgba(184, 134, 11, 0.15)' },
}

/** Glassmorphism spec from DESIGN.md: 20px backdrop-blur + 80% white fill. */
const GLASS_STYLE: CSSProperties = {
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  backgroundColor: 'rgba(251, 249, 248, 0.8)',
}

/** Inline Material Symbols icon (font linked in src/index.html on H5). */
function Icon({ name, style }: { name: string; style?: CSSProperties }) {
  return (
    <Text className='material-symbols-outlined' style={{ fontSize: '18px', ...style }}>
      {name}
    </Text>
  )
}

export default function Playback() {
  const ok = useAuthRedirect()
  const isDesktop = useIsDesktop()

  // --- Podcast data ---
  const [podcast, setPodcast] = useState<PodcastWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  const [classes, setClasses] = useState<Class[]>([])

  // --- Like / favorite / comment state ---
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [favorited, setFavorited] = useState(false)
  const [likeBounce, setLikeBounce] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [commentCount, setCommentCount] = useState(0)
  const [exiting, setExiting] = useState(false)

  // --- Description modal (picture-in-picture for long descriptions) ---
  const [descModalMounted, setDescModalMounted] = useState(false)
  const [descModalVisible, setDescModalVisible] = useState(false)

  // --- Local slider drag value (decouples drag from store position updates) ---
  const [dragValue, setDragValue] = useState<number | null>(null)

  // --- Player store ---
  const {
    isPlaying,
    position,
    duration,
    playbackRate,
    load,
    togglePlayPause,
    setPosition,
    seek,
    setPlaybackRate,
  } = usePlayerStore()

  // Ref for the custom progress bar track element (pointer events).
  const trackRef = useRef<HTMLElement | null>(null)
  // Local drag guard — distinct from the global setSeeking flag so pointer
  // handlers can synchronously check if a drag is active.
  const draggingRef = useRef(false)

  // Resolve the podcast ID from the route query ONCE. Recomputing on every
  // render breaks because Taro.getCurrentInstance().router changes during
  // navigateBack — the param becomes undefined, podcastId turns NaN, and the
  // fetch effect re-fires showing "无效的播客ID".
  const [podcastId] = useState(() => {
    const instance = Taro.getCurrentInstance()
    const id = Number(instance.router?.params.id)
    return Number.isNaN(id) ? 0 : id
  })

  // Class name lookup.
  const classMap = new Map<number, string>()
  classes.forEach((c) => classMap.set(c.id, c.name))

  // --- Fetch podcast detail + class catalog on mount ---
  useEffect(() => {
    if (!ok) return
    if (!podcastId) {
      Taro.showToast({ title: '无效的播客ID', icon: 'none' })
      setLoading(false)
      return
    }

    setLoading(true)
    get<PodcastWithRelations>(`/podcasts/${podcastId}`)
      .then((p) => {
        setPodcast(p)
        setLiked(!!p.liked)
        setLikeCount(p.likeCount)
        setFavorited(!!p.favorited)
        setCommentCount(p.commentCount)

        // Load into the global player. If this is a fresh load (different
        // podcast), fetch the resume position and seek to it. If the podcast
        // is already loaded (user returning to the page), the global player
        // already has the correct position — do nothing.
        const wasNew = load(p)
        if (wasNew) {
          post<{ position: number }>(`/podcasts/${p.id}/play`, { position: 0, start: true })
            .then((res) => {
              if (res.position > 0) seek(res.position)
            })
            .catch(() => {})
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))

    get<Class[]>('/classes', { silent: true })
      .then(setClasses)
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ok, podcastId])

  // --- Playback controls ---
  const handleTogglePlay = useCallback((): void => {
    togglePlayPause()
  }, [togglePlayPause])

  const handleSeeking = useCallback(
    (val: number): void => {
      setDragValue(val)
      const d = duration || podcast?.duration || 0
      const newPos = d > 0 ? (val / 100) * d : 0
      setPosition(newPos)
    },
    [duration, podcast, setPosition],
  )

  const handleSeek = useCallback(
    (val: number): void => {
      const d = duration || podcast?.duration || 0
      const newPos = d > 0 ? (val / 100) * d : 0
      seek(newPos)
      setSeeking(false)
      setDragValue(null)
    },
    [duration, podcast, seek],
  )

  // --- Progress bar pointer events (works with both mouse and touch) ---
  useEffect(() => {
    const el = trackRef.current
    if (!el) return

    const getVal = (clientX: number): number => {
      const rect = el.getBoundingClientRect()
      return Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))
    }

    const onDown = (e: PointerEvent): void => {
      e.preventDefault()
      try {
        el.setPointerCapture(e.pointerId)
      } catch {
        // setPointerCapture not supported
      }
      setSeeking(true)
      draggingRef.current = true
      const val = getVal(e.clientX)
      setDragValue(val)
      handleSeeking(val)
    }

    const onMove = (e: PointerEvent): void => {
      if (!draggingRef.current) return
      e.preventDefault()
      const val = getVal(e.clientX)
      setDragValue(val)
      handleSeeking(val)
    }

    const onUp = (e: PointerEvent): void => {
      if (!draggingRef.current) return
      draggingRef.current = false
      const val = getVal(e.clientX)
      handleSeek(val)
    }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)

    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      // Reset the global seeking flag in case the component unmounts mid-drag.
      setSeeking(false)
    }
  }, [handleSeeking, handleSeek])

  const handleSpeedCycle = useCallback((): void => {
    const idx = SPEEDS.indexOf(playbackRate)
    const next = SPEEDS[(idx + 1) % SPEEDS.length]
    setPlaybackRate(next)
  }, [playbackRate, setPlaybackRate])

  // --- Like toggle ---
  const handleLike = useCallback(async (): Promise<void> => {
    if (!podcast) return
    const wasLiked = liked
    // Optimistic update + bounce animation
    setLiked(!wasLiked)
    setLikeCount((c) => c + (wasLiked ? -1 : 1))
    if (!wasLiked) {
      setLikeBounce(true)
      setTimeout(() => setLikeBounce(false), 200)
    }
    try {
      if (wasLiked) {
        await del<{ liked: boolean; likeCount: number }>(
          `/podcasts/${podcast.id}/like`,
        )
      } else {
        await post<{ liked: boolean; likeCount: number }>(
          `/podcasts/${podcast.id}/like`,
        )
      }
    } catch {
      // Revert on failure
      setLiked(wasLiked)
      setLikeCount((c) => c + (wasLiked ? 1 : -1))
    }
  }, [podcast, liked])

  // --- Favorite toggle ---
  const handleFavorite = useCallback(async (): Promise<void> => {
    if (!podcast) return
    const wasFavorited = favorited
    setFavorited(!wasFavorited)
    Taro.showToast({
      title: wasFavorited ? '已取消收藏' : '已收藏',
      icon: 'none',
    })
    try {
      if (wasFavorited) {
        await del(`/podcasts/${podcast.id}/favorite`, { silent: true })
      } else {
        await post(`/podcasts/${podcast.id}/favorite`, undefined, { silent: true })
      }
    } catch (err) {
      setFavorited(wasFavorited)
      Taro.showToast({
        title: err instanceof Error ? err.message : '操作失败',
        icon: 'none',
      })
    }
  }, [podcast, favorited])

  // --- Share ---
  const handleShare = useCallback((): void => {
    Taro.setClipboardData({
      data: podcast ? `${podcast.title} - 清马拉雅` : '清马拉雅',
      success: () => {
        Taro.showToast({ title: '已复制分享内容', icon: 'success' })
      },
    })
  }, [podcast])

  const handleBack = useCallback((): void => {
    setExiting(true)
    setTimeout(() => {
      Taro.navigateBack({
        fail: () => Taro.switchTab({ url: '/pages/discovery/index' }),
      })
    }, 300)
  }, [])

  const openDescModal = useCallback((): void => {
    setDescModalMounted(true)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setDescModalVisible(true))
    })
  }, [])

  const closeDescModal = useCallback((): void => {
    setDescModalVisible(false)
    setTimeout(() => setDescModalMounted(false), 200)
  }, [])

  const animClass = exiting ? 'playback-slide-down' : 'playback-slide-up'

  // --- Render guards ---
  if (!ok) return null

  if (loading) {
    return (
      <View className={`flex min-h-screen items-center justify-center bg-surface ${animClass}`}>
        <Text className='text-sm text-on-surface-variant'>加载中...</Text>
      </View>
    )
  }

  if (!podcast) {
    return (
      <View className={`flex min-h-screen flex-col items-center justify-center gap-4 bg-surface px-6 ${animClass}`}>
        <Text className='text-sm text-on-surface-variant'>播客不存在或已下架</Text>
        <View
          onClick={handleBack}
          className='rounded-full bg-primary px-6 py-2 text-sm text-on-primary'
        >
          <Text>返回</Text>
        </View>
      </View>
    )
  }

  // --- Derived values ---
  const cover = coverUrl(podcast.coverPath)
  const effectiveDuration = duration || podcast.duration
  const progress =
    effectiveDuration > 0
      ? Math.min(100, (position / effectiveDuration) * 100)
      : 0
  const sliderValue = dragValue !== null ? dragValue : progress
  const speedLabel = `${playbackRate}x`
  const authorClass = podcast.author.classId
    ? classMap.get(podcast.author.classId)
    : null

  const isLongDesc = !!podcast.description && podcast.description.length > 80

  const clampedDescStyle: CSSProperties = {
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    wordBreak: 'break-word',
  }

  return (
    <View
      className={`flex h-screen flex-col overflow-hidden bg-surface ${animClass}`}
      style={{ willChange: 'transform' }}
    >
      {/* ---- Top bar ---- */}
      <View
        style={GLASS_STYLE}
        className='flex flex-shrink-0 items-center justify-between px-4 pb-2 pt-3'
      >
        <View
          onClick={handleBack}
          className='flex h-10 w-10 items-center justify-center rounded-full text-primary'
        >
          <Icon name='expand_more' style={{ fontSize: '22px' }} />
        </View>
        <Text className='text-sm font-semibold tracking-wide text-primary'>
          清马拉雅
        </Text>
        <View
          onClick={handleShare}
          className='flex h-10 w-10 items-center justify-center rounded-full text-primary'
        >
          <Icon name='share' style={{ fontSize: '20px' }} />
        </View>
      </View>

      {/* ---- Scrollable content: cover + meta ---- */}
      <ScrollView scrollY className='flex-1' style={{ minHeight: 0 }}>
        <View
          className='mx-auto flex max-w-md flex-col px-5'
          style={{
            minHeight: '100%',
            justifyContent: 'center',
            ...(isDesktop ? { maxWidth: '672px' } : {}),
          }}
        >
          {/* Cover */}
          <View className='flex items-center justify-center py-6'>
            {cover ? (
              <Image
                src={cover}
                mode='aspectFill'
                className='rounded-xl shadow-xl'
                style={{ width: '280px', height: '280px' }}
              />
            ) : (
              <View
                className='flex items-center justify-center rounded-xl bg-primary/15 shadow-xl'
                style={{ width: '280px', height: '280px' }}
              >
                <Text className='text-6xl font-bold text-on-primary-container'>
                  {(podcast.title || '?').charAt(0)}
                </Text>
              </View>
            )}
          </View>

          {/* Tags */}
          {podcast.tags.length > 0 && (
            <View className='mb-3 flex flex-wrap gap-2'>
              {podcast.tags.map((tag) => {
                const c = TAG_COLORS[tag.color] || TAG_COLORS.mint
                return (
                  <View
                    key={tag.id}
                    className='rounded-full px-3 py-1'
                    style={{ backgroundColor: c.bg }}
                  >
                    <Text
                      className='text-xs font-medium'
                      style={{ color: c.text }}
                    >
                      #{tag.name}
                    </Text>
                  </View>
                )
              })}
            </View>
          )}

          {/* Title */}
          <Text className='block text-2xl font-bold leading-tight text-on-surface'>
            {podcast.title}
          </Text>

          {/* Author + class pill */}
          <View className='mt-2 flex flex-wrap items-center gap-2'>
            <Text className='text-sm text-on-surface-variant'>
              {podcast.author.name}
            </Text>
            {authorClass && (
              <Text className='rounded-full bg-tertiary-container px-2 py-0.5 text-sm font-medium text-on-tertiary-container'>
                {authorClass}
              </Text>
            )}
            {podcast.author.role === 'TEACHER' && (
              <Text className='rounded-full bg-secondary-container px-2 py-0.5 text-sm font-medium text-on-secondary-container'>
                教师
              </Text>
            )}
          </View>

          {/* Description — short ones show fully; long ones clamp
              with a "更多" button that opens a picture-in-picture modal */}
          {podcast.description && (
            <View className='mt-3'>
              <Text
                className='block text-sm leading-relaxed text-on-surface-variant'
                style={isLongDesc ? clampedDescStyle : undefined}
              >
                {podcast.description}
              </Text>
              {isLongDesc && (
                <View onClick={openDescModal} className='mt-1'>
                  <Text className='text-xs font-semibold text-primary'>
                    更多
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ---- Controls: progress + play/pause + speed ---- */}
      <View
        className='mx-auto w-full max-w-md flex-shrink-0 px-5 pb-2 pt-4'
        style={isDesktop ? { maxWidth: '672px' } : undefined}
      >
        {/* Progress bar — custom pointer-events track (Taro Slider only
            supports touch on the knob, which breaks desktop drag) */}
        <View
          ref={trackRef as any}
          style={{
            position: 'relative',
            width: '100%',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            touchAction: 'none',
            cursor: 'pointer',
          }}
        >
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              height: '4px',
              borderRadius: '2px',
              backgroundColor: '#e3e2e2',
            }}
          />
          <View
            style={{
              position: 'absolute',
              left: 0,
              height: '4px',
              borderRadius: '2px',
              backgroundColor: '#4d6265',
              width: `${sliderValue}%`,
            }}
          />
          <View
            style={{
              position: 'absolute',
              left: `${sliderValue}%`,
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              backgroundColor: '#4d6265',
              transform: 'translateX(-50%)',
              boxShadow: '0 0 4px rgba(0,0,0,0.2)',
            }}
          />
        </View>
        <View className='flex justify-between px-1'>
          <Text className='text-xs text-outline'>
            {formatDuration(position)}
          </Text>
          <Text className='text-xs text-outline'>
            {formatDuration(effectiveDuration)}
          </Text>
        </View>

        {/* Play/pause + speed */}
        <View className='relative mt-3 flex items-center justify-center'>
          <View
            onClick={handleTogglePlay}
            className='flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-primary shadow-lg active:scale-95'
            style={{ transition: 'transform 0.15s' }}
          >
            {isPlaying ? (
              <View
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <View
                  style={{
                    width: '5px',
                    height: '22px',
                    borderRadius: '2px',
                    backgroundColor: '#ffffff',
                  }}
                />
                <View
                  style={{
                    width: '5px',
                    height: '22px',
                    borderRadius: '2px',
                    backgroundColor: '#ffffff',
                  }}
                />
              </View>
            ) : (
              <View
                style={{
                  width: 0,
                  height: 0,
                  borderTop: '11px solid transparent',
                  borderBottom: '11px solid transparent',
                  borderLeft: '18px solid #ffffff',
                  marginLeft: '4px',
                }}
              />
            )}
          </View>

          <View
            onClick={handleSpeedCycle}
            className='absolute right-0 flex h-10 items-center justify-center rounded-full px-4 text-sm font-semibold text-on-surface-variant'
            style={{ border: '1px solid #c2c7c8' }}
          >
            <Text>{speedLabel}</Text>
          </View>
        </View>
      </View>

      {/* ---- Bottom action bar: like / comment / favorite ---- */}
      <View
        className='mx-auto flex w-full max-w-md flex-shrink-0 items-center justify-around border-t border-outline-variant/20 px-5 py-3'
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))', maxWidth: isDesktop ? '672px' : undefined }}
      >
        {/* Like */}
        <View
          onClick={() => void handleLike()}
          className='flex flex-col items-center gap-1'
        >
          <View
            style={{
              transform: likeBounce ? 'scale(1.3)' : 'scale(1)',
              transition: 'transform 0.2s',
            }}
          >
            <Text
              className='text-2xl'
              style={{ color: liked ? '#ba1a1a' : '#727879' }}
            >
              {liked ? '♥' : '♡'}
            </Text>
          </View>
          <Text className='text-xs text-outline'>
            {formatCount(likeCount)}
          </Text>
        </View>

        {/* Comment */}
        <View
          onClick={() => setDrawerOpen(true)}
          className='flex flex-col items-center gap-1'
        >
          <Icon name='chat_bubble_outline' style={{ fontSize: '24px', color: '#727879' }} />
          <Text className='text-xs text-outline'>
            {formatCount(commentCount)}
          </Text>
        </View>

        {/* Favorite */}
        <View
          onClick={handleFavorite}
          className='flex flex-col items-center gap-1'
        >
          <Text
            className='text-2xl'
            style={{ color: favorited ? '#4d6265' : '#727879' }}
          >
            {favorited ? '★' : '☆'}
          </Text>
          <Text className='text-xs text-outline'>收藏</Text>
        </View>
      </View>

      {/* ---- Comment drawer ---- */}
      <CommentDrawer
        podcastId={podcast.id}
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        commentCount={commentCount}
        onCommentAdded={() => setCommentCount((c) => c + 1)}
        onCommentDeleted={() => setCommentCount((c) => Math.max(0, c - 1))}
      />

      {/* ---- Description picture-in-picture modal ---- */}
      {descModalMounted && (
        <View
          onClick={closeDescModal}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '24px',
            opacity: descModalVisible ? 1 : 0,
            transition: 'opacity 0.2s ease-out',
          }}
        >
          <View
            onClick={(e) => e.stopPropagation()}
            style={{
              ...GLASS_STYLE,
              maxWidth: '400px',
              width: '100%',
              maxHeight: '70vh',
              borderRadius: '16px',
              padding: '24px',
              overflowY: 'auto',
              transform: descModalVisible ? 'scale(1)' : 'scale(0.9)',
              opacity: descModalVisible ? 1 : 0,
              transition: 'transform 0.2s ease-out, opacity 0.2s ease-out',
            }}
          >
            <Text className='block text-base font-semibold text-on-surface'>
              简介
            </Text>
            <Text
              className='mt-3 block text-sm leading-relaxed text-on-surface-variant'
              style={{ wordBreak: 'break-word' }}
            >
              {podcast.description}
            </Text>
            <View
              onClick={closeDescModal}
              className='mt-4 flex justify-center'
            >
              <Text className='rounded-full bg-primary px-6 py-2 text-sm font-semibold text-on-primary'>
                关闭
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
