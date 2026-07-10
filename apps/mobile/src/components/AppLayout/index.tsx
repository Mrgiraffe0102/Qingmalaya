import { View } from '@tarojs/components'
import type { CSSProperties, ReactNode } from 'react'
import TabBar, { type TabKey } from './TabBar'
import PlaybackBar from './PlaybackBar'
import MessageBell from '../MessageBell'
import DesktopPlayerPanel from './DesktopPlayerPanel'
import { useIsDesktop } from './useIsDesktop'
import { usePlayerStore } from '../../store/player'

interface AppLayoutProps {
  children: ReactNode
  /** Which tab page is currently active. The "+" create button is never selected. */
  currentTab: TabKey
  /** Hide the floating TabBar and MessageBell (used on detail pages that have
   *  their own back button, e.g. collection, markdown, messages). */
  hideChrome?: boolean
}

/** Glassmorphism spec from DESIGN.md: 20px backdrop-blur + 80% white fill. */
const GLASS_STYLE: CSSProperties = {
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  backgroundColor: 'rgba(255,255,255,0.8)',
}

/**
 * Page-level layout shell. Renders the custom floating-island nav (or desktop
 * top menu) plus the integrated playback bar, and pads page content so it
 * isn't hidden behind the fixed chrome. Each tab page wraps its content with
 * `<AppLayout currentTab="...">`.
 *
 * Desktop layout: a fixed top bar (nav left, mini-player + bell right) sits
 * above a two-column split — left column is phone-width page content, right
 * column is the DesktopPlayerPanel. The top bar and right panel are always
 * visible on desktop, even when `hideChrome` is set (detail pages still get
 * the global nav and player).
 */
export default function AppLayout({ children, currentTab, hideChrome }: AppLayoutProps) {
  const isDesktop = useIsDesktop()
  const hasPodcast = usePlayerStore((s) => s.currentPodcast !== null)

  // --- Desktop: split layout with persistent top bar + right player panel ---
  if (isDesktop) {
    return (
      <View className='flex min-h-screen flex-col bg-surface'>
        {/* Top bar: nav (left) + mini player + bell (right) */}
        <View
          className='fixed left-0 right-0 top-0 z-50 flex h-14 items-center justify-between px-6 shadow-sm'
          style={GLASS_STYLE}
        >
          <TabBar currentTab={currentTab} />
          <View className='flex items-center gap-3'>
            <PlaybackBar />
            <MessageBell />
          </View>
        </View>

        {/* Split content — 50/50 columns, each scrolls independently */}
        <View className='flex flex-1 pt-14' style={{ height: '100vh' }}>
          <View
            className='flex-1 overflow-y-auto border-r border-outline-variant/20 tab-page-enter'
            style={{ height: 'calc(100vh - 56px)' }}
          >
            {children}
          </View>
          <View
            className='flex-1 overflow-y-auto'
            style={{ height: 'calc(100vh - 56px)' }}
          >
            <DesktopPlayerPanel />
          </View>
        </View>
      </View>
    )
  }

  // --- Mobile: floating island nav + bottom playback bar ---
  // Pad content clear of the fixed nav. Mobile chrome sits at the bottom
  // (island + optional playback bar stacked above it).
  // When hideChrome is set, the TabBar, MessageBell AND PlaybackBar are all
  // hidden — detail pages manage their own layout and back nav.
  const padClass = hideChrome
    ? ''
    : hasPodcast
      ? 'pb-40'
      : 'pb-24'

  return (
    <View className={`min-h-screen bg-surface ${padClass}`}>
      <View className='tab-page-enter'>
        {children}
      </View>
      {!hideChrome && <PlaybackBar />}
      {!hideChrome && <TabBar currentTab={currentTab} />}
      {!hideChrome && currentTab === 'discovery' && <MessageBell />}
    </View>
  )
}
