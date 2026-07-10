import { View } from '@tarojs/components'
import type { ReactNode } from 'react'
import TabBar, { type TabKey } from './TabBar'
import PlaybackBar from './PlaybackBar'
import MessageBell from '../MessageBell'
import { useIsDesktop } from './useIsDesktop'
import { usePlayerStore } from '../../store/player'

interface AppLayoutProps {
  children: ReactNode
  /** Which tab page is currently active. The "+" create button is never selected. */
  currentTab: TabKey
}

/**
 * Page-level layout shell. Renders the custom floating-island nav (or desktop
 * top menu) plus the integrated playback bar, and pads page content so it
 * isn't hidden behind the fixed chrome. Each tab page wraps its content with
 * `<AppLayout currentTab="...">`.
 */
export default function AppLayout({ children, currentTab }: AppLayoutProps) {
  const isDesktop = useIsDesktop()
  const hasPodcast = usePlayerStore((s) => s.currentPodcast !== null)

  // Pad content clear of the fixed nav. Desktop chrome sits at the top
  // (menu + optional playback bar); mobile chrome sits at the bottom
  // (island + optional playback bar stacked above it).
  const padClass = isDesktop
    ? hasPodcast
      ? 'pt-36'
      : 'pt-20'
    : hasPodcast
      ? 'pb-40'
      : 'pb-24'

  return (
    <View className={`min-h-screen bg-surface ${padClass}`}>
      {children}
      <PlaybackBar />
      <TabBar currentTab={currentTab} />
      <MessageBell />
    </View>
  )
}
