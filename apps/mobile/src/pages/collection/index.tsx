import { useEffect, useState, type CSSProperties } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import AppLayout from '../../components/AppLayout'
import PageContainer from '../../components/AppLayout/PageContainer'
import { useAuthRedirect } from '../../utils/route-guard'
import { get } from '../../utils/request'
import { coverUrl, formatDuration, formatCount } from '../../utils/format'
import type { CollectionWithPodcasts, PodcastWithRelations } from '@qingmalaya/shared'

function handleBack(): void {
  Taro.navigateBack({
    fail: () => Taro.switchTab({ url: '/pages/discovery/index' }),
  })
}

const CARD_STYLE: CSSProperties = {
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
  border: '1px solid rgba(114, 120, 121, 0.10)',
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

export default function CollectionPage() {
  const ok = useAuthRedirect()
  const [collection, setCollection] = useState<CollectionWithPodcasts | null>(null)
  const [loading, setLoading] = useState(true)

  const [collectionId] = useState(() => {
    const instance = Taro.getCurrentInstance()
    const id = Number(instance.router?.params.id)
    return Number.isNaN(id) ? 0 : id
  })

  useEffect(() => {
    if (!ok) return
    if (!collectionId) {
      Taro.showToast({ title: '无效的精选集ID', icon: 'none' })
      setLoading(false)
      return
    }
    setLoading(true)
    get<CollectionWithPodcasts>(`/collections/${collectionId}`)
      .then((data) => setCollection(data))
      .catch((err) => {
        console.warn('[collection] fetch failed', err)
        Taro.showToast({ title: '加载失败', icon: 'none' })
      })
      .finally(() => setLoading(false))
  }, [ok, collectionId])

  if (!ok) return null

  if (loading && !collection) {
    return (
      <AppLayout currentTab='discovery' hideChrome>
        <View className='flex min-h-[60vh] items-center justify-center'>
          <Text className='text-sm text-on-surface-variant'>加载中...</Text>
        </View>
      </AppLayout>
    )
  }

  if (!collection) {
    return (
      <AppLayout currentTab='discovery' hideChrome>
        <View className='flex min-h-[60vh] items-center justify-center px-6'>
          <Text className='text-center text-sm text-on-surface-variant'>
            精选集不存在或已下线
          </Text>
        </View>
      </AppLayout>
    )
  }

  const podcasts = collection.podcasts ?? []
  const cover = coverUrl(collection.coverPath)

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

        {/* Collection header — cover banner with title + description */}
        <View
          className='relative mx-4 mb-6 mt-4 overflow-hidden rounded-2xl'
          style={{ ...CARD_STYLE, height: '200px' }}
        >
          {cover ? (
            <Image
              src={cover}
              className='absolute inset-0 h-full w-full'
              mode='aspectFill'
            />
          ) : (
            <View className='absolute inset-0 bg-primary/20' />
          )}
          <View
            className='absolute inset-0'
            style={{
              background:
                'linear-gradient(to top, rgba(77,98,101,0.92) 0%, rgba(77,98,101,0.3) 55%, transparent 100%)',
            }}
          />
          <View className='absolute bottom-0 left-0 right-0 p-4'>
            <Text className='block text-xl font-bold text-white'>
              {collection.title}
            </Text>
            {collection.description && (
              <Text className='mt-1 block text-sm text-white/85'>
                {collection.description}
              </Text>
            )}
            <Text className='mt-2 block text-xs text-white/70'>
              {podcasts.length} 期播客
            </Text>
          </View>
        </View>

        {/* Podcast list */}
        {podcasts.length === 0 ? (
          <View className='flex min-h-[30vh] items-center justify-center px-6'>
            <Text className='text-center text-sm text-on-surface-variant'>
              该精选集暂无播客
            </Text>
          </View>
        ) : (
          <View className='flex flex-col gap-2 px-4 pb-10'>
            {podcasts.map((p: PodcastWithRelations) => (
              <View
                key={p.id}
                onClick={() => goToPodcast(p.id)}
                className='flex items-center gap-3 rounded-xl bg-surface-container-lowest p-2.5'
                style={CARD_STYLE}
              >
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
                      {formatDuration(p.duration)}
                    </Text>
                    <Text className='text-xs text-outline'>
                      {formatCount(p.playCount)} 播放
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
