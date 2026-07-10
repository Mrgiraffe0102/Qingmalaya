import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import AppLayout from '../../components/AppLayout'
import PageContainer from '../../components/AppLayout/PageContainer'
import { useAuthRedirect } from '../../utils/route-guard'
import { get } from '../../utils/request'
import {
  coverUrl,
  formatDuration,
  formatCount,
  formatRelativeTime,
} from '../../utils/format'
import type {
  Paginated,
  PlayHistory,
  PodcastWithRelations,
} from '@qingmalaya/shared'

const PAGE_SIZE = 20

const CARD_STYLE: CSSProperties = {
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
  border: '1px solid rgba(114, 120, 121, 0.10)',
}

type HistoryItem = PlayHistory & { podcast: PodcastWithRelations }
interface HistoryResponse extends Paginated<HistoryItem> {}

function handleBack(): void {
  Taro.navigateBack({
    fail: () => Taro.switchTab({ url: '/pages/profile/index' }),
  })
}

function goToPodcast(id: number): void {
  Taro.navigateTo({ url: `/pages/playback/index?id=${id}` })
}

export default function HistoryPage() {
  const ok = useAuthRedirect()
  const [items, setItems] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(1)

  const fetchFirst = useCallback(async () => {
    setLoading(true)
    try {
      const res = await get<HistoryResponse>(
        `/users/me/history?page=1&pageSize=${PAGE_SIZE}`,
      )
      setItems(res.items)
      setHasMore(res.hasMore)
      setPage(1)
    } catch (err) {
      console.warn('[history] fetch failed', err)
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!ok) return
    fetchFirst()
  }, [ok, fetchFirst])

  Taro.useDidShow(() => {
    if (!ok) return
    fetchFirst()
  })

  async function handleLoadMore() {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const next = page + 1
      const res = await get<HistoryResponse>(
        `/users/me/history?page=${next}&pageSize=${PAGE_SIZE}`,
      )
      setItems((prev) => [...prev, ...res.items])
      setHasMore(res.hasMore)
      setPage(next)
    } catch {
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoadingMore(false)
    }
  }

  if (!ok) return null

  if (loading) {
    return (
      <AppLayout currentTab='profile' hideChrome>
        <PageContainer>
          <View className='flex items-center px-4 pt-2'>
            <View
              onClick={handleBack}
              className='flex h-10 w-10 items-center justify-center rounded-full text-primary'
            >
              <Text className='material-symbols-outlined' style={{ fontSize: '22px' }}>
                arrow_back
              </Text>
            </View>
          </View>
          <View className='flex min-h-[60vh] items-center justify-center'>
            <Text className='text-sm text-on-surface-variant'>加载中...</Text>
          </View>
        </PageContainer>
      </AppLayout>
    )
  }

  return (
    <AppLayout currentTab='profile' hideChrome>
      <PageContainer>
        {/* Back button */}
        <View className='flex items-center px-4 pt-2'>
          <View
            onClick={handleBack}
            className='flex h-10 w-10 items-center justify-center rounded-full text-primary'
          >
            <Text className='material-symbols-outlined' style={{ fontSize: '22px' }}>
              arrow_back
            </Text>
          </View>
        </View>

        {/* Page title */}
        <View className='px-4 pt-2 pb-4'>
          <Text className='block text-xl font-bold tracking-tight text-primary'>
            播放历史
          </Text>
        </View>

        {/* History list */}
        {items.length === 0 ? (
          <View className='flex min-h-[50vh] items-center justify-center px-6'>
            <View className='text-center'>
              <Text style={{ fontSize: '48px' }}>🎧</Text>
              <Text
                className='mt-4 block text-on-surface-variant'
                style={{ fontSize: '14px' }}
              >
                还没有播放记录
              </Text>
              <Text
                className='mt-1 block text-outline'
                style={{ fontSize: '12px' }}
              >
                听过的播客会出现在这里
              </Text>
            </View>
          </View>
        ) : (
          <View className='flex flex-col gap-2 px-4 pb-10'>
            {items.map((item) => {
              const p = item.podcast
              return (
                <View
                  key={item.id}
                  onClick={() => goToPodcast(p.id)}
                  className='flex items-center gap-3 rounded-xl bg-surface-container-lowest p-2.5'
                  style={CARD_STYLE}
                >
                  <PodcastCover path={p.coverPath} title={p.title} />
                  <View className='min-w-0 flex-1'>
                    <Text className='block truncate text-sm font-medium text-on-surface'>
                      {p.title}
                    </Text>
                    <Text className='mt-0.5 block truncate text-xs text-on-surface-variant'>
                      {p.author.name}
                    </Text>
                    <View className='mt-1 flex items-center gap-2'>
                      <Text className='text-xs text-outline'>
                        {formatDuration(p.duration)}
                      </Text>
                      <Text className='text-xs text-outline'>
                        {formatCount(p.playCount)} 播放
                      </Text>
                    </View>
                    <Text
                      className='mt-0.5 block text-xs text-primary'
                      style={{ fontSize: '11px' }}
                    >
                      {formatRelativeTime(item.playedAt)}听过
                    </Text>
                  </View>
                </View>
              )
            })}

            {/* Load more */}
            {hasMore && (
              <View
                onClick={handleLoadMore}
                className='flex items-center justify-center py-4'
              >
                <Text className='text-sm text-primary'>
                  {loadingMore ? '加载中...' : '加载更多'}
                </Text>
              </View>
            )}
            {!hasMore && items.length >= PAGE_SIZE && (
              <View className='flex items-center justify-center py-4'>
                <Text className='text-xs text-outline'>没有更多了</Text>
              </View>
            )}
          </View>
        )}
      </PageContainer>
    </AppLayout>
  )
}

function PodcastCover({ path, title }: { path: string; title: string }) {
  const url = coverUrl(path)
  if (url) {
    return (
      <Image
        src={url}
        className='h-14 w-14 shrink-0 overflow-hidden rounded-lg'
        mode='aspectFill'
      />
    )
  }
  return (
    <View className='flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-primary/15'>
      <Text className='text-base text-on-primary-container font-semibold'>
        {(title || '?').charAt(0)}
      </Text>
    </View>
  )
}
