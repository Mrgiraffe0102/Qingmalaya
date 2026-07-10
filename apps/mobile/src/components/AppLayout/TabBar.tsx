import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useIsDesktop } from './useIsDesktop'
import { usePlayerStore } from '../../store/player'

/** Keys for the four real tab pages. The "+" create button is never "selected". */
export type TabKey = 'discovery' | 'browse' | 'create' | 'profile'

interface TabDef {
  key: TabKey | 'upload'
  label: string
  icon: string // Material Symbols name
  path: string
  isTab: boolean // true → switchTab; false → navigateTo (upload page)
  isCreate: boolean // the "+" button
}

const TABS: TabDef[] = [
  { key: 'discovery', label: '发现', icon: 'explore', path: '/pages/discovery/index', isTab: true, isCreate: false },
  { key: 'browse', label: '浏览', icon: 'search', path: '/pages/browse/index', isTab: true, isCreate: false },
  { key: 'upload', label: '+', icon: 'add', path: '/pages/upload/index', isTab: false, isCreate: true },
  { key: 'create', label: '创作', icon: 'mic', path: '/pages/create/index', isTab: true, isCreate: false },
  { key: 'profile', label: '我的', icon: 'person', path: '/pages/profile/index', isTab: true, isCreate: false },
]

/** Glassmorphism spec from DESIGN.md: 20px backdrop-blur + 80% white fill. */
const GLASS_STYLE: React.CSSProperties = {
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  backgroundColor: 'rgba(255,255,255,0.8)',
}

function navigate(tab: TabDef) {
  if (tab.isTab) {
    Taro.switchTab({ url: tab.path })
  } else {
    Taro.navigateTo({ url: tab.path })
  }
}

interface TabBarProps {
  currentTab: TabKey
}

/**
 * Custom floating-island nav (mobile) / top menu bar (desktop).
 * Replaces Taro's native tabBar (hidden via CSS in app.css) so we get the
 * glassmorphic detached-container look from DESIGN.md.
 */
export default function TabBar({ currentTab }: TabBarProps) {
  const isDesktop = useIsDesktop()
  const hasPodcast = usePlayerStore((s) => s.currentPodcast !== null)

  if (isDesktop) {
    // Inline nav items rendered inside AppLayout's top bar (no outer container).
    // Left side: 发现 / 浏览 / 创作 / 我的 + "上传作品" button.
    return (
      <View className='flex items-center gap-1'>
        {TABS.filter((t) => !t.isCreate).map((tab) => {
          const isSelected = tab.key === currentTab
          return (
            <View
              key={tab.key}
              onClick={() => navigate(tab)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                isSelected
                  ? 'bg-primary text-on-primary'
                  : 'text-primary/60 hover:text-primary'
              }`}
            >
              {tab.label}
            </View>
          )
        })}
        <View
          onClick={() => navigate(TABS.find((t) => t.isCreate)!)}
          className='ml-2 flex items-center gap-1 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-on-primary'
        >
          <Text className='material-symbols-outlined' style={{ fontSize: '18px' }}>
            upload
          </Text>
          上传作品
        </View>
      </View>
    )
  }

  // Mobile: pill-shaped floating nav bar matching 移动端UI参考 design.
  // When a podcast is playing, the PlaybackBar sits directly above this bar.
  // Flatten the top corners and remove the top border so the two bars fuse
  // into one continuous glass element.
  const radiusClass = hasPodcast ? 'rounded-b-xl' : 'rounded-full'
  const borderClass = hasPodcast ? 'border-x border-b' : 'border'

  return (
    <View
      className={`fixed bottom-4 left-4 right-4 z-50 flex h-16 items-center justify-around ${radiusClass} ${borderClass} border-outline-variant/20 px-2 shadow-sm`}
      style={GLASS_STYLE}
    >
      {TABS.map((tab) => {
        const isSelected = tab.key === currentTab
        if (tab.isCreate) {
          return (
            <View
              key={tab.key}
              onClick={() => navigate(tab)}
              className='-mt-2 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-lg active:scale-90'
            >
              <Text className='material-symbols-outlined' style={{ fontSize: '32px' }}>
                {tab.icon}
              </Text>
            </View>
          )
        }
        return (
          <View
            key={tab.key}
            onClick={() => navigate(tab)}
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full active:scale-95 ${
              isSelected ? 'bg-primary/10 text-primary' : 'text-on-surface-variant'
            }`}
          >
            <Text
              className='material-symbols-outlined'
              style={{
                fontSize: '28px',
                fontVariationSettings: isSelected ? '"FILL" 1' : undefined,
              }}
            >
              {tab.icon}
            </Text>
          </View>
        )
      })}
    </View>
  )
}
