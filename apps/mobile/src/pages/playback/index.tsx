import { useEffect, useRef, useState, useCallback, useMemo, type CSSProperties } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import { useAuthRedirect } from '../../utils/route-guard'
import { usePlayerStore, setSeeking } from '../../store/player'
import { get, post, del } from '../../utils/request'
import { coverUrl, formatDuration, formatCount } from '../../utils/format'
import CommentDrawer from '../../components/CommentDrawer'
import AMLLBackground from '../../components/AMLLBackground'
import FluidBackground from '../../components/FluidBackground'
import type { PodcastWithRelations, Class, TagColor, TranscriptResponse } from '@qingmalaya/shared'

/**
 * Playback detail page.
 *
 * Layout: flex column —
 *  1. Top bar (back + share)
 *  2. Frosted glass info island (cover thumbnail + author/class/tags + transcript button)
 *  3. Middle transcript area (auto-scrolling, white text with text-shadow)
 *  4. Player controls (progress + play/pause + speed)
 *  5. Bottom action bar (like/comment/favorite)
 *  6. Comment drawer overlay
 *  7. Full transcript modal overlay
 */

const SPEEDS = [0.75, 1, 1.25, 1.5, 2]

/** Tag chip palette — bright text colors for dark backgrounds (no background capsule). */
const TAG_COLORS: Record<TagColor, string> = {
  mint: '#5ccb8f',
  purple: '#b388ff',
  orange: '#ffb74d',
  rose: '#ff80ab',
  sky: '#64b5f6',
  teal: '#4db6ac',
  indigo: '#7c8dff',
  amber: '#ffd54f',
}

/** Frosted glass style for the info island bar. */
const FROSTED_GLASS: CSSProperties = {
  backdropFilter: 'blur(16px) saturate(1.2)',
  WebkitBackdropFilter: 'blur(16px) saturate(1.2)',
  backgroundColor: 'rgba(255, 255, 255, 0.15)',
  borderRadius: '16px',
  border: '1px solid rgba(255, 255, 255, 0.2)',
}

/** Frosted glass for the full transcript modal. */
const MODAL_GLASS: CSSProperties = {
  backdropFilter: 'blur(20px) saturate(1.2)',
  WebkitBackdropFilter: 'blur(20px) saturate(1.2)',
  backgroundColor: 'rgba(30, 30, 30, 0.85)',
  borderRadius: '16px',
  border: '1px solid rgba(255, 255, 255, 0.15)',
}

/** Inline Material Symbols icon. */
function Icon({ name, style }: { name: string; style?: CSSProperties }) {
  return (
    <Text className='material-symbols-outlined' style={{ fontSize: '18px', ...style }}>
      {name}
    </Text>
  )
}

export default function Playback() {
  const ok = useAuthRedirect()

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

  // --- Local slider drag value ---
  const [dragValue, setDragValue] = useState<number | null>(null)

  // --- Transcript state ---
  const [transcript, setTranscript] = useState<TranscriptResponse | null>(null)
  const [showFullTranscript, setShowFullTranscript] = useState(false)
  const [scrollTarget, setScrollTarget] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

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

  const trackRef = useRef<HTMLElement | null>(null)
  const draggingRef = useRef(false)

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

  // --- Fetch transcript status on mount ---
  useEffect(() => {
    if (!ok || !podcastId) return
    get<TranscriptResponse>(`/podcasts/${podcastId}/transcript`, { silent: true })
      .then((res) => {
        setTranscript(res)
        // If already processing, start polling
        if (res.status === 'processing') {
          startPolling()
        }
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ok, podcastId])

  // --- Cleanup polling on unmount ---
  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [])

  // --- Polling logic ---
  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const res = await get<TranscriptResponse>(
          `/podcasts/${podcastId}/transcript`,
          { silent: true },
        )
        setTranscript(res)
        if (res.status === 'ready' || res.status === 'failed') {
          if (pollRef.current) {
            clearInterval(pollRef.current)
            pollRef.current = null
          }
        }
      } catch {
        // Ignore polling errors
      }
    }, 3000)
  }, [podcastId])

  // --- Current transcript segment (based on playback position) ---
  const currentSegmentIndex = useMemo(() => {
    if (!transcript?.segments || transcript.segments.length === 0) return -1
    const pos = position
    for (let i = 0; i < transcript.segments.length; i++) {
      const seg = transcript.segments[i]
      if (pos >= seg.beginTime && pos < seg.endTime) return i
    }
    // Past all segments → highlight last
    const last = transcript.segments.length - 1
    if (pos >= transcript.segments[last].endTime) return last
    return -1
  }, [transcript, position])

  // --- Auto-scroll to current segment ---
  useEffect(() => {
    if (currentSegmentIndex >= 0) {
      setScrollTarget(`segment-${currentSegmentIndex}`)
    }
  }, [currentSegmentIndex])

  // --- Generate transcript ---
  const handleGenerateTranscript = useCallback(async (): Promise<void> => {
    if (!podcastId) return
    try {
      await post(`/podcasts/${podcastId}/transcript`)
      setTranscript({ status: 'processing' })
      startPolling()
    } catch {
      // Error toast handled by request wrapper
    }
  }, [podcastId, startPolling])

  // --- Copy full transcript ---
  const handleCopyTranscript = useCallback((): void => {
    if (!transcript?.fullText) return
    Taro.setClipboardData({
      data: transcript.fullText,
      success: () => Taro.showToast({ title: '已复制文稿', icon: 'success' }),
    })
  }, [transcript])

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

  // --- Progress bar pointer events ---
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
      data: podcast ? `${podcast.title} - 万卷回响` : '万卷回响',
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
  const maxContentWidth = '428px'

  return (
    <View
      className={`flex h-screen flex-col overflow-hidden ${animClass}`}
      style={{ willChange: 'transform', position: 'relative' }}
    >
      {process.env.TARO_ENV === 'h5' ? (
        <AMLLBackground src={cover} />
      ) : (
        <FluidBackground src={cover} />
      )}

      {/* ---- Top bar: back + share ---- */}
      <View
        className='relative z-10 flex flex-shrink-0 items-center justify-between px-4 pb-1 pt-3'
      >
        <View
          onClick={handleBack}
          className='flex h-10 w-10 items-center justify-center rounded-full text-inverse-on-surface'
        >
          <Icon name='expand_more' style={{ fontSize: '22px' }} />
        </View>
        <View
          onClick={handleShare}
          className='flex h-10 w-10 items-center justify-center rounded-full text-inverse-on-surface'
        >
          <Icon name='share' style={{ fontSize: '20px' }} />
        </View>
      </View>

      {/* ---- Frosted glass info island: cover + author/class/tags ---- */}
      <View
        className='relative z-10 mx-auto mb-2 w-full flex-shrink-0 px-4'
        style={{ maxWidth: maxContentWidth }}
      >
        <View style={FROSTED_GLASS} className='flex items-center gap-3 p-2.5'>
          {/* Cover thumbnail */}
          {cover ? (
            <Image
              src={cover}
              mode='aspectFill'
              className='flex-shrink-0 rounded-lg'
              style={{ width: '44px', height: '44px' }}
            />
          ) : (
            <View
              className='flex flex-shrink-0 items-center justify-center rounded-lg bg-primary/30'
              style={{ width: '44px', height: '44px' }}
            >
              <Text className='text-lg font-bold text-on-primary-container'>
                {(podcast.title || '?').charAt(0)}
              </Text>
            </View>
          )}

          {/* Author + class + tags */}
          <View className='flex min-w-0 flex-1 flex-col gap-0.5'>
            {/* Title */}
            <Text
              className='truncate text-sm font-bold text-white'
              style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
            >
              {podcast.title}
            </Text>
            {/* Author + class */}
            <View className='flex items-center gap-1.5 overflow-hidden'>
              <Text
                className='flex-shrink-0 text-xs text-white/80'
                style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
              >
                {podcast.author.name}
              </Text>
              {authorClass && (
                <Text
                  className='flex-shrink-0 text-xs font-medium text-white/90'
                  style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                >
                  {authorClass}
                </Text>
              )}
              {podcast.author.role === 'TEACHER' && (
                <Text
                  className='flex-shrink-0 text-xs font-medium text-white/90'
                  style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                >
                  教师
                </Text>
              )}
              {podcast.tags.length > 0 && (
                <View className='flex flex-1 flex-wrap items-center gap-1 overflow-hidden'>
                  {podcast.tags.slice(0, 2).map((tag) => {
                    const color = TAG_COLORS[tag.color] || TAG_COLORS.mint
                    return (
                      <Text
                        key={tag.id}
                        className='flex-shrink-0 text-xs font-medium'
                        style={{ color, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                      >
                        #{tag.name}
                      </Text>
                    )
                  })}
                  {podcast.tags.length > 2 && (
                    <Text className='text-xs text-white/60'>
                      +{podcast.tags.length - 2}
                    </Text>
                  )}
                </View>
              )}
            </View>
          </View>

          {/* Full transcript button — only when transcript is ready */}
          {transcript?.status === 'ready' && (
            <View
              onClick={() => setShowFullTranscript(true)}
              className='flex flex-shrink-0 items-center justify-center rounded-full bg-white/20 px-2.5 py-1.5 active:scale-95'
              style={{ transition: 'transform 0.15s' }}
            >
              <Icon name='description' style={{ fontSize: '16px', color: '#fff' }} />
            </View>
          )}
        </View>
      </View>

      {/* ---- Middle: transcript area ---- */}
      <ScrollView
        scrollY
        scrollIntoView={scrollTarget}
        className='relative z-10 flex-1'
        style={{ minHeight: 0 }}
      >
        <View
          className='mx-auto flex flex-col px-5'
          style={{ maxWidth: maxContentWidth, minHeight: '100%' }}
        >
          {transcript?.status === 'ready' && transcript.segments && transcript.segments.length > 0 ? (
            <View className='py-4'>
              {transcript.segments.map((seg, i) => (
                <Text
                  key={seg.sentenceId}
                  // @ts-ignore — id works on H5 and WeApp
                  id={`segment-${i}`}
                  className='block py-1 leading-relaxed'
                  style={{
                    color: '#ffffff',
                    textShadow: '0 1px 4px rgba(0,0,0,0.6)',
                    opacity: i === currentSegmentIndex ? 1 : 0.4,
                    fontSize: i === currentSegmentIndex ? '17px' : '15px',
                    fontWeight: i === currentSegmentIndex ? '600' : '400',
                    transition: 'opacity 0.3s, font-size 0.3s, font-weight 0.3s',
                  }}
                >
                  {seg.text}
                </Text>
              ))}
            </View>
          ) : transcript?.status === 'processing' ? (
            <View className='flex flex-1 flex-col items-center justify-center gap-3 py-8'>
              <View
                className='h-6 w-6 animate-spin rounded-full'
                style={{
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#ffffff',
                }}
              />
              <Text
                className='text-sm text-white/70'
                style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}
              >
                AI文稿识别中...
              </Text>
              <Text
                className='text-xs text-white/50'
                style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}
              >
                长音频转写可能需要1-2分钟
              </Text>
            </View>
          ) : transcript?.status === 'failed' ? (
            <View className='flex flex-1 flex-col items-center justify-center gap-4 py-8'>
              <Text
                className='text-sm text-white/70'
                style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}
              >
                文稿识别失败
              </Text>
              <View
                onClick={() => void handleGenerateTranscript()}
                className='rounded-full bg-white/20 px-5 py-2 active:scale-95'
                style={{ transition: 'transform 0.15s' }}
              >
                <Text className='text-sm font-medium text-white'>重试</Text>
              </View>
            </View>
          ) : (
            <View className='flex flex-1 flex-col items-center justify-center gap-4 py-8'>
              <View
                className='flex h-14 w-14 items-center justify-center rounded-full bg-white/15'
                style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
              >
                <Icon name='auto_awesome' style={{ fontSize: '28px', color: '#fff' }} />
              </View>
              <Text
                className='text-sm text-white/70'
                style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}
              >
                暂无AI文稿
              </Text>
              <View
                onClick={() => void handleGenerateTranscript()}
                className='rounded-full bg-white/20 px-5 py-2 active:scale-95'
                style={{ transition: 'transform 0.15s' }}
              >
                <Text className='text-sm font-medium text-white'>生成AI文稿</Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ---- Controls: progress + play/pause + speed ---- */}
      <View
        className='relative z-10 mx-auto w-full flex-shrink-0 px-5 pb-2 pt-3'
        style={{ maxWidth: maxContentWidth }}
      >
        {/* Progress bar */}
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
              backgroundColor: 'rgba(255, 255, 255, 0.28)',
            }}
          />
          <View
            style={{
              position: 'absolute',
              left: 0,
              height: '4px',
              borderRadius: '2px',
              backgroundColor: '#ffffff',
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
              backgroundColor: '#ffffff',
              transform: 'translateX(-50%)',
              boxShadow: '0 0 6px rgba(0,0,0,0.4)',
            }}
          />
        </View>
        <View className='flex justify-between px-1'>
          <Text className='text-xs text-inverse-on-surface'>
            {formatDuration(position)}
          </Text>
          <Text className='text-xs text-inverse-on-surface'>
            {formatDuration(effectiveDuration)}
          </Text>
        </View>

        {/* Play/pause + speed */}
        <View className='relative mt-2 flex items-center justify-center'>
          <View
            onClick={handleTogglePlay}
            className='flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full shadow-lg active:scale-95'
            style={{ transition: 'transform 0.15s', backgroundColor: '#ffffff' }}
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
                    height: '20px',
                    borderRadius: '2px',
                    backgroundColor: '#1b1c1c',
                  }}
                />
                <View
                  style={{
                    width: '5px',
                    height: '20px',
                    borderRadius: '2px',
                    backgroundColor: '#1b1c1c',
                  }}
                />
              </View>
            ) : (
              <View
                style={{
                  width: 0,
                  height: 0,
                  borderTop: '10px solid transparent',
                  borderBottom: '10px solid transparent',
                  borderLeft: '16px solid #1b1c1c',
                  marginLeft: '4px',
                }}
              />
            )}
          </View>

          <View
            onClick={handleSpeedCycle}
            className='absolute right-0 flex h-9 items-center justify-center rounded-full px-3 text-sm font-semibold text-inverse-on-surface'
            style={{ border: '1px solid rgba(255, 255, 255, 0.5)' }}
          >
            <Text>{speedLabel}</Text>
          </View>
        </View>
      </View>

      {/* ---- Bottom action bar: like / comment / favorite ---- */}
      <View
        className='relative z-10 mx-auto flex w-full flex-shrink-0 items-center justify-around border-t border-white/15 px-5 py-2.5'
        style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom))', maxWidth: maxContentWidth }}
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
              style={{ color: liked ? '#ff5252' : '#f2f0f0' }}
            >
              {liked ? '♥' : '♡'}
            </Text>
          </View>
          <Text className='text-xs text-inverse-on-surface'>
            {formatCount(likeCount)}
          </Text>
        </View>

        {/* Comment */}
        <View
          onClick={() => setDrawerOpen(true)}
          className='flex flex-col items-center gap-1'
        >
          <Icon name='chat_bubble_outline' style={{ fontSize: '24px', color: '#f2f0f0' }} />
          <Text className='text-xs text-inverse-on-surface'>
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
            style={{ color: favorited ? '#ffd54f' : '#f2f0f0' }}
          >
            {favorited ? '★' : '☆'}
          </Text>
          <Text className='text-xs text-inverse-on-surface'>收藏</Text>
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

      {/* ---- Full transcript modal ---- */}
      {showFullTranscript && (
        <View
          className='fixed inset-0 z-50 flex items-center justify-center p-4'
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
          onClick={() => setShowFullTranscript(false)}
        >
          <View
            style={MODAL_GLASS}
            className='flex max-h-[75vh] w-full flex-col overflow-hidden p-4'
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <View className='mb-3 flex items-center justify-between'>
              <Text className='text-base font-bold text-white'>完整文稿</Text>
              <View className='flex items-center gap-2'>
                <View
                  onClick={handleCopyTranscript}
                  className='flex items-center gap-1 rounded-full bg-white/20 px-3 py-1.5 active:scale-95'
                  style={{ transition: 'transform 0.15s' }}
                >
                  <Icon name='content_copy' style={{ fontSize: '14px', color: '#fff' }} />
                  <Text className='text-xs font-medium text-white'>复制</Text>
                </View>
                <View
                  onClick={() => setShowFullTranscript(false)}
                  className='flex h-7 w-7 items-center justify-center rounded-full bg-white/20'
                >
                  <Icon name='close' style={{ fontSize: '16px', color: '#fff' }} />
                </View>
              </View>
            </View>

            {/* Scrollable text */}
            <ScrollView scrollY className='flex-1' style={{ minHeight: 0 }}>
              <Text
                className='text-sm leading-relaxed text-white/90'
                style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
              >
                {transcript?.fullText}
              </Text>
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  )
}
