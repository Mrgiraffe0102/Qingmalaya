/**
 * Invisible global audio player.
 *
 * Owns the single shared HTML5 Audio element for the entire app. Mounted once
 * at the app root so it persists across page navigation — this lets audio keep
 * playing and the PlaybackBar keep working after the user leaves the playback
 * detail page. The Audio element is registered into the player store via
 * `setAudioEl` so store actions can control it directly.
 *
 * Responsibilities:
 *   - Create + tear down the Audio element
 *   - Wire audio events → store (timeupdate, play, pause, ended, error)
 *   - Progress reporting (POST /podcasts/:id/play every 5s while playing)
 */
import { useEffect } from 'react'
import { usePlayerStore, setAudioEl, setSeeking, isSeeking } from '../store/player'
import { post } from '../utils/request'
import { STATIC_ORIGIN } from '../config/env'

const REPORT_INTERVAL_MS = 5000

/** Sum the lengths of all played ranges — seeking does NOT create ranges. */
function getTotalPlayed(audio: HTMLAudioElement): number {
  let total = 0
  const ranges = audio.played
  for (let i = 0; i < ranges.length; i++) {
    total += ranges.end(i) - ranges.start(i)
  }
  return total
}

export default function GlobalAudioPlayer() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const audio = new Audio()
    setAudioEl(audio)

    const onTimeUpdate = () => {
      if (isSeeking()) return
      const pos = audio.currentTime
      usePlayerStore.getState().setPosition(pos)
      // Mark as completed only when the user has actually played (not seeked)
      // nearly the entire audio. Uses audio.played TimeRanges which the browser
      // tracks natively — seeking over content does not create played ranges.
      const dur = audio.duration
      if (dur && getTotalPlayed(audio) >= dur - 2) {
        const cur = usePlayerStore.getState().currentPodcast
        if (cur) usePlayerStore.getState().markCompleted(cur.id)
      }
    }

    const onPlay = () => {
      usePlayerStore.setState({ isPlaying: true })
    }

    const onPause = () => {
      usePlayerStore.setState({ isPlaying: false })
    }

    const onEnded = () => {
      // Same played-time guard as onTimeUpdate — seeking to the end and
      // letting it finish must NOT mark the podcast as completed.
      const dur = audio.duration
      if (dur && getTotalPlayed(audio) >= dur - 2) {
        const cur = usePlayerStore.getState().currentPodcast
        if (cur) usePlayerStore.getState().markCompleted(cur.id)
      }
      usePlayerStore.setState({ isPlaying: false, position: 0 })
    }

    const onError = () => {
      // Audio file may not exist (seed uses fake paths). Fail gracefully.
      usePlayerStore.setState({ isPlaying: false })
    }

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)

    // --- Progress reporting: every 5s while playing ---
    let reportTimer: ReturnType<typeof setInterval> | null = null

    const startReporting = () => {
      if (reportTimer) return
      reportTimer = setInterval(() => {
        const { currentPodcast, position } = usePlayerStore.getState()
        if (!currentPodcast) return
        const pos = audio.currentTime || position
        post(`/podcasts/${currentPodcast.id}/play`, { position: Math.floor(pos) }).catch(
          () => {},
        )
      }, REPORT_INTERVAL_MS)
    }

    const stopReporting = () => {
      if (reportTimer) {
        clearInterval(reportTimer)
        reportTimer = null
      }
    }

    // Subscribe to isPlaying changes to start/stop reporting.
    const unsubscribe = usePlayerStore.subscribe((state, prevState) => {
      if (state.isPlaying && !prevState.isPlaying) startReporting()
      else if (!state.isPlaying && prevState.isPlaying) stopReporting()
    })

    // If the store already has a podcast loaded (e.g. hot reload), sync the src.
    const existing = usePlayerStore.getState().currentPodcast
    if (existing) {
      audio.src = `${STATIC_ORIGIN}/static/${existing.audioPath}`
      audio.preload = 'metadata'
      audio.playbackRate = usePlayerStore.getState().playbackRate
    }
    if (usePlayerStore.getState().isPlaying) startReporting()

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
      stopReporting()
      unsubscribe()
      audio.pause()
      setAudioEl(null)
      setSeeking(false)
    }
  }, [])

  return null
}
