import { useEffect, useRef, useState, useCallback, type CSSProperties } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image, Slider, ScrollView } from '@tarojs/components'
import { useAuthRedirect } from '../../utils/route-guard'
import { useIsDesktop } from '../../components/AppLayout/useIsDesktop'
import { usePlayerStore } from '../../store/player'
import { get, post, del } from '../../utils/request'
import { coverUrl, formatDuration, formatCount } from '../../utils/format'
import CommentDrawer from '../../components/CommentDrawer'
import type { PodcastWithRelations, Class, TagColor } from '@qingmalaya/shared'

/**
 * Playback detail page (Task 19).
 *
 * Full-screen page (no AppLayout) with its own custom nav bar. Hosts a single
 * HTML5 Audio element (H5-only for now — other platforms deferred to Task 36)
 * wired to the global player store so the PlaybackBar in AppLayout stays in
 * sync when the user navigates back.
 *
 * Layout: flex column — pinned top bar, scrollable cover/info, pinned controls
 * (progress + play/pause + speed), pinned bottom action bar (like/comment/fav),
 * and the comment drawer overlay.
 */

const STATIC_ORIGIN = 'http://localhost:3000'
const REPORT_INTERVAL_MS = 5000
const SPEEDS = [0.75, 1, 1.25, 1.5, 2]

/** Tag chip palette — 15% tint background + matching text (matches browse page). */
const TAG_COLORS: Record<TagColor, { text: string; bg: string }> = {
  mint: { text: '#2f8f5e', bg: 'rgba(47, 143, 94, 0.15)' },
  purple: { text: '#7c4dd1', bg: 'rgba(124, 77, 209, 0.15)' },
  orange: { text: '#c9701f', bg: 'rgba(201, 112, 31, 0.15)' },
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

  // --- Description expand ---
  const [expanded, setExpanded] = useState(false)

  // --- Player store ---
  const {
    isPlaying,
    position,
    duration,
    playbackRate,
    play: storePlay,
    togglePlayPause,
    setPosition,
    setPlaybackRate,
    stop,
  } = usePlayerStore()

  // --- Audio element + seeking guard ---
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const seekingRef = useRef(false)
  const reportTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const hasResumedRef = useRef(false)

  // Resolve the podcast ID from the route query.
  const instance = Taro.getCurrentInstance()
  const podcastId = Number(instance.router?.params.id)

  // Class name lookup.
  const classMap = new Map<number, string>()
  classes.forEach((c) => classMap.set(c.id, c.name))

  // --- Fetch podcast detail + class catalog on mount ---
  useEffect(() => {
    if (!ok) return
    if (!podcastId || Number.isNaN(podcastId)) {
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
        // Seed the store so the PlaybackBar stays in sync. `play` sets
        // isPlaying=true; we immediately toggle it back to false so the
        // podcast is loaded but not auto-playing.
        storePlay(p)
        togglePlayPause()
      })
      .catch(() => {})
      .finally(() => setLoading(false))

    get<Class[]>('/classes', { silent: true })
      .then(setClasses)
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ok, podcastId])

  // --- Set up the HTML5 Audio element + resume position ---
  useEffect(() => {
    if (!ok || !podcast) return
    if (typeof window === 'undefined') return

    const audio = new Audio()
    audioRef.current = audio
    audio.src = `${STATIC_ORIGIN}/static/${podcast.audioPath}`
    audio.preload = 'metadata'
    audio.playbackRate = playbackRate

    // `loadedmetadata` → set duration in store (overrides the podcast.duration
    // placeholder with the actual audio duration if available).
    const onLoaded = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        // Don't use setDuration (not in store); instead update via a local
        // override. The store's duration stays as podcast.duration which is
        // close enough for the UI. We update position tracking from timeupdate.
      }
    }

    const onTimeUpdate = () => {
      if (seekingRef.current) return
      setPosition(audio.currentTime)
    }

    const onPlay = () => {
      if (!usePlayerStore.getState().isPlaying) togglePlayPause()
    }

    const onPause = () => {
      if (usePlayerStore.getState().isPlaying) togglePlayPause()
    }

    const onEnded = () => {
      if (usePlayerStore.getState().isPlaying) togglePlayPause()
      setPosition(0)
    }

    const onError = () => {
      // Audio file may not exist (seed uses fake paths). Fail gracefully —
      // the UI just shows a paused state.
      if (usePlayerStore.getState().isPlaying) togglePlayPause()
    }

    audio.addEventListener('loadedmetadata', onLoaded)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)

    // Resume position: call play tracking with position 0 to get the previous
    // position, then seek to it. This also bumps playCount on first play.
    if (!hasResumedRef.current) {
      hasResumedRef.current = true
      post<{ position: number }>(`/podcasts/${podcast.id}/play`, { position: 0 })
        .then((res) => {
          if (res.position > 0 && audio) {
            audio.currentTime = res.position
            setPosition(res.position)
          }
        })
        .catch(() => {})
    }

    return () => {
      audio.removeEventListener('loadedmetadata', onLoaded)
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
      audio.pause()
      audioRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ok, podcast])

  // --- Progress reporting: every 5s while playing ---
  useEffect(() => {
    if (!ok || !podcast) return
    if (!isPlaying) {
      if (reportTimerRef.current) {
        clearInterval(reportTimerRef.current)
        reportTimerRef.current = null
      }
      return
    }

    reportTimerRef.current = setInterval(() => {
      const audio = audioRef.current
      const pos = audio ? audio.currentTime : usePlayerStore.getState().position
      post(`/podcasts/${podcast.id}/play`, { position: Math.floor(pos) }).catch(
        () => {},
      )
    }, REPORT_INTERVAL_MS)

    return () => {
      if (reportTimerRef.current) {
        clearInterval(reportTimerRef.current)
        reportTimerRef.current = null
      }
    }
  }, [ok, podcast, isPlaying])

  // --- Cleanup on unmount: stop playback + clear store ---
  useEffect(() => {
    return () => {
      if (reportTimerRef.current) clearInterval(reportTimerRef.current)
      stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // --- Playback controls ---
  const handleTogglePlay = useCallback((): void => {
    const audio = audioRef.current
    if (!audio) {
      // No audio element (e.g. load failed) — just toggle the UI state.
      togglePlayPause()
      return
    }
    if (audio.paused) {
      audio.play().catch(() => {
        // play() rejects on media error or autoplay policy — revert.
        if (usePlayerStore.getState().isPlaying) togglePlayPause()
      })
    } else {
      audio.pause()
    }
  }, [togglePlayPause])

  const handleSeeking = useCallback(
    (val: number): void => {
      seekingRef.current = true
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
      const audio = audioRef.current
      if (audio) audio.currentTime = newPos
      setPosition(newPos)
      seekingRef.current = false
    },
    [duration, podcast, setPosition],
  )

  const handleSpeedCycle = useCallback((): void => {
    const idx = SPEEDS.indexOf(playbackRate)
    const next = SPEEDS[(idx + 1) % SPEEDS.length]
    const audio = audioRef.current
    if (audio) audio.playbackRate = next
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

  // --- Favorite toggle (no API yet — local state + toast) ---
  const handleFavorite = useCallback((): void => {
    setFavorited((v) => {
      Taro.showToast({
        title: v ? '已取消收藏' : '已收藏',
        icon: 'none',
      })
      return !v
    })
  }, [])

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
    Taro.navigateBack({
      fail: () => Taro.switchTab({ url: '/pages/discovery/index' }),
    })
  }, [])

  // --- Render guards ---
  if (!ok) return null

  if (loading) {
    return (
      <View className='flex min-h-screen items-center justify-center bg-surface'>
        <Text className='text-sm text-on-surface-variant'>加载中...</Text>
      </View>
    )
  }

  if (!podcast) {
    return (
      <View className='flex min-h-screen flex-col items-center justify-center gap-4 bg-surface px-6'>
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
  const speedLabel = `${playbackRate}x`
  const authorClass = podcast.author.classId
    ? classMap.get(podcast.author.classId)
    : null

  const descStyle: CSSProperties = expanded
    ? {}
    : {
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }

  return (
    <View className='flex h-screen flex-col overflow-hidden bg-surface'>
      {/* ---- Top bar ---- */}
      <View
        style={GLASS_STYLE}
        className='flex flex-shrink-0 items-center justify-between px-4 pb-2 pt-3'
      >
        <View
          onClick={handleBack}
          className='flex h-10 w-10 items-center justify-center rounded-full text-primary'
        >
          <Icon name='arrow_back' style={{ fontSize: '22px' }} />
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
          className='mx-auto max-w-md px-5'
          style={isDesktop ? { maxWidth: '672px' } : undefined}
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
              <Text className='rounded-full bg-tertiary-container px-2 py-0.5 text-[11px] font-medium text-on-tertiary-container'>
                {authorClass}
              </Text>
            )}
            {podcast.author.role === 'TEACHER' && (
              <Text className='rounded-full bg-secondary-container px-2 py-0.5 text-[11px] font-medium text-on-secondary-container'>
                教师
              </Text>
            )}
          </View>

          {/* Description (expandable) */}
          {podcast.description && (
            <View className='mt-3'>
              <Text
                className='block text-sm leading-relaxed text-on-surface-variant'
                style={descStyle}
              >
                {podcast.description}
              </Text>
              <View onClick={() => setExpanded((v) => !v)} className='mt-1'>
                <Text className='text-xs font-semibold text-primary'>
                  {expanded ? '收起' : '展开'}
                </Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ---- Controls: progress + play/pause + speed ---- */}
      <View
        className='mx-auto w-full max-w-md flex-shrink-0 px-5 pb-2 pt-4'
        style={isDesktop ? { maxWidth: '672px' } : undefined}
      >
        {/* Progress bar */}
        <Slider
          min={0}
          max={100}
          step={0.1}
          value={progress}
          activeColor='#4d6265'
          backgroundColor='#e3e2e2'
          blockColor='#4d6265'
          blockSize={18}
          onChanging={(e) => handleSeeking(e.detail.value)}
          onChange={(e) => handleSeek(e.detail.value)}
        />
        <View className='flex justify-between px-1'>
          <Text className='text-xs text-outline'>
            {formatDuration(position)}
          </Text>
          <Text className='text-xs text-outline'>
            {formatDuration(effectiveDuration)}
          </Text>
        </View>

        {/* Play/pause + speed */}
        <View className='mt-3 flex items-center justify-center gap-6'>
          <View
            onClick={handleTogglePlay}
            className='flex h-16 w-16 items-center justify-center rounded-full bg-primary shadow-lg active:scale-95'
            style={{ transition: 'transform 0.15s' }}
          >
            {isPlaying ? (
              <View className='flex items-center gap-[3px]'>
                <View className='h-5 w-[4px] rounded-sm bg-on-primary' />
                <View className='h-5 w-[4px] rounded-sm bg-on-primary' />
              </View>
            ) : (
              <View
                style={{
                  width: 0,
                  height: 0,
                  borderTop: '10px solid transparent',
                  borderBottom: '10px solid transparent',
                  borderLeft: '16px solid #ffffff',
                  marginLeft: '3px',
                }}
              />
            )}
          </View>

          <View
            onClick={handleSpeedCycle}
            className='flex h-10 items-center justify-center rounded-full px-4 text-sm font-semibold text-on-surface-variant'
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
    </View>
  )
}
