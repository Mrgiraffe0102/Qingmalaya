import { useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { usePlayerStore } from '../../store/player'
import { useIsDesktop } from './useIsDesktop'

/** Glassmorphism spec from DESIGN.md: 20px backdrop-blur + 80% white fill. */
const GLASS_STYLE: React.CSSProperties = {
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  backgroundColor: 'rgba(255,255,255,0.8)',
}

/** Resolve a cover path into a usable image src. */
function coverSrc(coverPath: string): string {
  if (/^https?:\/\//.test(coverPath)) return coverPath
  // Backend serves uploaded files under /static; prepend API origin on H5.
  if (coverPath.startsWith('/static')) return `http://localhost:3000${coverPath}`
  return coverPath
}

export default function PlaybackBar() {
  const isDesktop = useIsDesktop()
  const { currentPodcast, isPlaying, position, duration, togglePlayPause } = usePlayerStore()
  // Local like mirror — the real like API is wired up in a later task; we only
  // need optimistic UI here so the heart responds instantly.
  const [liked, setLiked] = useState(false)

  if (!currentPodcast) return null

  const progress = duration > 0 ? Math.min(100, (position / duration) * 100) : 0

  const openDetail = () => {
    Taro.navigateTo({ url: `/pages/playback/index?id=${currentPodcast.id}` })
  }

  const cover = (
    <Image
      src={coverSrc(currentPodcast.coverPath)}
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
        // Pause icon (two bars)
        <View className='flex items-center gap-[3px]'>
          <View className='h-3 w-[3px] rounded-sm bg-on-primary' />
          <View className='h-3 w-[3px] rounded-sm bg-on-primary' />
        </View>
      ) : (
        // Play icon (triangle)
        <View
          className='ml-0.5'
          style={{
            width: 0,
            height: 0,
            borderTop: '6px solid transparent',
            borderBottom: '6px solid transparent',
            borderLeft: '9px solid #ffffff',
          }}
        />
      )}
    </View>
  )

  const likeBtn = (
    <View
      onClick={(e) => {
        e.stopPropagation?.()
        setLiked((v) => !v)
      }}
      className='flex h-9 w-9 shrink-0 items-center justify-center text-xl'
      style={{ color: liked ? '#ba1a1a' : '#727879' }}
    >
      {liked ? '♥' : '♡'}
    </View>
  )

  // 1px primary progress bar pinned to the top edge of the bar.
  const progressBar = (
    <View className='absolute left-0 right-0 top-0 h-px bg-outline-variant'>
      <View className='h-full bg-primary' style={{ width: `${progress}%` }} />
    </View>
  )

  if (isDesktop) {
    // Sticky top bar, sitting just under the desktop menu (h-14 = 56px).
    return (
      <View
        className='fixed left-0 right-0 top-14 z-40 flex items-center gap-3 px-6 py-2 shadow-sm'
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

  // Mobile: sits above the floating island (bottom-4 + island h-14 + 8px gap ≈ 80px).
  return (
    <View
      className='fixed bottom-20 left-4 right-4 z-40 flex items-center gap-3 rounded-xl px-3 py-2 shadow-md'
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
