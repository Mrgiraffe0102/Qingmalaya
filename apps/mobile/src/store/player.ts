/**
 * Global player state store.
 *
 * Holds podcast metadata + transport state and drives a single shared HTML5
 * Audio element whose lifecycle is owned by <GlobalAudioPlayer> (mounted once
 * at the app root). The audio element reference is injected via `setAudioEl`
 * so that store actions can control playback directly — this lets the
 * PlaybackBar's play/pause button work even when the user has navigated away
 * from the playback detail page.
 */
import { create } from 'zustand'
import type { PodcastWithRelations } from '@qingmalaya/shared'

const STATIC_ORIGIN = 'http://localhost:3000'

/** Module-level audio element — set once by GlobalAudioPlayer on mount. */
let audioEl: HTMLAudioElement | null = null

/** Seeking guard — when true, timeupdate events must NOT overwrite position. */
let seeking = false

export function setAudioEl(el: HTMLAudioElement | null): void {
  audioEl = el
}

export function setSeeking(val: boolean): void {
  seeking = val
}

export function isSeeking(): boolean {
  return seeking
}

export interface PlayerState {
  currentPodcast: PodcastWithRelations | null
  isPlaying: boolean
  position: number // seconds elapsed
  duration: number // seconds total
  playbackRate: number // 0.75 | 1 | 1.25 | 1.5 | 2
  // Actions
  /** Load a podcast into the store + set audio src. No-op if same podcast. Returns true if newly loaded. */
  load: (podcast: PodcastWithRelations) => boolean
  togglePlayPause: () => void
  setPosition: (pos: number) => void
  /** User-initiated seek — updates position AND seeks the audio element. */
  seek: (pos: number) => void
  setPlaybackRate: (rate: number) => void
  stop: () => void
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentPodcast: null,
  isPlaying: false,
  position: 0,
  duration: 0,
  playbackRate: 1,

  load: (podcast) => {
    const cur = get().currentPodcast
    if (cur && cur.id === podcast.id) return false

    set({
      currentPodcast: podcast,
      isPlaying: false,
      position: 0,
      duration: podcast.duration,
    })

    if (audioEl) {
      audioEl.src = `${STATIC_ORIGIN}/static/${podcast.audioPath}`
      audioEl.preload = 'metadata'
      audioEl.playbackRate = get().playbackRate
    }

    return true
  },

  togglePlayPause: () => {
    const el = audioEl
    if (!el) {
      set((s) => ({ isPlaying: !s.isPlaying }))
      return
    }
    if (el.paused) {
      // Optimistic — the 'play' event will confirm; catch reverts on failure.
      set({ isPlaying: true })
      el.play().catch(() => set({ isPlaying: false }))
    } else {
      el.pause()
      // 'pause' event will set isPlaying: false
    }
  },

  setPosition: (pos) => set({ position: pos }),

  seek: (pos) => {
    set({ position: pos })
    if (audioEl) audioEl.currentTime = pos
  },

  setPlaybackRate: (rate) => {
    set({ playbackRate: rate })
    if (audioEl) audioEl.playbackRate = rate
  },

  stop: () => {
    if (audioEl) {
      audioEl.pause()
      audioEl.removeAttribute('src')
      audioEl.load()
    }
    set({
      currentPodcast: null,
      isPlaying: false,
      position: 0,
      duration: 0,
    })
  },
}))
