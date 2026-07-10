import { useEffect, useRef, useState, type CSSProperties } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Input, Image, ScrollView, Picker } from '@tarojs/components'
import AppLayout from '../../components/AppLayout'
import PageContainer from '../../components/AppLayout/PageContainer'
import { useAuthRedirect } from '../../utils/route-guard'
import { get } from '../../utils/request'
import { usePlayerStore } from '../../store/player'
import { coverUrl, formatCount, formatRelativeTime } from '../../utils/format'
import { playPodcast } from '../../utils/play'
import { useIsDesktop } from '../../components/AppLayout/useIsDesktop'
import type {
  PodcastWithRelations,
  Paginated,
  Tag,
  Class,
  TagColor
} from '@qingmalaya/shared'

/**
 * Browse page (Task 17).
 *
 * Layout: a viewport-height flex column — a pinned search header sits above a
 * `ScrollView` that owns the page scroll. The ScrollView wires Taro's
 * `refresherEnabled` (pull-to-refresh) and `onScrollToLower` (infinite load).
 * The filter/sort panel and the vertical card list both live inside the
 * ScrollView so they scroll together, matching the reference design.
 *
 * On mobile the root fills the full viewport (100vh) with a negative bottom
 * margin that cancels AppLayout's bottom padding, so ScrollView content
 * scrolls *under* the floating TabBar — same behavior as the discovery page.
 * On desktop the root height excludes the top menu + optional playback bar.
 */

type SortKey = 'newest' | 'oldest' | 'name' | 'likes' | 'views'

interface SortOption {
  key: SortKey
  label: string
}

const SORT_OPTIONS: SortOption[] = [
  { key: 'newest', label: '发布时间（最新）' },
  { key: 'oldest', label: '发布时间（最早）' },
  { key: 'name', label: '名称正序' },
  { key: 'likes', label: '点赞量' },
  { key: 'views', label: '浏览量' }
]

const PAGE_SIZE = 20

/** Tag chip palette — each color renders as a 15% opacity tint + matching text. */
const TAG_COLORS: Record<TagColor, { text: string; bg: string }> = {
  mint: { text: '#2f8f5e', bg: 'rgba(47, 143, 94, 0.15)' },
  purple: { text: '#7c4dd1', bg: 'rgba(124, 77, 209, 0.15)' },
  orange: { text: '#c9701f', bg: 'rgba(201, 112, 31, 0.15)' },
  rose: { text: '#d6336c', bg: 'rgba(214, 51, 108, 0.15)' },
  sky: { text: '#1c7ed6', bg: 'rgba(28, 126, 214, 0.15)' },
  teal: { text: '#0ca678', bg: 'rgba(12, 166, 120, 0.15)' },
  indigo: { text: '#4263eb', bg: 'rgba(66, 99, 235, 0.15)' },
  amber: { text: '#b8860b', bg: 'rgba(184, 134, 11, 0.15)' },
}

function tagColors(color: TagColor): { text: string; bg: string } {
  return TAG_COLORS[color] || TAG_COLORS.mint
}

/** Inline icon helper — the Material Symbols font is linked in index.html. */
function Icon({ name, className = '', style }: { name: string; className?: string; style?: CSSProperties }) {
  return (
    <Text className={`material-symbols-outlined ${className}`} style={{ fontSize: '16px', ...style }}>
      {name}
    </Text>
  )
}

export default function Browse() {
  const ok = useAuthRedirect()
  const isDesktop = useIsDesktop()
  const hasPodcast = usePlayerStore((s) => s.currentPodcast !== null)

  const [items, setItems] = useState<PodcastWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)

  const [keyword, setKeyword] = useState('')
  const [sort, setSort] = useState<SortKey>('newest')
  const [selectedTags, setSelectedTags] = useState<number[]>([])
  const [classId, setClassId] = useState<number | null>(null)
  const [showFilter, setShowFilter] = useState(false)

  const [tags, setTags] = useState<Tag[]>([])
  const [classes, setClasses] = useState<Class[]>([])

  // Skip the first run of the keyword-debounce effect — the initial fetch is
  // handled by the sort/tags/classId effect so we don't fire twice on mount.
  const firstKeywordRef = useRef(true)

  // Skip the first useDidShow — the sort/tags/classId effect handles the
  // initial fetch. On subsequent tab switches, refetch page 1 with current filters.
  const firstShowRef = useRef(true)

  Taro.useDidShow(() => {
    if (firstShowRef.current) {
      firstShowRef.current = false
      return
    }
    if (!ok) return
    void fetchList(true)
  })

  // Desktop split layout: left column height is viewport minus top bar (56px).
  // The mini-player lives in the top bar, not below it, so no extra offset.
  // Mobile: the root fills the full viewport so the ScrollView content
  // scrolls *under* the floating TabBar (matching the discovery page). A
  // negative bottom margin cancels AppLayout's pb-24/pb-40 so the page
  // doesn't grow taller than the viewport.
  const rootHeight = isDesktop
    ? 'calc(100vh - 56px)'
    : '100vh'

  const rootStyle: CSSProperties = {
    height: rootHeight,
    overflow: 'hidden',
  }
  if (!isDesktop) {
    rootStyle.marginBottom = hasPodcast ? '-160px' : '-96px'
  }

  // Bottom padding inside the ScrollView so the last items can scroll
  // above the floating TabBar (+ optional PlaybackBar).
  const scrollBottomPad = isDesktop ? 'pb-6' : hasPodcast ? 'pb-40' : 'pb-24'

  const buildUrl = (p: number): string => {
    const params = new URLSearchParams()
    params.set('sort', sort)
    params.set('page', String(p))
    params.set('pageSize', String(PAGE_SIZE))
    const kw = keyword.trim()
    if (kw) params.set('keyword', kw)
    if (classId != null) params.set('classId', String(classId))
    // Repeat `tag` for multi-select so the backend receives `tag=1&tag=2`.
    selectedTags.forEach((t) => params.append('tag', String(t)))
    return `/podcasts?${params.toString()}`
  }

  const fetchList = async (reset = false): Promise<void> => {
    const nextPage = reset ? 1 : page + 1
    if (reset) setLoading(true)
    else setLoadingMore(true)
    try {
      const res = await get<Paginated<PodcastWithRelations>>(buildUrl(nextPage))
      setItems((prev) => (reset ? res.items : [...prev, ...res.items]))
      setPage(nextPage)
      setHasMore(res.hasMore)
    } catch {
      // request.ts surfaces a non-blocking toast; nothing to do here.
    } finally {
      setLoading(false)
      setLoadingMore(false)
      setRefreshing(false)
    }
  }

  const loadMore = (): void => {
    if (loadingMore || loading || !hasMore) return
    void fetchList(false)
  }

  const onRefresh = async (): Promise<void> => {
    setRefreshing(true)
    await fetchList(true)
  }

  // Load filter metadata once authenticated.
  useEffect(() => {
    if (!ok) return
    Promise.all([
      get<Tag[]>('/tags', { silent: true }).catch(() => [] as Tag[]),
      get<Class[]>('/classes', { silent: true }).catch(() => [] as Class[])
    ]).then(([t, c]) => {
      setTags(t)
      setClasses(c)
    })
  }, [ok])

  // Refetch (reset to page 1) whenever a filter/sort value changes. This also
  // handles the initial mount, so no separate mount-fetch is needed.
  useEffect(() => {
    if (!ok) return
    void fetchList(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ok, sort, selectedTags, classId])

  // Debounced keyword search (300ms). Skipped on the first run to avoid a
  // duplicate fetch — the sort/tags/classId effect already covers mount.
  useEffect(() => {
    if (!ok) return
    if (firstKeywordRef.current) {
      firstKeywordRef.current = false
      return
    }
    const timer = setTimeout(() => {
      void fetchList(true)
    }, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword, ok])

  if (!ok) return null

  const activeFilterCount =
    selectedTags.length + (classId != null ? 1 : 0) + (sort !== 'newest' ? 1 : 0)

  const classOptions = ['全部班级', ...classes.map((c) => c.name)]
  const classPickerIndex =
    classId == null ? 0 : Math.max(0, classes.findIndex((c) => c.id === classId) + 1)
  const selectedClassName = classOptions[classPickerIndex] || '全部班级'

  const toggleTag = (id: number): void => {
    setSelectedTags((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    )
  }

  const clearFilters = (): void => {
    setSelectedTags([])
    setClassId(null)
    setSort('newest')
  }

  return (
    <AppLayout currentTab='browse'>
      <PageContainer>
      <View
        className='flex flex-col bg-surface'
        style={rootStyle}
      >
        {/* ---- Pinned search header ---- */}
        <View
          className='flex-shrink-0 border-b border-outline-variant/30 bg-surface/95 px-4 pb-2 pt-4'
          style={{ backdropFilter: 'blur(12px)' }}
        >
          <View className='mb-2 flex items-center justify-between'>
            <Text className='text-xl font-bold tracking-tight text-primary'>浏览</Text>
            <Text className='text-xs text-on-surface-variant'>
              {items.length > 0 ? `${items.length} 期` : ''}
            </Text>
          </View>
          <View className='flex h-11 items-center rounded-full bg-surface-container-high px-4'>
            <Icon name='search' style={{ fontSize: '20px', color: '#727879' }} />
            <Input
              type='text'
              value={keyword}
              placeholder='搜索播客、作者、标签'
              placeholderClass='text-outline'
              onInput={(e) => setKeyword(e.detail.value)}
              onConfirm={() => void fetchList(true)}
              confirmType='search'
              className='ml-2 w-full bg-transparent text-sm text-on-surface'
              style={{ fontSize: '14px', lineHeight: '20px' }}
            />
            {keyword && (
              <View
                onClick={() => setKeyword('')}
                className='ml-1 flex h-6 w-6 items-center justify-center rounded-full'
                style={{ backgroundColor: 'rgba(114,120,121,0.15)' }}
              >
                <Icon name='close' style={{ fontSize: '14px', color: '#727879' }} />
              </View>
            )}
          </View>
        </View>

        {/* ---- Pinned filter bar (stays visible above the scroll area) ---- */}
        <View className='flex-shrink-0 bg-surface px-4 pb-2 pt-2'>
          <View className='flex items-center justify-between'>
            <Text className='text-lg font-semibold text-on-surface'>探索发现</Text>
            <View className='flex items-center gap-2'>
              {activeFilterCount > 0 && (
                <View
                  onClick={clearFilters}
                  className='rounded-full px-3 py-1.5 text-xs text-on-surface-variant'
                  style={{ backgroundColor: 'rgba(114,120,121,0.1)' }}
                >
                  清除
                </View>
              )}
              <View
                onClick={() => setShowFilter((v) => !v)}
                className='flex items-center gap-1.5 rounded-full px-3 py-1.5'
                style={{
                  backgroundColor: showFilter ? '#4d6265' : 'rgba(77,98,101,0.1)',
                  color: showFilter ? '#ffffff' : '#4d6265'
                }}
              >
                <Icon
                  name='tune'
                  style={{
                    fontSize: '16px',
                    color: showFilter ? '#ffffff' : '#4d6265'
                  }}
                />
                <Text
                  className='text-xs font-semibold'
                  style={{ color: showFilter ? '#ffffff' : '#4d6265' }}
                >
                  筛选{activeFilterCount > 0 ? ` ${activeFilterCount}` : ''}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ---- Scrollable content (filter panel + card list) ---- */}
        <ScrollView
          scrollY
          refresherEnabled
          refresherTriggered={refreshing}
          onRefresherRefresh={() => void onRefresh()}
          onScrollToLower={loadMore}
          lowerThreshold={100}
          className='flex-1'
          style={{ minHeight: 0, height: 0 }}
        >
          {/* Expanded filter / sort panel */}
          {showFilter && (
            <View
              className='mx-4 mb-2 mt-2 space-y-4 rounded-lg p-4'
              style={{
                backgroundColor: '#f5f3f3',
                border: '1px solid rgba(194,199,200,0.4)'
              }}
            >
              {/* Sort options */}
              <View>
                <Text className='mb-2 block text-xs font-medium text-outline'>
                  排序依据
                </Text>
                <View className='flex flex-wrap gap-2'>
                  {SORT_OPTIONS.map((opt) => {
                    const active = sort === opt.key
                    return (
                      <View
                        key={opt.key}
                        onClick={() => setSort(opt.key)}
                        className='rounded-full px-3 py-1.5'
                        style={{
                          backgroundColor: active ? '#4d6265' : '#ffffff',
                          border: active
                            ? '1px solid #4d6265'
                            : '1px solid rgba(194,199,200,0.5)',
                          color: active ? '#ffffff' : '#424849'
                        }}
                      >
                        <Text
                          className='text-xs font-medium'
                          style={{ color: active ? '#ffffff' : '#424849' }}
                        >
                          {opt.label}
                        </Text>
                      </View>
                    )
                  })}
                </View>
              </View>

              {/* Tag chips (multi-select) */}
              <View>
                <Text className='mb-2 block text-xs font-medium text-outline'>
                  标签
                </Text>
                {tags.length === 0 ? (
                  <Text className='text-xs text-outline'>暂无标签</Text>
                ) : (
                  <View className='flex flex-wrap gap-2'>
                    {tags.map((tag) => {
                      const selected = selectedTags.includes(tag.id)
                      const c = tagColors(tag.color)
                      return (
                        <View
                          key={tag.id}
                          onClick={() => toggleTag(tag.id)}
                          className='rounded-full px-3 py-1.5'
                          style={{
                            backgroundColor: selected ? '#4d6265' : c.bg,
                            border: selected
                              ? '1px solid #4d6265'
                              : '1px solid transparent'
                          }}
                        >
                          <Text
                            className='text-xs font-medium'
                            style={{ color: selected ? '#ffffff' : c.text }}
                          >
                            #{tag.name}
                          </Text>
                        </View>
                      )
                    })}
                  </View>
                )}
              </View>

              {/* Class dropdown */}
              <View>
                <Text className='mb-2 block text-xs font-medium text-outline'>
                  班级
                </Text>
                <Picker
                  mode='selector'
                  range={classOptions}
                  value={classPickerIndex}
                  onChange={(e) => {
                    const idx = Number(e.detail.value)
                    setClassId(idx === 0 ? null : classes[idx - 1]?.id ?? null)
                  }}
                >
                  <View
                    className='flex items-center justify-between rounded-md px-3 py-2.5'
                    style={{
                      backgroundColor: '#ffffff',
                      border: '1px solid rgba(194,199,200,0.5)'
                    }}
                  >
                    <Text className='text-sm text-on-surface'>{selectedClassName}</Text>
                    <Icon name='expand_more' style={{ fontSize: '18px', color: '#727879' }} />
                  </View>
                </Picker>
              </View>
            </View>
          )}

          {/* Card list */}
          <View className={`px-4 pt-2 ${scrollBottomPad}`}>
            {loading && items.length === 0 ? (
              <SkeletonList />
            ) : items.length === 0 ? (
              <EmptyState keyword={keyword} />
            ) : (
              <View className='grid grid-cols-1 gap-3 md:grid-cols-2'>
                {items.map((pod) => (
                  <PodcastCard key={pod.id} pod={pod} />
                ))}
              </View>
            )}

            {/* Load-more / end states */}
            {!loading && items.length > 0 && (
              <View className='mt-4 flex items-center justify-center py-3'>
                {loadingMore ? (
                  <View className='flex items-center gap-2'>
                    <View
                      className='h-4 w-4 animate-spin rounded-full'
                      style={{
                        border: '2px solid rgba(77,98,101,0.2)',
                        borderTopColor: '#4d6265'
                      }}
                    />
                    <Text className='text-xs text-on-surface-variant'>加载中...</Text>
                  </View>
                ) : !hasMore ? (
                  <Text className='text-xs text-outline'>没有更多了</Text>
                ) : null}
              </View>
            )}
          </View>
        </ScrollView>
      </View>
      </PageContainer>
    </AppLayout>
  )
}

/** A single horizontal podcast card: cover (left) + meta (right). */
function PodcastCard({ pod }: { pod: PodcastWithRelations }) {
  const cover = coverUrl(pod.coverPath)
  const published = pod.publishedAt || pod.createdAt

  const openDetail = () => {
    void playPodcast(pod.id)
  }

  return (
    <View
      onClick={openDetail}
      className='flex gap-3 rounded-lg bg-surface-container-lowest p-3'
      style={{
        border: '1px solid rgba(194,199,200,0.4)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
      }}
    >
      {/* Cover */}
      <View className='h-20 w-20 flex-shrink-0 overflow-hidden rounded-md bg-surface-dim'>
        {cover ? (
          <Image
            src={cover}
            mode='aspectFill'
            className='h-full w-full'
            lazyLoad
          />
        ) : (
          <View
            className='flex h-full w-full items-center justify-center'
            style={{ backgroundColor: 'rgba(77,98,101,0.12)' }}
          >
            <Icon name='graphic_eq' style={{ fontSize: '28px', color: '#4d6265' }} />
          </View>
        )}
      </View>

      {/* Meta */}
      <View className='flex min-w-0 flex-1 flex-col justify-between'>
        <View>
          {/* Tag chips (max 2) */}
          {pod.tags.length > 0 && (
            <View className='mb-1 flex flex-wrap gap-1.5'>
              {pod.tags.slice(0, 2).map((tag) => {
                const c = tagColors(tag.color)
                return (
                  <View
                    key={tag.id}
                    className='rounded-full px-2 py-0.5'
                    style={{ color: c.text, backgroundColor: c.bg }}
                  >
                    <Text className='text-[11px] font-medium' style={{ fontSize: '11px' }}>
                      #{tag.name}
                    </Text>
                  </View>
                )
              })}
            </View>
          )}
          <Text
            className='block truncate text-[15px] font-semibold text-on-surface'
            style={{ fontSize: '15px', lineHeight: '20px' }}
          >
            {pod.title}
          </Text>
          <Text
            className='mt-0.5 block truncate text-xs text-on-surface-variant'
            style={{ fontSize: '12px' }}
          >
            {pod.author.name} · {formatRelativeTime(published)}
          </Text>
        </View>
        <View className='mt-1.5 flex items-center gap-4'>
          <View className='flex items-center gap-1'>
            <Icon name='favorite' style={{ fontSize: '14px', color: '#727879' }} />
            <Text className='text-xs text-on-surface-variant' style={{ fontSize: '12px' }}>
              {formatCount(pod.likeCount)}
            </Text>
          </View>
          <View className='flex items-center gap-1'>
            <Icon name='headphones' style={{ fontSize: '14px', color: '#727879' }} />
            <Text className='text-xs text-on-surface-variant' style={{ fontSize: '12px' }}>
              {formatCount(pod.playCount)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  )
}

/** Pulsing placeholder cards shown during the initial load. */
function SkeletonList() {
  return (
    <View className='space-y-3'>
      {[0, 1, 2, 3].map((i) => (
        <View
          key={i}
          className='flex animate-pulse gap-3 rounded-lg bg-surface-container-lowest p-3'
          style={{ border: '1px solid rgba(194,199,200,0.3)' }}
        >
          <View className='h-20 w-20 flex-shrink-0 rounded-md bg-surface-container-high' />
          <View className='flex flex-1 flex-col gap-2 py-1'>
            <View className='h-3 w-16 rounded-full bg-surface-container-high' />
            <View className='h-4 w-full rounded bg-surface-container-high' />
            <View className='h-3 w-2/3 rounded bg-surface-container-high' />
            <View className='mt-1 h-3 w-24 rounded bg-surface-container-high' />
          </View>
        </View>
      ))}
    </View>
  )
}

function EmptyState({ keyword }: { keyword: string }) {
  return (
    <View className='flex flex-col items-center justify-center py-20'>
      <Icon name='search_off' style={{ fontSize: '40px', color: '#c2c7c8' }} />
      <Text className='mt-3 text-sm text-on-surface-variant'>
        {keyword ? `没有找到与“${keyword}”相关的播客` : '暂无播客'}
      </Text>
    </View>
  )
}
