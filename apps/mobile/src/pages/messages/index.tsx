import { useEffect, useState, useCallback, type CSSProperties } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import AppLayout from '../../components/AppLayout'
import PageContainer from '../../components/AppLayout/PageContainer'
import { useAuthRedirect } from '../../utils/route-guard'
import { formatRelativeTime } from '../../utils/format'
import {
  listNotifications,
  markAsRead,
  markAllRead,
} from '../../api/notifications'
import type { NotificationItem, NotificationType } from '@qingmalaya/shared'

const CARD_STYLE: CSSProperties = {
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
  border: '1px solid rgba(114, 120, 121, 0.10)',
}

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

function handleBack(): void {
  Taro.navigateBack({
    fail: () => Taro.switchTab({ url: '/pages/discovery/index' }),
  })
}

export default function MessagesPage() {
  const ok = useAuthRedirect()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasUnread, setHasUnread] = useState(false)

  const fetchFirst = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listNotifications(1, 20)
      setItems(res.items)
      setHasMore(res.hasMore)
      setPage(1)
      setHasUnread(res.items.some((n) => !n.read))
    } catch (err) {
      console.warn('[messages] fetch failed', err)
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!ok) return
    fetchFirst()
  }, [ok, fetchFirst])

  async function handleLoadMore() {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const next = page + 1
      const res = await listNotifications(next, 20)
      setItems((prev) => [...prev, ...res.items])
      setHasMore(res.hasMore)
      setPage(next)
    } catch {
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoadingMore(false)
    }
  }

  async function handleMarkAllRead() {
    if (!hasUnread) return
    try {
      await markAllRead()
      setItems((prev) => prev.map((n) => ({ ...n, read: true })))
      setHasUnread(false)
      Taro.showToast({ title: '已全部标记为已读', icon: 'none' })
    } catch {
      Taro.showToast({ title: '操作失败', icon: 'none' })
    }
  }

  async function handleTap(n: NotificationItem) {
    if (!n.read) {
      markAsRead(n.id).catch(() => {})
      setItems((prev) =>
        prev.map((item) =>
          item.id === n.id ? { ...item, read: true } : item,
        ),
      )
      setHasUnread((prev) => {
        const stillUnread = items.some(
          (item) => item.id !== n.id && !item.read,
        )
        return stillUnread
      })
    }
    if (n.podcastId) {
      Taro.navigateTo({ url: `/pages/playback/index?id=${n.podcastId}` })
    }
  }

  if (!ok) return null

  return (
    <AppLayout currentTab='discovery'>
      <PageContainer>
        {/* Header */}
        <View className='flex items-center justify-between px-4 pt-2'>
          <View className='flex items-center'>
            <View
              onClick={handleBack}
              className='flex h-10 w-10 items-center justify-center rounded-full text-primary'
            >
              <Text
                className='material-symbols-outlined'
                style={{ fontSize: '22px' }}
              >
                arrow_back
              </Text>
            </View>
            <Text
              className='ml-1 text-lg font-semibold text-on-surface'
              style={{ fontSize: '18px' }}
            >
              消息
            </Text>
          </View>
          {hasUnread && (
            <View
              onClick={handleMarkAllRead}
              className='flex h-8 items-center rounded-full bg-primary/10 px-3'
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

        {/* Content */}
        {loading ? (
          <View className='flex min-h-[60vh] items-center justify-center'>
            <Text className='text-sm text-on-surface-variant'>加载中...</Text>
          </View>
        ) : items.length === 0 ? (
          <View className='flex min-h-[60vh] flex-col items-center justify-center'>
            <Text
              className='material-symbols-outlined text-outline-variant'
              style={{ fontSize: '56px' }}
            >
              notifications_none
            </Text>
            <Text
              className='mt-3 text-on-surface-variant'
              style={{ fontSize: '14px' }}
            >
              暂无消息
            </Text>
          </View>
        ) : (
          <View className='flex flex-col gap-2 px-4 pb-10 pt-4'>
            {items.map((n) => (
              <View
                key={n.id}
                onClick={() => handleTap(n)}
                className='flex items-start gap-3 rounded-xl bg-surface-container-lowest p-3.5'
                style={{
                  ...CARD_STYLE,
                  opacity: n.read ? 0.7 : 1,
                }}
              >
                {/* Type icon */}
                <View
                  className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full'
                  style={{
                    backgroundColor: `${TYPE_ICON_COLOR[n.type]}15`,
                  }}
                >
                  <Text
                    className='material-symbols-outlined'
                    style={{
                      fontSize: '22px',
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
                        fontSize: '14px',
                        fontWeight: n.read ? '500' : '700',
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
                    className='mt-1 block text-on-surface-variant'
                    style={{ fontSize: '13px', lineHeight: '20px' }}
                  >
                    {n.content}
                  </Text>
                  <View className='mt-1.5 flex items-center gap-2'>
                    {n.actor && (
                      <Text
                        className='text-on-surface-variant'
                        style={{ fontSize: '12px' }}
                      >
                        {n.actor.name}
                      </Text>
                    )}
                    {n.podcastTitle && (
                      <>
                        {n.actor && (
                          <Text
                            className='text-outline-variant'
                            style={{ fontSize: '12px' }}
                          >
                            ·
                          </Text>
                        )}
                        <Text
                          className='flex-1 truncate text-on-surface-variant'
                          style={{ fontSize: '12px' }}
                        >
                          {n.podcastTitle}
                        </Text>
                      </>
                    )}
                    <Text
                      className='ml-auto shrink-0 text-outline-variant'
                      style={{ fontSize: '12px' }}
                    >
                      {formatRelativeTime(n.createdAt)}
                    </Text>
                  </View>
                </View>
              </View>
            ))}

            {/* Load more */}
            {hasMore && (
              <View
                onClick={handleLoadMore}
                className='flex items-center justify-center py-4'
              >
                <Text
                  className='text-primary'
                  style={{ fontSize: '13px', fontWeight: '500' }}
                >
                  {loadingMore ? '加载中...' : '加载更多'}
                </Text>
              </View>
            )}
          </View>
        )}
      </PageContainer>
    </AppLayout>
  )
}
