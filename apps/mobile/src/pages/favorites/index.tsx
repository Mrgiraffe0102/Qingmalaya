import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import AppLayout from '../../components/AppLayout'
import PageContainer from '../../components/AppLayout/PageContainer'
import { useAuthRedirect } from '../../utils/route-guard'
import { get, del } from '../../utils/request'
import { coverUrl, formatDuration, formatCount } from '../../utils/format'
import { playPodcast } from '../../utils/play'
import type { Paginated, PodcastWithRelations } from '@qingmalaya/shared'

const PAGE_SIZE = 20

const CARD_STYLE: CSSProperties = {
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
  border: '1px solid rgba(114, 120, 121, 0.10)',
}

function handleBack(): void {
  Taro.navigateBack({
    fail: () => Taro.switchTab({ url: '/pages/profile/index' }),
  })
}

function goToPodcast(id: number): void {
  void playPodcast(id)
}

interface FavoriteResponse extends Paginated<PodcastWithRelations> {}

export default function FavoritesPage() {
  const ok = useAuthRedirect()
  const [items, setItems] = useState<PodcastWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(1)

  const fetchFirst = useCallback(async () => {
    setLoading(true)
    try {
      const res = await get<FavoriteResponse>(
        `/users/me/favorites?page=1&pageSize=${PAGE_SIZE}`,
      )
      setItems(res.items)
      setHasMore(res.hasMore)
      setPage(1)
    } catch (err) {
      console.warn('[favorites] fetch failed', err)
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
      const res = await get<FavoriteResponse>(
        `/users/me/favorites?page=${next}&pageSize=${PAGE_SIZE}`,
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

  async function handleUnfavorite(podcastId: number, e: any) {
    e.stopPropagation()
    try {
      await del(`/podcasts/${podcastId}/favorite`, { silent: true })
      setItems((prev) => prev.filter((p) => p.id !== podcastId))
      Taro.showToast({ title: '已取消收藏', icon: 'none' })
    } catch (err) {
      Taro.showToast({
        title: err instanceof Error ? err.message : '操作失败',
        icon: 'none',
      })
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
            我的收藏
          </Text>
          {items.length > 0 && (
            <Text className='mt-1 block text-outline' style={{ fontSize: '12px' }}>
              共 {items.length} 个收藏
            </Text>
          )}
        </View>

        {/* Favorites list */}
        {items.length === 0 ? (
          <View className='flex min-h-[50vh] items-center justify-center px-6'>
            <View className='text-center'>
              <Text style={{ fontSize: '48px' }}>★</Text>
              <Text
                className='mt-4 block text-on-surface-variant'
                style={{ fontSize: '14px' }}
              >
                还没有收藏的播客
              </Text>
              <Text
                className='mt-1 block text-outline'
                style={{ fontSize: '12px' }}
              >
                在播放页点击 ☆ 即可收藏
              </Text>
            </View>
          </View>
        ) : (
          <View className='flex flex-col gap-2 px-4 pb-10'>
            {items.map((p) => (
              <View
                key={p.id}
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
                </View>
                <View
                  onClick={(e) => handleUnfavorite(p.id, e)}
                  className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full'
                  style={{ backgroundColor: 'rgba(77, 98, 101, 0.08)' }}
                >
                  <Text
                    className='text-xl'
                    style={{ color: '#4d6265' }}
                  >
                    ★
                  </Text>
                </View>
              </View>
            ))}

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
