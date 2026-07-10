import { useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { usePlayerStore } from '../../store/player'
import { useIsDesktop } from './useIsDesktop'
import { coverUrl } from '../../utils/format'
import { post, del } from '../../utils/request'

/** Glassmorphism spec from DESIGN.md: 20px backdrop-blur + 80% white fill. */
const GLASS_STYLE: React.CSSProperties = {
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  backgroundColor: 'rgba(255,255,255,0.8)',
}

export default function PlaybackBar() {
  const isDesktop = useIsDesktop()
  const { currentPodcast, isPlaying, position, duration, togglePlayPause, setLiked } = usePlayerStore()
  const [likePending, setLikePending] = useState(false)

  if (!currentPodcast) return null

  const liked = !!currentPodcast.liked
  const progress = duration > 0 ? Math.min(100, (position / duration) * 100) : 0

  const openDetail = () => {
    Taro.navigateTo({ url: `/pages/playback/index?id=${currentPodcast.id}` })
  }

  const cover = (
    <Image
      src={coverUrl(currentPodcast.coverPath)}
      className='h-10 w-10 shrink-0 rounded-md bg-surface-container object-cover'
      mode='aspectFill'
    />
  )

  const meta = (
    <View className='min-w-0 flex-1'>
      <Text className='block truncate text-sm font-medium text-on-surface'>
        {currentPodcast.title}
      </Text>
      <Text className='block truncate text-xs text-on-surface-variant'>
        {currentPodcast.author.name}
      </Text>
    </View>
  )

  const playPauseBtn = (
    <View
      onClick={(e) => {
        // Stop propagation so tapping the control doesn't open the detail page.
        e.stopPropagation?.()
        togglePlayPause()
      }}
      className='flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary'
    >
      {isPlaying ? (
        // Pause icon (two bars) — inline styles because Tailwind flex/gap on
        // taro-view-core can stack the bars vertically instead of side-by-side.
        <View
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <View
            style={{
              width: '4px',
              height: '14px',
              borderRadius: '2px',
              backgroundColor: '#ffffff',
            }}
          />
          <View
            style={{
              width: '4px',
              height: '14px',
              borderRadius: '2px',
              backgroundColor: '#ffffff',
            }}
          />
        </View>
      ) : (
        // Play icon (triangle)
        <View
          style={{
            width: 0,
            height: 0,
            borderTop: '7px solid transparent',
            borderBottom: '7px solid transparent',
            borderLeft: '11px solid #ffffff',
            marginLeft: '2px',
          }}
        />
      )}
    </View>
  )

  const handleLike = async (e: { stopPropagation?: () => void }): Promise<void> => {
    e.stopPropagation?.()
    const pod = currentPodcast
    if (!pod || likePending) return
    const wasLiked = !!pod.liked
    const nextCount = pod.likeCount + (wasLiked ? -1 : 1)
    setLiked(!wasLiked, nextCount)
    setLikePending(true)
    try {
      if (wasLiked) {
        await del<{ liked: boolean; likeCount: number }>(`/podcasts/${pod.id}/like`)
      } else {
        await post<{ liked: boolean; likeCount: number }>(`/podcasts/${pod.id}/like`)
      }
    } catch {
      setLiked(wasLiked, pod.likeCount)
    } finally {
      setLikePending(false)
    }
  }

  const likeBtn = (
    <View
      onClick={handleLike}
      className='flex h-9 w-9 shrink-0 items-center justify-center text-xl'
      style={{ color: liked ? '#ba1a1a' : '#727879' }}
    >
      {liked ? '♥' : '♡'}
    </View>
  )

  // Progress bar pinned to the top edge of the bar.
  const progressBar = (
    <View
      className='absolute left-0 right-0 top-0 bg-outline-variant'
      style={{ height: '2px' }}
    >
      <View className='h-full bg-primary' style={{ width: `${progress}%` }} />
    </View>
  )

  if (isDesktop) {
    // Compact mini-player rendered inline inside AppLayout's top bar (right side).
    // Shows cover thumbnail + title + play/pause only — the full player is in
    // the DesktopPlayerPanel on the right column.
    return (
      <View
        className='flex items-center gap-2 rounded-full bg-surface-container/60 py-1 pl-1 pr-2'
      >
        <Image
          src={coverUrl(currentPodcast.coverPath)}
          className='h-8 w-8 shrink-0 rounded-full bg-surface-container object-cover'
          mode='aspectFill'
        />
        <Text className='max-w-[120px] truncate text-xs font-medium text-on-surface'>
          {currentPodcast.title}
        </Text>
        <View
          onClick={(e) => {
            e.stopPropagation?.()
            togglePlayPause()
          }}
          className='flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary'
        >
          {isPlaying ? (
            <View style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <View style={{ width: '3px', height: '10px', borderRadius: '1.5px', backgroundColor: '#fff' }} />
              <View style={{ width: '3px', height: '10px', borderRadius: '1.5px', backgroundColor: '#fff' }} />
            </View>
          ) : (
            <View style={{
              width: 0, height: 0,
              borderTop: '6px solid transparent',
              borderBottom: '6px solid transparent',
              borderLeft: '9px solid #fff',
              marginLeft: '2px',
            }} />
          )}
        </View>
      </View>
    )
  }

  // Mobile: sits above the floating island (bottom-4 + island h-14 + 8px gap ≈ 80px).
  // Bottom corners are flat so the bar fuses visually with the TabBar below
  // when a podcast is playing.
  return (
    <View
      className='fixed bottom-20 left-4 right-4 z-40 flex items-center gap-3 overflow-hidden rounded-t-xl px-3 py-2 shadow-md'
      style={GLASS_STYLE}
      onClick={openDetail}
    >
      {progressBar}
      {cover}
      {meta}
      {playPauseBtn}
      {likeBtn}
    </View>
  )
}
