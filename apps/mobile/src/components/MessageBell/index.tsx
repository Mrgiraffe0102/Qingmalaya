import { useEffect, useState, useRef, useCallback, type CSSProperties } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, ScrollView } from '@tarojs/components'
import { useAuthStore } from '../../store/auth'
import { useIsDesktop } from '../AppLayout/useIsDesktop'
import {
  getUnreadCount,
  listNotifications,
  markAsRead,
  markAllRead,
} from '../../api/notifications'
import { formatRelativeTime } from '../../utils/format'
import { playPodcast } from '../../utils/play'
import type { NotificationItem, NotificationType } from '@qingmalaya/shared'

/** Glassmorphism spec matching the app's floating-island nav. */
const GLASS_STYLE: CSSProperties = {
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  backgroundColor: 'rgba(255,255,255,0.8)',
}

/** Polling interval for refreshing the unread badge. */
const POLL_INTERVAL_MS = 30_000

const TYPE_ICON: Record<NotificationType, string> = {
  BROADCAST: 'campaign',
  PODCAST_APPROVED: 'check_circle',
  PODCAST_REJECTED: 'cancel',
  PODCAST_LIKED: 'favorite',
  PODCAST_COMMENTED: 'chat_bubble',
}

const TYPE_ICON_COLOR: Record<NotificationType, string> = {
  BROADCAST: '#4d6265',
  PODCAST_APPROVED: '#2e7d32',
  PODCAST_REJECTED: '#ba1a1a',
  PODCAST_LIKED: '#e53935',
  PODCAST_COMMENTED: '#1976d2',
}

/**
 * Fixed message-bell icon shown at the top-right corner of every tab page.
 *
 * Polls `/notifications/unread-count` on mount and every 30s while the app is
 * active. Shows a red badge when unread > 0.
 *
 * Desktop: clicking opens a compact popup panel below the bell showing recent
 * notifications, with mark-all-read and per-item mark-as-read.
 * Mobile: clicking navigates to the full messages page.
 */
export default function MessageBell() {
  const token = useAuthStore((s) => s.token)
  const isDesktop = useIsDesktop()
  const [unread, setUnread] = useState(0)
  const [popupOpen, setPopupOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const containerRef = useRef<HTMLElement | null>(null)

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

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listNotifications(1, 20)
      setItems(res.items)
    } catch {
      // request.ts surfaces a toast.
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isDesktop && popupOpen) {
      void fetchNotifications()
    }
  }, [popupOpen, isDesktop, fetchNotifications])

  // Close popup on outside click
  useEffect(() => {
    if (!popupOpen) return
    const handler = (e: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPopupOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [popupOpen])

  if (!token) return null

  const handleClick = (): void => {
    if (isDesktop) {
      setPopupOpen((prev) => !prev)
    } else {
      Taro.navigateTo({ url: '/pages/messages/index' })
    }
  }

  const handleNotificationTap = (n: NotificationItem): void => {
    if (!n.read) {
      markAsRead(n.id).catch(() => {})
      setItems((prev) =>
        prev.map((item) =>
          item.id === n.id ? { ...item, read: true } : item,
        ),
      )
      setUnread((prev) => Math.max(0, prev - 1))
    }
    if (n.podcastId) {
      setPopupOpen(false)
      void playPodcast(n.podcastId)
    }
  }

  const handleMarkAllRead = async (): Promise<void> => {
    if (!items.some((n) => !n.read)) return
    try {
      await markAllRead()
      setItems((prev) => prev.map((n) => ({ ...n, read: true })))
      setUnread(0)
    } catch {
      // request.ts surfaces a toast.
    }
  }

  const bellClassName = isDesktop
    ? 'relative flex h-10 w-10 items-center justify-center rounded-full hover:bg-surface-container/60'
    : 'fixed top-4 right-4 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant/20 shadow-sm active:scale-90'

  const hasUnread = items.some((n) => !n.read)

  return (
    <View ref={containerRef as any} className={isDesktop ? 'relative' : ''}>
      <View
        className={bellClassName}
        style={isDesktop ? undefined : GLASS_STYLE}
        onClick={handleClick}
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

      {/* Desktop popup panel */}
      {isDesktop && popupOpen && (
        <View
          className='absolute right-0 top-full mt-2 overflow-hidden rounded-2xl bg-surface shadow-2xl'
          style={{
            width: '380px',
            maxHeight: '70vh',
            border: '1px solid rgba(114, 120, 121, 0.12)',
            zIndex: 60,
          }}
        >
          {/* Header */}
          <View className='flex items-center justify-between border-b border-outline-variant/20 px-4 py-3'>
            <Text className='text-base font-semibold text-on-surface'>
              消息
            </Text>
            {hasUnread && (
              <View
                onClick={() => void handleMarkAllRead()}
                className='flex h-7 items-center rounded-full bg-primary/10 px-3'
              >
                <Text
                  className='text-primary'
                  style={{ fontSize: '12px', fontWeight: '600' }}
                >
                  全部已读
                </Text>
              </View>
            )}
          </View>

          {/* Notification list */}
          <ScrollView scrollY style={{ maxHeight: '50vh' }}>
            {loading ? (
              <View className='flex items-center justify-center py-12'>
                <Text className='text-sm text-on-surface-variant'>加载中...</Text>
              </View>
            ) : items.length === 0 ? (
              <View className='flex flex-col items-center justify-center py-12'>
                <Text
                  className='material-symbols-outlined text-outline-variant'
                  style={{ fontSize: '40px' }}
                >
                  notifications_none
                </Text>
                <Text className='mt-2 text-sm text-on-surface-variant'>
                  暂无消息
                </Text>
              </View>
            ) : (
              <View className='flex flex-col'>
                {items.map((n) => (
                  <View
                    key={n.id}
                    onClick={() => handleNotificationTap(n)}
                    className='flex items-start gap-3 px-4 py-3'
                    style={{
                      borderBottom: '1px solid rgba(114, 120, 121, 0.08)',
                      backgroundColor: n.read ? 'transparent' : 'rgba(77, 98, 101, 0.04)',
                    }}
                  >
                    {/* Type icon */}
                    <View
                      className='flex h-9 w-9 shrink-0 items-center justify-center rounded-full'
                      style={{
                        backgroundColor: `${TYPE_ICON_COLOR[n.type]}15`,
                      }}
                    >
                      <Text
                        className='material-symbols-outlined'
                        style={{
                          fontSize: '18px',
                          color: TYPE_ICON_COLOR[n.type],
                          fontVariationSettings: '"FILL" 1',
                        }}
                      >
                        {TYPE_ICON[n.type]}
                      </Text>
                    </View>

                    {/* Content */}
                    <View className='min-w-0 flex-1'>
                      <View className='flex items-center justify-between gap-2'>
                        <Text
                          className='flex-1 truncate text-on-surface'
                          style={{
                            fontSize: '13px',
                            fontWeight: n.read ? '500' : '700',
                            opacity: n.read ? 0.7 : 1,
                          }}
                        >
                          {n.title}
                        </Text>
                        {!n.read && (
                          <View
                            className='shrink-0 rounded-full'
                            style={{
                              width: '8px',
                              height: '8px',
                              backgroundColor: '#ba1a1a',
                            }}
                          />
                        )}
                      </View>
                      <Text
                        className='mt-0.5 block text-on-surface-variant'
                        style={{ fontSize: '12px', lineHeight: '18px' }}
                      >
                        {n.content}
                      </Text>
                      <Text
                        className='mt-1 block text-outline-variant'
                        style={{ fontSize: '11px' }}
                      >
                        {formatRelativeTime(n.createdAt)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Footer: view all */}
          <View
            onClick={() => {
              setPopupOpen(false)
              Taro.navigateTo({ url: '/pages/messages/index' })
            }}
            className='flex items-center justify-center border-t border-outline-variant/20 py-3'
          >
            <Text
              className='text-primary'
              style={{ fontSize: '13px', fontWeight: '500' }}
            >
              查看全部消息
            </Text>
          </View>
        </View>
      )}
    </View>
  )
}
