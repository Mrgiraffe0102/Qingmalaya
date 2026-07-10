import { useEffect, useState, type CSSProperties } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import AppLayout from '../../components/AppLayout'
import PageContainer from '../../components/AppLayout/PageContainer'
import { useAuthRedirect } from '../../utils/route-guard'
import { get } from '../../utils/request'
import { coverUrl, formatCount, formatDuration } from '../../utils/format'
import type { DiscoveryResponse, PodcastWithRelations } from '@qingmalaya/shared'

type Tab = 'play' | 'like' | 'comment'

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'play', label: '播放榜', icon: 'play_arrow' },
  { key: 'like', label: '点赞榜', icon: 'thumb_up' },
  { key: 'comment', label: '评论榜', icon: 'chat_bubble' },
]

const CARD_STYLE: CSSProperties = {
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
  border: '1px solid rgba(114, 120, 121, 0.10)',
}

function handleBack(): void {
  Taro.navigateBack({
    fail: () => Taro.switchTab({ url: '/pages/discovery/index' }),
  })
}

function goToPodcast(id: number): void {
  Taro.navigateTo({ url: `/pages/playback/index?id=${id}` })
}

function Cover({ path, title, className, letterClass }: {
  path: string | null | undefined
  title: string
  className: string
  letterClass?: string
}) {
  const url = coverUrl(path)
  if (url) {
    return <Image src={url} className={className} mode='aspectFill' />
  }
  return (
    <View className={`${className} flex items-center justify-center bg-primary/15`}>
      <Text className={letterClass ?? 'text-on-primary-container font-semibold'}>
        {(title || '?').charAt(0)}
      </Text>
    </View>
  )
}

function RankBadge({ rank }: { rank: number }) {
  const isTop = rank === 1
  const isPodium = rank <= 3
  return (
    <Text
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
        isTop
          ? 'bg-primary text-on-primary'
          : isPodium
            ? 'bg-tertiary text-on-tertiary'
            : 'bg-surface-container-high text-on-surface-variant'
      }`}
    >
      {rank}
    </Text>
  )
}

function metricFor(tab: Tab, p: PodcastWithRelations): string {
  if (tab === 'play') return `${formatCount(p.playCount)} 播放`
  if (tab === 'like') return `${formatCount(p.likeCount)} 赞`
  return `${formatCount(p.commentCount)} 评`
}

export default function RankingPage() {
  const ok = useAuthRedirect()
  const [data, setData] = useState<DiscoveryResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const [tab, setTab] = useState<Tab>(() => {
    const instance = Taro.getCurrentInstance()
    const t = instance.router?.params.tab as Tab | undefined
    return t === 'like' || t === 'comment' ? t : 'play'
  })

  useEffect(() => {
    if (!ok) return
    setLoading(true)
    get<DiscoveryResponse>('/podcasts/discovery')
      .then((res) => setData(res))
      .catch((err) => {
        console.warn('[ranking] fetch failed', err)
        Taro.showToast({ title: '加载失败', icon: 'none' })
      })
      .finally(() => setLoading(false))
  }, [ok])

  if (!ok) return null

  if (loading && !data) {
    return (
      <AppLayout currentTab='discovery' hideChrome>
        <View className='flex min-h-[60vh] items-center justify-center'>
          <Text className='text-sm text-on-surface-variant'>加载中...</Text>
        </View>
      </AppLayout>
    )
  }

  const items =
    tab === 'play'
      ? (data?.hot.byPlay ?? [])
      : tab === 'like'
        ? (data?.hot.byLike ?? [])
        : (data?.hot.byComment ?? [])

  return (
    <AppLayout currentTab='discovery' hideChrome>
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
        <View className='px-4 pb-2 pt-2'>
          <Text className='text-xl font-bold tracking-tight text-primary'>
            播客榜单
          </Text>
        </View>

        {/* Tab bar */}
        <View className='flex gap-2 px-4 pb-4 pt-2'>
          {TABS.map((t) => {
            const active = t.key === tab
            return (
              <View
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1 rounded-full px-3 py-1.5 ${
                  active
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-high text-on-surface-variant'
                }`}
              >
                <Text
                  className='material-symbols-outlined'
                  style={{ fontSize: '14px' }}
                >
                  {t.icon}
                </Text>
                <Text className='text-xs font-medium'>{t.label}</Text>
              </View>
            )
          })}
        </View>

        {/* Ranking list */}
        {items.length === 0 ? (
          <View className='flex min-h-[30vh] items-center justify-center px-6'>
            <Text className='text-center text-sm text-on-surface-variant'>
              暂无数据
            </Text>
          </View>
        ) : (
          <View className='flex flex-col gap-2 px-4 pb-10'>
            {items.map((p, idx) => (
              <View
                key={p.id}
                onClick={() => goToPodcast(p.id)}
                className='flex items-center gap-3 rounded-xl bg-surface-container-lowest p-2.5'
                style={CARD_STYLE}
              >
                <RankBadge rank={idx + 1} />
                <Cover
                  path={p.coverPath}
                  title={p.title}
                  className='h-14 w-14 shrink-0 overflow-hidden rounded-lg'
                  letterClass='text-base text-on-primary-container font-semibold'
                />
                <View className='min-w-0 flex-1'>
                  <Text className='block truncate text-sm font-medium text-on-surface'>
                    {p.title}
                  </Text>
                  <Text className='mt-0.5 block truncate text-xs text-on-surface-variant'>
                    {p.author.name}
                  </Text>
                  <View className='mt-1 flex items-center gap-2'>
                    <Text className='text-xs text-outline'>
                      {metricFor(tab, p)}
                    </Text>
                    <Text className='text-xs text-outline'>
                      {formatDuration(p.duration)}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </PageContainer>
    </AppLayout>
  )
}
