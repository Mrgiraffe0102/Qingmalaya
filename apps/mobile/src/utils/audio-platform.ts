/**
 * Cross-platform audio playback + recording abstraction.
 *
 * H5: HTML5 Audio element + MediaRecorder
 * weapp: Taro.createInnerAudioContext + Taro.getRecorderManager
 * RN: expo-av Audio.Sound + Audio.Recording (deferred to Task 36)
 *
 * The active platform is selected at build time via `process.env.TARO_ENV`,
 * so the inactive branches are tree-shaken by the compiler.
 */

export type AudioPlatform = 'h5' | 'weapp' | 'rn'

export function getAudioPlatform(): AudioPlatform {
  if (process.env.TARO_ENV === 'weapp') return 'weapp'
  if (process.env.TARO_ENV === 'rn') return 'rn'
  return 'h5'
}

/* ----------------------- Playback abstraction ----------------------- */

export interface PlatformAudioPlayer {
  src: string
  play(): void
  pause(): void
  stop(): void
  seek(seconds: number): void
  setPlaybackRate(rate: number): void
  setVolume(vol: number): void
  destroy(): void
  onTimeUpdate?(cb: () => void): void
  onEnded?(cb: () => void): void
  onPlay?(cb: () => void): void
  onPause?(cb: () => void): void
  onCanplay?(cb: () => void): void
  readonly duration: number
  readonly currentTime: number
}

/**
 * Create a platform-appropriate audio player.
 * H5 returns a wrapper around HTMLAudioElement.
 * weapp returns a wrapper around Taro.InnerAudioContext.
 */
export function createAudioPlayer(src: string): PlatformAudioPlayer {
  if (process.env.TARO_ENV === 'weapp') {
    return createWeappAudioPlayer(src)
  }
  if (process.env.TARO_ENV === 'rn') {
    return createRnAudioPlayer(src)
  }
  return createH5AudioPlayer(src)
}

function createH5AudioPlayer(src: string): PlatformAudioPlayer {
  const audio = new Audio(src)
  audio.preload = 'auto'
  return {
    get src() { return audio.src },
    set src(v) { audio.src = v },
    play: () => { void audio.play() },
    pause: () => audio.pause(),
    stop: () => { audio.pause(); audio.currentTime = 0 },
    seek: (s) => { audio.currentTime = s },
    setPlaybackRate: (r) => { audio.playbackRate = r },
    setVolume: (v) => { audio.volume = v },
    destroy: () => { audio.pause(); audio.src = '' },
    onTimeUpdate: (cb) => { audio.addEventListener('timeupdate', cb) },
    onEnded: (cb) => { audio.addEventListener('ended', cb) },
    onPlay: (cb) => { audio.addEventListener('play', cb) },
    onPause: (cb) => { audio.addEventListener('pause', cb) },
    onCanplay: (cb) => { audio.addEventListener('canplay', cb) },
    get duration() { return audio.duration || 0 },
    get currentTime() { return audio.currentTime || 0 },
  }
}

function createWeappAudioPlayer(src: string): PlatformAudioPlayer {
  // Lazy import to avoid pulling Taro into H5 bundle
  const Taro = require('@tarojs/taro').default
  const inner = Taro.createInnerAudioContext()
  inner.src = src
  let timeUpdateCb: (() => void) | null = null
  let endedCb: (() => void) | null = null
  let playCb: (() => void) | null = null
  let pauseCb: (() => void) | null = null
  let canplayCb: (() => void) | null = null
  inner.onTimeUpdate(() => timeUpdateCb?.())
  inner.onEnded(() => endedCb?.())
  inner.onPlay(() => playCb?.())
  inner.onPause(() => pauseCb?.())
  inner.onCanplay(() => canplayCb?.())
  return {
    get src() { return inner.src },
    set src(v) { inner.src = v },
    play: () => inner.play(),
    pause: () => inner.pause(),
    stop: () => inner.stop(),
    seek: (s) => { inner.seek(s) },
    setPlaybackRate: (r) => { inner.playbackRate = r },
    setVolume: (v) => { inner.volume = v },
    destroy: () => inner.destroy(),
    onTimeUpdate: (cb) => { timeUpdateCb = cb },
    onEnded: (cb) => { endedCb = cb },
    onPlay: (cb) => { playCb = cb },
    onPause: (cb) => { pauseCb = cb },
    onCanplay: (cb) => { canplayCb = cb },
    get duration() { return inner.duration || 0 },
    get currentTime() { return inner.currentTime || 0 },
  }
}

function createRnAudioPlayer(src: string): PlatformAudioPlayer {
  const { Audio } = require('expo-av')
  let sound: { playAsync(): Promise<void>; pauseAsync(): Promise<void>; stopAsync(): Promise<void>; setPositionAsync(ms: number): Promise<void>; setRateAsync(rate: number, pitch: boolean): Promise<void>; setVolumeAsync(vol: number): Promise<void>; unloadAsync(): Promise<void>; setOnPlaybackStatusUpdate(cb: (status: Record<string, unknown>) => void): void; getStatusAsync(): Promise<Record<string, unknown>> } | null = null
  let timeUpdateCb: (() => void) | null = null
  let endedCb: (() => void) | null = null
  let playCb: (() => void) | null = null
  let pauseCb: (() => void) | null = null
  let dur = 0
  let pos = 0

  void Audio.Sound.createAsync({ uri: src }).then((res: { sound: NonNullable<typeof sound>; status: Record<string, unknown> }) => {
    sound = res.sound
    dur = (res.status as { durationMillis?: number }).durationMillis ? (res.status as { durationMillis: number }).durationMillis / 1000 : 0
    res.sound.setOnPlaybackStatusUpdate((status: Record<string, unknown>) => {
      if (status.isLoaded) {
        pos = (status as { positionMillis: number }).positionMillis / 1000
        dur = (status as { durationMillis: number }).durationMillis ? (status as { durationMillis: number }).durationMillis / 1000 : dur
        timeUpdateCb?.()
        if (status.didJustFinish) endedCb?.()
        if (status.isPlaying) playCb?.()
        else pauseCb?.()
      }
    })
  })

  return {
    get src() { return src },
    set src(v) { sound?.unloadAsync().then(() => { void Audio.Sound.createAsync({ uri: v }).then((res: { sound: NonNullable<typeof sound>; status: Record<string, unknown> }) => { sound = res.sound }) }) },
    play: () => { sound?.playAsync() },
    pause: () => { sound?.pauseAsync() },
    stop: () => { sound?.stopAsync() },
    seek: (s) => { sound?.setPositionAsync(s * 1000) },
    setPlaybackRate: (r) => { sound?.setRateAsync(r, true) },
    setVolume: (v) => { sound?.setVolumeAsync(v) },
    destroy: () => { sound?.unloadAsync(); sound = null },
    onTimeUpdate: (cb) => { timeUpdateCb = cb },
    onEnded: (cb) => { endedCb = cb },
    onPlay: (cb) => { playCb = cb },
    onPause: (cb) => { pauseCb = cb },
    get duration() { return dur },
    get currentTime() { return pos },
  }
}

/* ----------------------- Recording abstraction ----------------------- */

export interface PlatformRecorder {
  start(): void
  stop(): Promise<RecordedAudio>
  pause(): void
  resume(): void
}

export interface RecordedAudio {
  /** Local file path (H5: blob URL, weapp: temp file path) */
  path: string
  duration: number
  /** MIME type or file extension hint */
  format: string
  /** File size in bytes (0 if unknown) */
  size: number
}

/**
 * Create a platform-appropriate audio recorder.
 * Returns null if the platform doesn't support recording.
 */
export function createRecorder(): PlatformRecorder | null {
  if (process.env.TARO_ENV === 'weapp') {
    return createWeappRecorder()
  }
  if (process.env.TARO_ENV === 'rn') {
    return createRnRecorder()
  }
  return createH5Recorder()
}

function createH5Recorder(): PlatformRecorder | null {
  if (typeof MediaRecorder === 'undefined') return null

  let mediaRecorder: MediaRecorder | null = null
  let chunks: Blob[] = []
  let stream: MediaStream | null = null
  const mime = MediaRecorder.isTypeSupported('audio/mp4')
    ? 'audio/mp4'
    : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : ''

  return {
    start() {
      chunks = []
      navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => {
        stream = s
        mediaRecorder = new MediaRecorder(s, mime ? { mimeType: mime } : undefined)
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data)
        }
        mediaRecorder.start()
      })
    },
    async stop() {
      return new Promise<RecordedAudio>((resolve) => {
        if (!mediaRecorder) return resolve({ path: '', duration: 0, format: '', size: 0 })
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: mime || 'audio/webm' })
          const url = URL.createObjectURL(blob)
          stream?.getTracks().forEach((t) => t.stop())
          resolve({
            path: url,
            duration: 0,
            format: mime === 'audio/mp4' ? 'm4a' : 'webm',
            size: blob.size,
          })
        }
        mediaRecorder.stop()
      })
    },
    pause() { mediaRecorder?.pause() },
    resume() { mediaRecorder?.resume() },
  }
}

function createWeappRecorder(): PlatformRecorder {
  const Taro = require('@tarojs/taro').default
  const manager = Taro.getRecorderManager()
  let filePath = ''
  let duration = 0
  let stopResolve: ((r: RecordedAudio) => void) | null = null

  manager.onStop((res: { tempFilePath: string; duration: number; fileSize: number }) => {
    filePath = res.tempFilePath
    duration = Math.floor((res.duration || 0) / 1000)
    if (stopResolve) {
      stopResolve({
        path: filePath,
        duration,
        format: 'mp3',
        size: res.fileSize || 0,
      })
      stopResolve = null
    }
  })

  return {
    start() {
      manager.start({
        duration: 600000,
        sampleRate: 44100,
        numberOfChannels: 1,
        encodeBitRate: 128000,
        format: 'mp3',
      })
    },
    stop() {
      return new Promise<RecordedAudio>((resolve) => {
        stopResolve = resolve
        manager.stop()
      })
    },
    pause() { manager.pause() },
    resume() { manager.resume() },
  }
}

function createRnRecorder(): PlatformRecorder | null {
  const { Audio } = require('expo-av')
  let recording: { prepareToRecordAsync(opts: Record<string, unknown>): Promise<void>; startAsync(): Promise<void>; stopAsync(): Promise<Record<string, unknown>>; getURI(): string | null; pauseAsync(): Promise<void>; resumeAsync(): Promise<void> } | null = null
  let startTime = 0

  return {
    start() {
      void (async () => {
        try {
          await Audio.requestPermissionsAsync()
          const rec = new Audio.Recording()
          await rec.prepareToRecordAsync(Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY)
          await rec.startAsync()
          recording = rec
          startTime = Date.now()
        } catch {
          // Permission denied or mic unavailable
        }
      })()
    },
    async stop() {
      if (!recording) return { path: '', duration: 0, format: '', size: 0 }
      const status = await recording.stopAsync()
      const uri = recording.getURI()
      const duration = Math.floor(((Date.now() - startTime) / 1000))
      recording = null
      return {
        path: uri || '',
        duration,
        format: 'm4a',
        size: (status as { sizeMillis?: number }).sizeMillis || 0,
      }
    },
    pause() { recording?.pauseAsync() },
    resume() { recording?.resumeAsync() },
  }
}
