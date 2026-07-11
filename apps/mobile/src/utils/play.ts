import Taro from '@tarojs/taro'
import { usePlayerStore } from '../store/player'
import { get, post } from './request'
import type { PodcastWithRelations } from '@qingmalaya/shared'

const DESKTOP_BREAKPOINT = 1024

function isDesktopViewport(): boolean {
  if (typeof window === 'undefined') return false
  return window.innerWidth >= DESKTOP_BREAKPOINT
}

/**
 * Play a podcast by ID.
 *
 * - Desktop (>=1024px): fetches the podcast and loads it into the global player
 *   store so the right-side DesktopPlayerPanel picks it up. Also records the
 *   play and seeks to the resume position.
 * - Mobile: navigates to the full-screen playback detail page.
 */
export async function playPodcast(id: number): Promise<void> {
  if (isDesktopViewport()) {
    try {
      const podcast = await get<PodcastWithRelations>(`/podcasts/${id}`)
      const store = usePlayerStore.getState()
      const wasNew = store.load(podcast)
      if (wasNew) {
        try {
          const res = await post<{ position: number }>(
            `/podcasts/${podcast.id}/play`,
            { position: 0, start: true },
          )
          if (res.position > 0) store.seek(res.position)
        } catch {
          // Resume position is best-effort.
        }
      }
    } catch {
      Taro.showToast({ title: '加载失败', icon: 'none' })
    }
  } else {
    Taro.navigateTo({ url: `/pages/playback/index?id=${id}` })
  }
}
