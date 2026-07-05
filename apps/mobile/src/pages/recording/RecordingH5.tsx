import { useEffect, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { useUploadCache } from '../../store/upload-cache'

const API_BASE = 'http://localhost:3000/api'

interface UploadResult {
  path: string
  size: number
  mimetype: string
}

async function uploadAudio(file: File): Promise<UploadResult> {
  const formData = new FormData()
  formData.append('file', file)
  const token = Taro.getStorageSync('token')
  const res = await fetch(`${API_BASE}/upload/audio`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(err.message || '上传失败')
  }
  return (await res.json()) as UploadResult
}

function getBlobDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio()
    const url = URL.createObjectURL(blob)
    audio.src = url
    const cleanup = () => URL.revokeObjectURL(url)
    audio.onloadedmetadata = () => {
      const dur = audio.duration
      cleanup()
      resolve(Number.isFinite(dur) && dur > 0 ? Math.floor(dur) : 0)
    }
    audio.onerror = () => {
      cleanup()
      resolve(0)
    }
  })
}

type RecordingState = 'idle' | 'recording' | 'paused' | 'playing'

function pickRecordingMime(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4'
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm'
  return ''
}

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  const cs = Math.floor((seconds % 1) * 100)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

const RECORDING_MIME = pickRecordingMime()
const UPLOAD_MIME = RECORDING_MIME === 'audio/mp4' ? 'audio/x-m4a' : RECORDING_MIME
const UPLOAD_EXT = RECORDING_MIME === 'audio/mp4' ? 'm4a' : 'webm'

export default function RecordingH5() {
  const [state, setState] = useState<RecordingState>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [hasRecording, setHasRecording] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordedBlobsRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef(0)
  const elapsedBeforePauseRef = useRef(0)
  const waveformHistoryRef = useRef<number[]>([])
  const lastSampleTimeRef = useRef(0)
  const recordedBlobUrlRef = useRef<string | null>(null)
  const playbackAudioRef = useRef<HTMLAudioElement | null>(null)
  const finishingRef = useRef(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    const w = rect.width || 320
    const h = rect.height || 160
    canvas.width = w * dpr
    canvas.height = h * dpr
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.scale(dpr, dpr)
    drawIdleWaveform(w, h)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    return () => {
      cleanupAll()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function cleanupAll() {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    if (timerIntervalRef.current !== null) {
      clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop()
      } catch {
        // ignore
      }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => undefined)
      audioContextRef.current = null
    }
    if (playbackAudioRef.current) {
      playbackAudioRef.current.pause()
      playbackAudioRef.current = null
    }
    if (recordedBlobUrlRef.current) {
      URL.revokeObjectURL(recordedBlobUrlRef.current)
      recordedBlobUrlRef.current = null
    }
  }

  function drawIdleWaveform(w: number, h: number) {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, w, h)
    const barCount = 48
    const barWidth = w / barCount
    ctx.fillStyle = '#c2c7c8'
    for (let i = 0; i < barCount; i++) {
      const barHeight = 4
      const x = i * barWidth
      const y = (h - barHeight) / 2
      ctx.fillRect(x + 1, y, barWidth - 2, barHeight)
    }
  }

  function drawLiveWaveform() {
    const canvas = canvasRef.current
    const analyser = analyserRef.current
    if (!canvas || !analyser) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const w = canvas.width / dpr
    const h = canvas.height / dpr
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw)
      analyser.getByteFrequencyData(dataArray)
      ctx.clearRect(0, 0, w, h)

      const barCount = 48
      const barWidth = w / barCount
      const usefulBins = Math.floor(bufferLength * 0.75)
      const step = Math.max(1, Math.floor(usefulBins / barCount))

      let sum = 0
      for (let i = 0; i < barCount; i++) {
        const value = dataArray[i * step] || 0
        const barHeight = Math.max(3, (value / 255) * h * 0.85)
        const x = i * barWidth
        const y = (h - barHeight) / 2
        ctx.fillStyle = '#4d6265'
        ctx.fillRect(x + 1, y, barWidth - 2, barHeight)
        sum += value
      }

      const now = performance.now()
      if (now - lastSampleTimeRef.current > 50) {
        const avg = sum / barCount / 255
        waveformHistoryRef.current.push(avg)
        lastSampleTimeRef.current = now
      }
    }
    draw()
  }

  function drawPlaybackWaveform(currentTime: number, totalTime: number) {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const w = canvas.width / dpr
    const h = canvas.height / dpr

    ctx.clearRect(0, 0, w, h)

    const history = waveformHistoryRef.current
    if (history.length === 0) return

    const barCount = Math.min(history.length, 64)
    const barWidth = w / barCount
    const step = history.length / barCount
    const progress = totalTime > 0 ? currentTime / totalTime : 0

    for (let i = 0; i < barCount; i++) {
      const value = history[Math.floor(i * step)] || 0
      const barHeight = Math.max(3, value * h * 0.85)
      const x = i * barWidth
      const y = (h - barHeight) / 2
      ctx.fillStyle = i / barCount <= progress ? '#4d6265' : '#c2c7c8'
      ctx.fillRect(x + 1, y, barWidth - 2, barHeight)
    }

    const playheadX = progress * w
    ctx.fillStyle = '#ba1a1a'
    ctx.fillRect(playheadX - 1, 0, 2, h)
  }

  function startTimer() {
    if (timerIntervalRef.current !== null) return
    timerIntervalRef.current = setInterval(() => {
      const current = elapsedBeforePauseRef.current + (Date.now() - startTimeRef.current) / 1000
      setElapsed(current)
    }, 50)
  }

  function stopTimer() {
    if (timerIntervalRef.current !== null) {
      clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }
  }

  function setupMediaRecorder(stream: MediaStream): MediaRecorder {
    let mr: MediaRecorder
    try {
      mr = RECORDING_MIME ? new MediaRecorder(stream, { mimeType: RECORDING_MIME }) : new MediaRecorder(stream)
    } catch {
      mr = new MediaRecorder(stream)
    }

    audioChunksRef.current = []
    mr.ondataavailable = (e: BlobEvent) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data)
    }
    mr.onstop = () => {
      const blob = new Blob(audioChunksRef.current, { type: RECORDING_MIME || 'audio/webm' })
      audioChunksRef.current = []
      recordedBlobsRef.current.push(blob)

      if (finishingRef.current) {
        void finishUpload()
        return
      }

      if (recordedBlobUrlRef.current) {
        URL.revokeObjectURL(recordedBlobUrlRef.current)
      }
      recordedBlobUrlRef.current = URL.createObjectURL(blob)
      setHasRecording(true)
      setState('paused')
    }

    return mr
  }

  async function startRecording() {
    setError('')

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('当前环境不支持录音功能')
      return
    }
    if (typeof MediaRecorder === 'undefined') {
      setError('当前浏览器不支持录音功能')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (AudioCtx) {
        const audioCtx = new AudioCtx()
        audioContextRef.current = audioCtx
        const source = audioCtx.createMediaStreamSource(stream)
        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = 256
        source.connect(analyser)
        analyserRef.current = analyser
      }

      const mr = setupMediaRecorder(stream)
      mediaRecorderRef.current = mr
      mr.start()

      elapsedBeforePauseRef.current = 0
      startTimeRef.current = Date.now()
      setElapsed(0)
      startTimer()
      drawLiveWaveform()
      setState('recording')
    } catch (err) {
      const msg = err instanceof Error ? err.message : '无法访问麦克风'
      setError(msg.includes('Permission') || msg.includes('denied') ? '麦克风权限被拒绝' : msg)
    }
  }

  function pauseRecording() {
    const mr = mediaRecorderRef.current
    if (!mr || mr.state === 'inactive') return

    elapsedBeforePauseRef.current += (Date.now() - startTimeRef.current) / 1000
    setElapsed(elapsedBeforePauseRef.current)
    stopTimer()
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    mr.stop()
  }

  function resumeRecording() {
    const stream = streamRef.current
    if (!stream) {
      void startRecording()
      return
    }

    if (audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume().catch(() => undefined)
    }

    const mr = setupMediaRecorder(stream)
    mediaRecorderRef.current = mr
    mr.start()

    startTimeRef.current = Date.now()
    startTimer()
    drawLiveWaveform()
    setState('recording')
  }

  function startPlayback() {
    if (!recordedBlobUrlRef.current) return

    if (playbackAudioRef.current) {
      playbackAudioRef.current.pause()
    }

    const audio = new Audio(recordedBlobUrlRef.current)
    playbackAudioRef.current = audio
    audio.ontimeupdate = () => {
      setElapsed(audio.currentTime)
      drawPlaybackWaveform(audio.currentTime, audio.duration)
    }
    audio.onended = () => {
      setState('paused')
      setElapsed(elapsedBeforePauseRef.current)
      drawPlaybackWaveform(audio.duration, audio.duration)
    }
    audio.play().catch(() => {
      Taro.showToast({ title: '播放失败', icon: 'none' })
      setState('paused')
    })
    setElapsed(0)
    setState('playing')
  }

  function pausePlayback() {
    playbackAudioRef.current?.pause()
    setState('paused')
    setElapsed(elapsedBeforePauseRef.current)
  }

  function handleMainButton() {
    switch (state) {
      case 'idle':
        void startRecording()
        break
      case 'recording':
        pauseRecording()
        break
      case 'paused':
        startPlayback()
        break
      case 'playing':
        pausePlayback()
        break
    }
  }

  async function finishUpload() {
    try {
      const finalBlob = new Blob(recordedBlobsRef.current, { type: RECORDING_MIME || 'audio/webm' })
      const duration = await getBlobDuration(finalBlob)
      const safeDuration = duration > 0 ? duration : Math.floor(elapsedBeforePauseRef.current)

      const file = new File([finalBlob], `recording-${Date.now()}.${UPLOAD_EXT}`, {
        type: UPLOAD_MIME || 'audio/webm',
      })
      const result = await uploadAudio(file)

      useUploadCache.getState().setRecordingResult({
        path: result.path,
        duration: safeDuration,
      })

      Taro.hideLoading()
      finishingRef.current = false
      Taro.navigateBack()
    } catch {
      Taro.hideLoading()
      Taro.showToast({ title: '上传失败，请重试', icon: 'none' })
      finishingRef.current = false
    } finally {
      setUploading(false)
    }
  }

  async function handleDone() {
    if (uploading || !hasRecording) return

    if (state === 'playing' && playbackAudioRef.current) {
      playbackAudioRef.current.pause()
    }

    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    stopTimer()

    finishingRef.current = true
    setUploading(true)
    Taro.showLoading({ title: '上传中...' })

    const mr = mediaRecorderRef.current
    if (mr && mr.state !== 'inactive') {
      mr.stop()
    } else {
      await finishUpload()
    }
  }

  function handleCancel() {
    cleanupAll()
    Taro.navigateBack()
  }

  const mainIcon = state === 'recording' || state === 'playing' ? '⏸' : state === 'paused' ? '▶' : '●'
  const mainColor =
    state === 'recording'
      ? '#1b1c1c'
      : state === 'idle'
        ? '#ba1a1a'
        : '#4d6265'
  const canFinish = hasRecording && !uploading
  const showResume = state === 'paused'

  return (
    <View className='relative flex min-h-screen flex-col bg-surface'>
      <View className='flex h-16 items-center justify-between px-4'>
        <View
          onClick={handleCancel}
          className='text-sm text-primary active:opacity-70'
        >
          取消
        </View>
        <Text className='text-xl font-semibold text-on-surface'>录制音频</Text>
        <View className='w-10' />
      </View>

      <View className='flex flex-1 flex-col items-center justify-center px-4 py-8 relative'>
        <View
          className='pointer-events-none absolute inset-0 overflow-hidden'
          style={{ opacity: 0.15 }}
        >
          <View
            className='absolute rounded-full border border-primary/20'
            style={{ top: '-60px', left: '-60px', width: '240px', height: '240px' }}
          />
          <View
            className='absolute rounded-full border border-secondary/10'
            style={{ top: '50%', right: '-120px', width: '200px', height: '200px' }}
          />
        </View>

        <View className='relative z-10 mb-8 text-center'>
          <Text
            className='font-bold tabular-nums text-on-surface'
            style={{ fontSize: '36px', letterSpacing: '-0.02em', lineHeight: '44px' }}
          >
            {formatTimer(elapsed)}
          </Text>
          <Text className='mt-1 block text-xs font-semibold uppercase tracking-widest text-on-surface-variant'>
            {state === 'recording' ? 'Recording' : state === 'playing' ? 'Playing' : 'Ready'}
          </Text>
        </View>

        <View className='relative z-10 mb-8 flex h-40 w-full max-w-sm items-center justify-center'>
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: '160px' }}
          />
        </View>

        {error && (
          <View className='relative z-10 mb-4 rounded-lg bg-error-container px-4 py-2'>
            <Text className='text-sm text-on-error-container'>{error}</Text>
          </View>
        )}
      </View>

      <View className='z-10 px-4 pb-8'>
        <View className='mx-auto flex max-w-sm items-center justify-between gap-4'>
          <View className='flex flex-1 flex-col items-center gap-1'>
            <View
              onClick={showResume ? resumeRecording : undefined}
              className={`flex h-12 w-12 items-center justify-center rounded-full transition-all ${
                showResume
                  ? 'bg-surface-container-high text-on-surface-variant active:scale-95'
                  : 'bg-surface-container-high/30 text-outline-variant'
              }`}
            >
              <Text style={{ fontSize: '18px' }}>↻</Text>
            </View>
            <Text
              className={`text-[11px] font-medium ${
                showResume ? 'text-on-surface-variant' : 'text-outline-variant'
              }`}
            >
              继续
            </Text>
          </View>

          <View className='relative'>
            {state === 'recording' && (
              <View
                className='absolute inset-0 -m-2 animate-pulse rounded-full'
                style={{ border: '2px solid rgba(186,26,26,0.3)' }}
              />
            )}
            <View
              onClick={handleMainButton}
              className='flex h-20 w-20 items-center justify-center rounded-full text-white shadow-lg transition-all active:scale-90'
              style={{ backgroundColor: mainColor }}
            >
              <Text style={{ fontSize: '28px', lineHeight: '28px' }}>{mainIcon}</Text>
            </View>
          </View>

          <View className='flex flex-1 flex-col items-center gap-1'>
            <View
              onClick={canFinish ? handleDone : undefined}
              className={`flex h-12 w-12 items-center justify-center rounded-full transition-all ${
                canFinish
                  ? 'bg-primary text-on-primary active:scale-95'
                  : 'bg-surface-container-high/30 text-outline-variant'
              }`}
            >
              <Text style={{ fontSize: '18px' }}>✓</Text>
            </View>
            <Text
              className={`text-[11px] font-medium ${
                canFinish ? 'text-on-surface-variant' : 'text-outline-variant'
              }`}
            >
              完成
            </Text>
          </View>
        </View>
      </View>
    </View>
  )
}
