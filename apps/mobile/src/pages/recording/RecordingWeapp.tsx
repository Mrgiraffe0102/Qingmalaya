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

type RecordingState = 'idle' | 'recording' | 'paused' | 'playing'

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  const cs = Math.floor((seconds % 1) * 100)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

export default function RecordingWeapp() {
  const [state, setState] = useState<RecordingState>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [hasRecording, setHasRecording] = useState(false)

  const recorderManagerRef = useRef<ReturnType<typeof Taro.getRecorderManager> | null>(null)
  const playbackAudioRef = useRef<ReturnType<typeof Taro.createInnerAudioContext> | null>(null)
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef(0)
  const elapsedBeforePauseRef = useRef(0)
  const recordedFilePathRef = useRef('')
  const recordedDurationRef = useRef(0)

  useEffect(() => {
    const manager = Taro.getRecorderManager()
    recorderManagerRef.current = manager

    manager.onStop((res: { tempFilePath: string; duration: number; fileSize: number }) => {
      recordedFilePathRef.current = res.tempFilePath
      recordedDurationRef.current = Math.floor((res.duration || 0) / 1000)
      setHasRecording(true)
      setState('paused')
    })

    manager.onError(() => {
      setError('录音失败，请重试')
      setState('idle')
    })

    return () => {
      cleanupAll()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function cleanupAll() {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }
    if (playbackAudioRef.current) {
      playbackAudioRef.current.stop()
      playbackAudioRef.current.destroy()
      playbackAudioRef.current = null
    }
  }

  function startTimer() {
    if (timerIntervalRef.current) return
    timerIntervalRef.current = setInterval(() => {
      const current = elapsedBeforePauseRef.current + (Date.now() - startTimeRef.current) / 1000
      setElapsed(current)
    }, 50)
  }

  function stopTimer() {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }
  }

  function startRecording() {
    setError('')
    const manager = recorderManagerRef.current
    if (!manager) {
      setError('录音功能不可用')
      return
    }

    elapsedBeforePauseRef.current = 0
    startTimeRef.current = Date.now()
    setElapsed(0)
    manager.start({
      duration: 600000,
      sampleRate: 44100,
      numberOfChannels: 1,
      encodeBitRate: 128000,
      format: 'mp3',
    })
    startTimer()
    setState('recording')
  }

  function pauseRecording() {
    const manager = recorderManagerRef.current
    if (!manager) return
    manager.pause()
    elapsedBeforePauseRef.current += (Date.now() - startTimeRef.current) / 1000
    setElapsed(elapsedBeforePauseRef.current)
    stopTimer()
    setState('paused')
  }

  function resumeRecording() {
    const manager = recorderManagerRef.current
    if (!manager) return
    manager.resume()
    startTimeRef.current = Date.now()
    startTimer()
    setState('recording')
  }

  function startPlayback() {
    if (!recordedFilePathRef.current) return

    if (playbackAudioRef.current) {
      playbackAudioRef.current.stop()
      playbackAudioRef.current.destroy()
      playbackAudioRef.current = null
    }

    const audio = Taro.createInnerAudioContext()
    audio.src = recordedFilePathRef.current
    playbackAudioRef.current = audio

    audio.onTimeUpdate(() => {
      setElapsed(audio.currentTime)
    })
    audio.onEnded(() => {
      setState('paused')
      setElapsed(elapsedBeforePauseRef.current)
    })
    audio.onError(() => {
      Taro.showToast({ title: '播放失败', icon: 'none' })
      setState('paused')
    })

    audio.play()
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
        startRecording()
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

  async function handleDone() {
    if (uploading || !hasRecording) return

    if (state === 'playing' && playbackAudioRef.current) {
      playbackAudioRef.current.pause()
    }
    stopTimer()

    setUploading(true)
    Taro.showLoading({ title: '上传中...' })

    try {
      const filePath = recordedFilePathRef.current
      const token = Taro.getStorageSync('token')

      const uploadRes = await new Promise<{ data: string }>((resolve, reject) => {
        Taro.uploadFile({
          url: `${API_BASE}/upload/audio`,
          filePath,
          name: 'file',
          header: { Authorization: `Bearer ${token}` },
          success: (r) => resolve(r),
          fail: (err) => reject(new Error(err.errMsg || '上传失败')),
        })
      })

      const result = JSON.parse(uploadRes.data) as UploadResult
      const duration = recordedDurationRef.current || Math.floor(elapsedBeforePauseRef.current)

      useUploadCache.getState().setRecordingResult({
        path: result.path,
        duration,
      })

      Taro.hideLoading()
      Taro.navigateBack()
    } catch {
      Taro.hideLoading()
      Taro.showToast({ title: '上传失败，请重试', icon: 'none' })
    } finally {
      setUploading(false)
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

  // CSS-based waveform bars (weapp has no CanvasRenderingContext2D)
  const barCount = 24
  const bars = Array.from({ length: barCount }, (_, i) => i)

  return (
    <View className='relative flex min-h-screen flex-col bg-surface'>
      <View className='flex h-16 items-center justify-between px-4'>
        <View onClick={handleCancel} className='text-sm text-primary active:opacity-70'>
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

        {/* CSS-animated waveform bars (replaces canvas on weapp) */}
        <View className='relative z-10 mb-8 flex h-40 w-full max-w-sm items-center justify-center gap-[2px]'>
          {bars.map((i) => {
            const isActive = state === 'recording' || state === 'playing'
            const baseHeight = 4
            const animatedHeight = 8 + ((i * 7) % 40)
            const delay = (i % 8) * 0.1
            return (
              <View
                key={i}
                style={{
                  width: '3px',
                  height: isActive ? `${animatedHeight}px` : `${baseHeight}px`,
                  backgroundColor: state === 'recording' ? '#4d6265' : state === 'playing' ? '#4d6265' : '#c2c7c8',
                  borderRadius: '2px',
                  transition: 'height 0.15s ease',
                  animation: isActive ? `recobar ${0.6 + (i % 5) * 0.1}s ease-in-out ${delay}s infinite alternate` : 'none',
                }}
              />
            )
          })}
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
