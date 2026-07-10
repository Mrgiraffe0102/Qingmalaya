import { useEffect, useState, useRef, type CSSProperties } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { useAuthStore } from '../../store/auth'
import { useIsDesktop } from '../AppLayout/useIsDesktop'
import { getUnreadCount } from '../../api/notifications'

/** Glassmorphism spec matching the app's floating-island nav. */
const GLASS_STYLE: CSSProperties = {
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  backgroundColor: 'rgba(255,255,255,0.8)',
}

/** Polling interval for refreshing the unread badge. */
const POLL_INTERVAL_MS = 30_000

/**
 * Fixed message-bell icon shown at the top-right corner of every tab page.
 *
 * Polls `/notifications/unread-count` on mount and every 30s while the app is
 * active. Shows a red badge when unread > 0. Clicking navigates to the
 * messages page. Only rendered when the user is authenticated.
 */
export default function MessageBell() {
  const token = useAuthStore((s) => s.token)
  const isDesktop = useIsDesktop()
  const [unread, setUnread] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!token) return

    let cancelled = false

    async function fetchCount() {
      try {
        const count = await getUnreadCount()
        if (!cancelled) setUnread(count)
      } catch {
        // Silent — badge is decorative.
      }
    }

    fetchCount()
    timerRef.current = setInterval(fetchCount, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [token])

  if (!token) return null

  const positionClass = isDesktop
    ? 'fixed top-3 right-6 z-50'
    : 'fixed top-4 right-4 z-50'

  return (
    <View
      className={`${positionClass} flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant/20 shadow-sm active:scale-90`}
      style={GLASS_STYLE}
      onClick={() => Taro.navigateTo({ url: '/pages/messages/index' })}
    >
      <Text
        className='material-symbols-outlined text-primary'
        style={{ fontSize: '22px' }}
      >
        notifications
      </Text>
      {unread > 0 && (
        <View
          className='absolute flex items-center justify-center rounded-full'
          style={{
            minWidth: '18px',
            height: '18px',
            padding: '0 4px',
            top: '-2px',
            right: '-2px',
            backgroundColor: '#ba1a1a',
          }}
        >
          <Text
            className='text-white'
            style={{ fontSize: '10px', fontWeight: '700', lineHeight: '18px' }}
          >
            {unread > 99 ? '99+' : unread}
          </Text>
        </View>
      )}
    </View>
  )
}
