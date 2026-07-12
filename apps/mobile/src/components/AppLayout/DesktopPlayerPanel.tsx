import { useEffect, useRef, useState, useCallback, type CSSProperties } from 'react'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import { usePlayerStore, setSeeking } from '../../store/player'
import { get, post, del } from '../../utils/request'
import { coverUrl, formatDuration, formatCount } from '../../utils/format'
import CommentDrawer from '../CommentDrawer'
import type { Class, TagColor } from '@qingmalaya/shared'

const SPEEDS = [0.75, 1, 1.25, 1.5, 2]

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

/**
 * Right-side full player panel for the desktop split layout.
 *
 * Reads from the global player store — when `currentPodcast` is null, shows a
 * guide message prompting the user to pick something. When a podcast is
 * loaded, displays the cover, metadata, progress bar, transport controls,
 * and like/favorite/comment actions.
 *
 * Like state is synced to the store via `setLiked` so the mini-player in the
 * top bar stays in sync. Favorite and comment count are managed locally.
 */
export default function DesktopPlayerPanel() {
  const {
    currentPodcast,
    isPlaying,
    position,
    duration,
    playbackRate,
    togglePlayPause,
    setPosition,
    seek,
    setPlaybackRate,
    setLiked,
  } = usePlayerStore()

  const [likePending, setLikePending] = useState(false)
  const [favorited, setFavorited] = useState(false)
  const [commentCount, setCommentCount] = useState(0)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [dragValue, setDragValue] = useState<number | null>(null)
  const [classes, setClasses] = useState<Class[]>([])
  const [descModalMounted, setDescModalMounted] = useState(false)
  const [descModalVisible, setDescModalVisible] = useState(false)
  const trackRef = useRef<HTMLElement | null>(null)
  const draggingRef = useRef(false)

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

  // Sync local state when the podcast changes
  useEffect(() => {
    if (currentPodcast) {
      setFavorited(!!currentPodcast.favorited)
      setCommentCount(currentPodcast.commentCount)
    }
  }, [currentPodcast?.id])

  // Fetch class catalog for author class display
  useEffect(() => {
    get<Class[]>('/classes', { silent: true })
      .then(setClasses)
      .catch(() => {})
  }, [])

  const classMap = new Map<number, string>()
  classes.forEach((c) => classMap.set(c.id, c.name))

  const handleSeeking = useCallback(
    (val: number): void => {
      setDragValue(val)
      const d = duration || currentPodcast?.duration || 0
      const newPos = d > 0 ? (val / 100) * d : 0
      setPosition(newPos)
    },
    [duration, currentPodcast, setPosition],
  )

  const handleSeek = useCallback(
    (val: number): void => {
      const d = duration || currentPodcast?.duration || 0
      const newPos = d > 0 ? (val / 100) * d : 0
      seek(newPos)
      setSeeking(false)
      setDragValue(null)
    },
    [duration, currentPodcast, seek],
  )

  // Pointer events for progress bar dragging
  useEffect(() => {
    const el = trackRef.current
    if (!el) return

    const getVal = (clientX: number): number => {
      const rect = el.getBoundingClientRect()
      return Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))
    }

    const onDown = (e: PointerEvent): void => {
      e.preventDefault()
      try { el.setPointerCapture(e.pointerId) } catch { /* noop */ }
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
      handleSeek(getVal(e.clientX))
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
      setSeeking(false)
    }
  }, [handleSeeking, handleSeek])

  const handleSpeedCycle = useCallback((): void => {
    const idx = SPEEDS.indexOf(playbackRate)
    setPlaybackRate(SPEEDS[(idx + 1) % SPEEDS.length])
  }, [playbackRate, setPlaybackRate])

  const handleLike = useCallback(async (): Promise<void> => {
    const pod = currentPodcast
    if (!pod || likePending) return
    const wasLiked = !!pod.liked
    const nextCount = pod.likeCount + (wasLiked ? -1 : 1)
    setLiked(!wasLiked, nextCount)
    setLikePending(true)
    try {
      if (wasLiked) {
        await del(`/podcasts/${pod.id}/like`)
      } else {
        await post(`/podcasts/${pod.id}/like`)
      }
    } catch {
      setLiked(wasLiked, pod.likeCount)
    } finally {
      setLikePending(false)
    }
  }, [currentPodcast, likePending, setLiked])

  const handleFavorite = useCallback(async (): Promise<void> => {
    const pod = currentPodcast
    if (!pod) return
    const wasFavorited = favorited
    setFavorited(!wasFavorited)
    try {
      if (wasFavorited) {
        await del(`/podcasts/${pod.id}/favorite`, { silent: true })
      } else {
        await post(`/podcasts/${pod.id}/favorite`, undefined, { silent: true })
      }
    } catch {
      setFavorited(wasFavorited)
    }
  }, [currentPodcast, favorited])

  // --- Empty state ---
  if (!currentPodcast) {
    return (
      <View className='flex h-full flex-col items-center justify-center bg-surface px-8'>
        <View
          className='mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-primary/10'
        >
          <Text className='material-symbols-outlined text-primary' style={{ fontSize: '48px' }}>
            graphic_eq
          </Text>
        </View>
        <Text className='mb-2 text-lg font-semibold text-on-surface'>
          欢迎来到万卷回响
        </Text>
        <Text className='text-center text-sm leading-relaxed text-on-surface-variant'>
          从左侧选择一个播客开始播放{'\n'}这里将显示播放界面
        </Text>
      </View>
    )
  }

  // --- Active player ---
  const pod = currentPodcast
  const cover = coverUrl(pod.coverPath)
  const effectiveDuration = duration || pod.duration
  const progress = effectiveDuration > 0 ? Math.min(100, (position / effectiveDuration) * 100) : 0
  const sliderValue = dragValue !== null ? dragValue : progress
  const liked = !!pod.liked
  const likeCount = pod.likeCount
  const authorClass = pod.author.classId ? classMap.get(pod.author.classId) : null
  const isLongDesc = !!pod.description && pod.description.length > 120

  const clampedDescStyle: CSSProperties = {
    display: '-webkit-box',
    WebkitLineClamp: 5,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    wordBreak: 'break-word',
  }

  return (
    <View className='flex h-full flex-col bg-surface'>
      <ScrollView scrollY className='flex-1' style={{ minHeight: 0 }}>
        <View className='mx-auto flex min-h-full max-w-md flex-col justify-center px-6 py-8'>
          {/* Cover */}
          <View className='flex items-center justify-center pb-6'>
            {cover ? (
              <Image
                src={cover}
                mode='aspectFill'
                className='rounded-2xl shadow-2xl'
                style={{ width: '240px', height: '240px' }}
              />
            ) : (
              <View
                className='flex items-center justify-center rounded-2xl bg-primary/15 shadow-2xl'
                style={{ width: '240px', height: '240px' }}
              >
                <Text className='text-5xl font-bold text-on-primary-container'>
                  {(pod.title || '?').charAt(0)}
                </Text>
              </View>
            )}
          </View>

          {/* Tags */}
          {pod.tags.length > 0 && (
            <View className='mb-3 flex flex-wrap justify-center gap-2'>
              {pod.tags.map((tag) => {
                const c = TAG_COLORS[tag.color] || TAG_COLORS.mint
                return (
                  <View
                    key={tag.id}
                    className='rounded-full px-3 py-1'
                    style={{ backgroundColor: c.bg }}
                  >
                    <Text className='text-xs font-medium' style={{ color: c.text }}>
                      #{tag.name}
                    </Text>
                  </View>
                )
              })}
            </View>
          )}

          {/* Title */}
          <Text className='text-center text-xl font-bold leading-tight text-on-surface'>
            {pod.title}
          </Text>

          {/* Author + class pill */}
          <View className='mt-2 flex flex-wrap items-center justify-center gap-2'>
            <Text className='text-sm text-on-surface-variant'>
              {pod.author.name}
            </Text>
            {authorClass && (
              <Text className='rounded-full bg-tertiary-container px-2 py-0.5 text-xs font-medium text-on-tertiary-container'>
                {authorClass}
              </Text>
            )}
            {pod.author.role === 'TEACHER' && (
              <Text className='rounded-full bg-secondary-container px-2 py-0.5 text-xs font-medium text-on-secondary-container'>
                教师
              </Text>
            )}
          </View>

          {/* Description */}
          {pod.description && (
            <View className='mt-4'>
              <Text
                className='block text-sm leading-relaxed text-on-surface-variant'
                style={isLongDesc ? clampedDescStyle : undefined}
              >
                {pod.description}
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

      {/* Controls: progress + play/pause + speed */}
      <View className='mx-auto w-full max-w-md flex-shrink-0 px-6 pb-3 pt-2'>
        {/* Progress bar */}
        <View
          ref={trackRef as any}
          style={{
            position: 'relative',
            width: '100%',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            touchAction: 'none',
            cursor: 'pointer',
          }}
        >
          <View
            style={{
              position: 'absolute',
              left: 0, right: 0,
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
              width: '16px',
              height: '16px',
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

        {/* Play/pause + speed + like + favorite + comment */}
        <View className='relative mt-2 flex items-center justify-center gap-4'>
          {/* Like */}
          <View onClick={() => void handleLike()} className='flex w-12 flex-col items-center gap-1'>
            <View style={{ height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Text
                className='material-symbols-outlined'
                style={{ fontSize: '22px', lineHeight: '24px', color: liked ? '#ba1a1a' : '#727879' }}
              >
                {liked ? 'favorite' : 'favorite_border'}
              </Text>
            </View>
            <Text className='text-xs text-outline'>
              {formatCount(likeCount)}
            </Text>
          </View>

          {/* Comment */}
          <View
            onClick={() => setDrawerOpen(true)}
            className='flex w-12 flex-col items-center gap-1'
          >
            <View style={{ height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Text
                className='material-symbols-outlined'
                style={{ fontSize: '22px', lineHeight: '24px', color: '#727879' }}
              >
                chat_bubble_outline
              </Text>
            </View>
            <Text className='text-xs text-outline'>
              {formatCount(commentCount)}
            </Text>
          </View>

          {/* Play/pause */}
          <View
            onClick={togglePlayPause}
            className='flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-primary shadow-lg active:scale-95'
            style={{ transition: 'transform 0.15s' }}
          >
            {isPlaying ? (
              <View style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <View style={{ width: '4px', height: '18px', borderRadius: '2px', backgroundColor: '#fff' }} />
                <View style={{ width: '4px', height: '18px', borderRadius: '2px', backgroundColor: '#fff' }} />
              </View>
            ) : (
              <View style={{
                width: 0, height: 0,
                borderTop: '9px solid transparent',
                borderBottom: '9px solid transparent',
                borderLeft: '14px solid #fff',
                marginLeft: '3px',
              }} />
            )}
          </View>

          {/* Favorite */}
          <View onClick={() => void handleFavorite()} className='flex w-12 flex-col items-center gap-1'>
            <View style={{ height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Text
                className='material-symbols-outlined'
                style={{ fontSize: '22px', lineHeight: '24px', color: favorited ? '#4d6265' : '#727879' }}
              >
                {favorited ? 'star' : 'star_border'}
              </Text>
            </View>
            <Text className='text-xs text-outline'>收藏</Text>
          </View>

          {/* Speed */}
          <View
            onClick={handleSpeedCycle}
            className='flex h-9 items-center justify-center rounded-full px-3 text-xs font-semibold text-on-surface-variant'
            style={{ border: '1px solid #c2c7c8' }}
          >
            <Text>{playbackRate}x</Text>
          </View>
        </View>
      </View>

      {/* Comment drawer */}
      <CommentDrawer
        podcastId={pod.id}
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        commentCount={commentCount}
        onCommentAdded={() => setCommentCount((c) => c + 1)}
        onCommentDeleted={() => setCommentCount((c) => Math.max(0, c - 1))}
        variant='desktop'
      />

      {/* Description modal */}
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
              maxWidth: '400px',
              width: '100%',
              maxHeight: '70vh',
              borderRadius: '16px',
              backgroundColor: '#fbf9f8',
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
              {pod.description}
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
