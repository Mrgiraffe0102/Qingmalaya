/**
 * Global player state store.
 * Holds only the metadata + transport state — the actual HTML5 Audio element
 * is wired up in Task 19 (playback detail page). Keeping this ephemeral (no
 * persist) since "what is playing" should reset on every cold start.
 */
import { create } from 'zustand'
import type { PodcastWithRelations } from '@qingmalaya/shared'

export interface PlayerState {
  currentPodcast: PodcastWithRelations | null
  isPlaying: boolean
  position: number // seconds elapsed
  duration: number // seconds total
  playbackRate: number // 0.75 | 1 | 1.25 | 1.5 | 2
  // Actions
  play: (podcast: PodcastWithRelations) => void
  togglePlayPause: () => void
  setPosition: (pos: number) => void
  setPlaybackRate: (rate: number) => void
  stop: () => void
}

export const usePlayerStore = create<PlayerState>((set) => ({
  currentPodcast: null,
  isPlaying: false,
  position: 0,
  duration: 0,
  playbackRate: 1,
  play: (podcast) =>
    set({
      currentPodcast: podcast,
      isPlaying: true,
      position: 0,
      duration: podcast.duration,
    }),
  togglePlayPause: () => set((s) => ({ isPlaying: !s.isPlaying })),
  setPosition: (pos) => set({ position: pos }),
  setPlaybackRate: (rate) => set({ playbackRate: rate }),
  stop: () =>
    set({
      currentPodcast: null,
      isPlaying: false,
      position: 0,
      duration: 0,
    }),
}))
