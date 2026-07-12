import { useEffect, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Input, Textarea, Image } from '@tarojs/components'
import { useAuthRedirect } from '../../utils/route-guard'
import { useIsDesktop } from '../../components/AppLayout/useIsDesktop'
import { get, post, put } from '../../utils/request'
import { coverUrl, formatDuration } from '../../utils/format'
import { API_BASE_URL } from '../../config/env'
import type { Tag, PodcastWithRelations } from '@qingmalaya/shared'

const IS_WEAPP = process.env.TARO_ENV === 'weapp'

/** Upload response shape from POST /api/upload/{cover,audio}. */
interface UploadResult {
  path: string
  size: number
  mimetype: string
  duration?: number
}

/**
 * Multipart upload helper for H5. Uses XMLHttpRequest so we can report upload
 * progress to the caller via the onProgress callback. The browser sets the
 * multipart boundary automatically — do NOT set Content-Type manually.
 */
function uploadFileH5(
  file: File,
  type: 'cover' | 'audio',
  onProgress?: (percent: number) => void,
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const formData = new FormData()
    formData.append('file', file)
    const token = Taro.getStorageSync('token')
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE_URL}/upload/${type}`)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    if (onProgress && xhr.upload) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100))
        }
      }
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as UploadResult)
        } catch {
          reject(new Error('上传失败'))
        }
      } else {
        const err = (() => {
          try {
            return JSON.parse(xhr.responseText) as { message?: string }
          } catch {
            return {}
          }
        })()
        reject(new Error(err.message || '上传失败'))
      }
    }
    xhr.onerror = () => reject(new Error('网络错误'))
    xhr.send(formData)
  })
}

/** Weapp upload helper using Taro.uploadFile. */
function uploadFileWeapp(
  filePath: string,
  type: 'cover' | 'audio',
  onProgress?: (percent: number) => void,
): Promise<UploadResult> {
  const token = Taro.getStorageSync('token')
  return new Promise((resolve, reject) => {
    const task = Taro.uploadFile({
      url: `${API_BASE_URL}/upload/${type}`,
      filePath,
      name: 'file',
      header: { Authorization: `Bearer ${token}` },
      success: (res) => {
        try {
          resolve(JSON.parse(res.data) as UploadResult)
        } catch {
          reject(new Error('上传失败'))
        }
      },
      fail: (err) => reject(new Error(err.errMsg || '上传失败')),
    })
    if (onProgress) {
      task.onProgressUpdate((res) => {
        onProgress(res.progress)
      })
    }
  })
}

const TITLE_MAX = 30
const DESC_MAX = 500

export default function Upload() {
  const ok = useAuthRedirect()
  const isDesktop = useIsDesktop()
  const router = Taro.useRouter<{ id?: string }>()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [coverPath, setCoverPath] = useState('')
  const [audioPath, setAudioPath] = useState('')
  const [audioFileName, setAudioFileName] = useState('')
  const [duration, setDuration] = useState(0)
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])
  const [tagInput, setTagInput] = useState('')
  const [tagError, setTagError] = useState('')
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [hotTags, setHotTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [audioUploading, setAudioUploading] = useState(false)
  const [audioProgress, setAudioProgress] = useState(0)

  const coverInputRef = useRef<HTMLInputElement>(null)
  const audioInputRef = useRef<HTMLInputElement>(null)

  // Parse the ?id= param once — if present, we're editing an existing podcast.
  const idParam = router.params.id
  const editingIdParam = idParam ? Number(idParam) : NaN
  const isEditing = Number.isFinite(editingIdParam) && editingIdParam > 0

  // Fetch tags + podcast detail (if editing) on mount.
  useEffect(() => {
    if (!ok) return
    if (isEditing) {
      setEditingId(editingIdParam)
    }

    Promise.all([get<Tag[]>('/tags'), get<Tag[]>('/tags/hot')])
      .then(([tags, hot]) => {
        setAllTags(tags)
        setHotTags(hot)
      })
      .catch(() => {
        // request.ts already surfaced a toast.
      })
      .finally(() => setLoading(false))

    if (isEditing) {
      get<PodcastWithRelations>(`/podcasts/${editingIdParam}`)
        .then((p) => {
          setTitle(p.title)
          setDescription(p.description || '')
          setCoverPath(p.coverPath)
          setAudioPath(p.audioPath)
          setDuration(p.duration)
          setAudioFileName('已有音频')
          setSelectedTagIds(p.tags.map((t) => t.id))
        })
        .catch(() => {
          // request.ts already surfaced a toast.
        })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ok])

  async function addTag(rawName: string) {
    const name = rawName.trim().replace(/^#+\s*/, '')
    if (!name) return
    const found = allTags.find((t) => t.name === name)
    if (found) {
      if (selectedTagIds.includes(found.id)) {
        setTagError('已添加该标签')
        return
      }
      setSelectedTagIds([...selectedTagIds, found.id])
      setTagInput('')
      setTagError('')
      return
    }
    try {
      const tag = await post<Tag>('/tags', { name })
      setAllTags([...allTags, tag])
      setSelectedTagIds([...selectedTagIds, tag.id])
      setTagInput('')
      setTagError('')
    } catch {
      setTagError('创建标签失败')
    }
  }

  function removeTag(id: number) {
    setSelectedTagIds(selectedTagIds.filter((t) => t !== id))
  }

  function toggleHotTag(id: number) {
    if (selectedTagIds.includes(id)) {
      removeTag(id)
    } else {
      setSelectedTagIds([...selectedTagIds, id])
    }
    setTagError('')
  }

  async function onCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    Taro.showLoading({ title: '上传中...' })
    try {
      const result = await uploadFileH5(file, 'cover')
      setCoverPath(result.path)
    } catch {
      Taro.showToast({ title: '封面上传失败', icon: 'none' })
    } finally {
      Taro.hideLoading()
      e.target.value = ''
    }
  }

  async function onAudioChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAudioUploading(true)
    setAudioProgress(0)
    try {
      const result = await uploadFileH5(file, 'audio', (p) => setAudioProgress(p))
      setDuration(result.duration ?? 0)
      setAudioPath(result.path)
      setAudioFileName(file.name)
    } catch {
      Taro.showToast({ title: '音频上传失败', icon: 'none' })
    } finally {
      setAudioUploading(false)
      e.target.value = ''
    }
  }

  async function chooseCoverWeapp() {
    Taro.showLoading({ title: '上传中...' })
    try {
      const res = await Taro.chooseImage({ count: 1, sourceType: ['album', 'camera'] })
      const filePath = res.tempFilePaths[0]
      const result = await uploadFileWeapp(filePath, 'cover')
      setCoverPath(result.path)
    } catch {
      Taro.showToast({ title: '封面上传失败', icon: 'none' })
    } finally {
      Taro.hideLoading()
    }
  }

  async function chooseAudioWeapp() {
    try {
      const res = await Taro.chooseMessageFile({
        count: 1,
        type: 'file',
        extension: ['mp3', 'm4a', 'wav', 'aac', 'mp4'],
      })
      const file = res.tempFiles[0]
      setAudioUploading(true)
      setAudioProgress(0)
      const result = await uploadFileWeapp(file.path, 'audio', (p) => setAudioProgress(p))
      setDuration(result.duration ?? 0)
      setAudioPath(result.path)
      setAudioFileName(file.name)
    } catch {
      Taro.showToast({ title: '音频上传失败', icon: 'none' })
    } finally {
      setAudioUploading(false)
    }
  }

  function chooseCover() {
    if (IS_WEAPP) {
      void chooseCoverWeapp()
    } else {
      coverInputRef.current?.click()
    }
  }

  function chooseAudio() {
    if (IS_WEAPP) {
      void chooseAudioWeapp()
    } else {
      audioInputRef.current?.click()
    }
  }

  function goBack() {
    Taro.navigateBack()
  }

  const canPublish =
    title.trim().length > 0 &&
    coverPath.length > 0 &&
    audioPath.length > 0 &&
    duration > 0 &&
    !submitting

  async function handlePublish() {
    if (!canPublish) return
    setSubmitting(true)
    Taro.showLoading({ title: editingId ? '保存中...' : '发布中...' })
    try {
      const body = {
        title: title.trim(),
        description: description.trim(),
        coverPath,
        audioPath,
        duration,
        tagIds: selectedTagIds,
      }
      if (editingId) {
        await put(`/podcasts/${editingId}`, body)
        Taro.hideLoading()
        Taro.showToast({ title: '保存成功', icon: 'success' })
        setTimeout(() => Taro.navigateBack(), 1000)
      } else {
        await post('/podcasts', body)
        Taro.hideLoading()
        Taro.showToast({ title: '发布成功', icon: 'success' })
        setTimeout(() => Taro.switchTab({ url: '/pages/create/index' }), 1000)
      }
    } catch {
      Taro.hideLoading()
      // request.ts already surfaced an error toast.
    } finally {
      setSubmitting(false)
    }
  }

  if (!ok) return null

  if (loading) {
    return (
      <View className='flex min-h-screen items-center justify-center bg-surface'>
        <Text className='text-sm text-on-surface-variant'>加载中...</Text>
      </View>
    )
  }

  return (
    <View className='min-h-screen bg-surface'>
      {/* Hidden file inputs (H5 only — weapp uses Taro.chooseImage/chooseMessageFile) */}
      {!IS_WEAPP && (
        <>
          <input
            ref={coverInputRef}
            type='file'
            accept='image/*'
            style={{ display: 'none' }}
            onChange={onCoverChange}
          />
          <input
            ref={audioInputRef}
            type='file'
            accept="audio/mpeg,audio/mp3,audio/aac,audio/wav,audio/x-wav,audio/x-m4a,audio/m4a,audio/mp4,video/mp4,.mp3,.m4a,.wav,.aac,.mp4"
            style={{ display: 'none' }}
            onChange={onAudioChange}
          />
        </>
      )}

      {/* Top nav bar */}
      <View
        className='fixed top-0 left-0 right-0 z-50 flex h-16 items-center justify-between px-4'
        style={{
          backgroundColor: 'rgba(251, 249, 248, 0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <View
          onClick={goBack}
          className='flex h-10 w-10 items-center justify-center text-primary active:scale-95'
          style={{ fontSize: '22px' }}
        >
          ←
        </View>
        <Text className='text-xl font-semibold text-primary'>上传播客</Text>
        <View
          onClick={handlePublish}
          className={`px-5 py-2 rounded-full text-sm font-semibold transition-all active:scale-95 ${
            canPublish
              ? 'bg-primary text-on-primary'
              : 'bg-surface-container text-outline opacity-60'
          }`}
        >
          {editingId ? '保存' : '发布'}
        </View>
      </View>

      {/* Form body */}
      <View
        className='mx-auto max-w-2xl px-5 pb-10 pt-20'
        style={isDesktop ? { maxWidth: '768px' } : undefined}
      >
        {/* 1. Cover upload */}
        <View className='mb-8 flex flex-col items-center'>
          <View
            onClick={chooseCover}
            className='relative flex h-48 w-48 cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden rounded-xl border-2 border-dashed border-outline-variant bg-surface-container-high transition-all active:scale-[0.98]'
          >
            {coverPath ? (
              <>
                <Image
                  src={coverUrl(coverPath)}
                  className='absolute inset-0 h-full w-full'
                  mode='aspectFill'
                />
                <View
                  className='absolute inset-0 flex items-center justify-center'
                  style={{ background: 'rgba(0,0,0,0.25)' }}
                >
                  <Text className='rounded-full bg-black/60 px-3 py-1 text-xs text-white'>
                    点击更换
                  </Text>
                </View>
              </>
            ) : (
              <>
                <View className='flex h-12 w-12 items-center justify-center rounded-full bg-primary-container text-2xl text-on-primary-container'>
                  +
                </View>
                <Text className='text-xs font-medium text-on-surface-variant'>
                  点击上传封面
                </Text>
              </>
            )}
          </View>
        </View>

        {/* 2. Title */}
        <View className='mb-6'>
          <View className='mb-2 flex items-center justify-between px-1'>
            <Text className='text-xs font-semibold uppercase tracking-wider text-on-surface-variant'>
              播客名称
            </Text>
            <Text className='text-[10px] text-outline'>
              {title.length}/{TITLE_MAX}
            </Text>
          </View>
          <Input
            value={title}
            maxlength={TITLE_MAX}
            placeholder='输入你的播客标题...'
            placeholderClass='text-outline-variant'
            onInput={(e) => setTitle(e.detail.value)}
            className='h-12 w-full rounded-xl bg-surface-container-low px-4 text-base text-on-surface'
            style={{ border: 'none', lineHeight: '48px' }}
          />
        </View>

        {/* 3. Description */}
        <View className='mb-6'>
          <Text className='mb-2 block px-1 text-xs font-semibold uppercase tracking-wider text-on-surface-variant'>
            内容简介
          </Text>
          <Textarea
            value={description}
            maxlength={DESC_MAX}
            placeholder='介绍一下你的播客内容'
            placeholderClass='text-outline-variant'
            onInput={(e) => setDescription(e.detail.value)}
            className='w-full rounded-xl bg-surface-container-low p-4 text-sm text-on-surface'
            style={{ minHeight: '100px', border: 'none' }}
          />
        </View>

        {/* 4. Tags */}
        <View className='mb-6'>
          <Text className='mb-2 block px-1 text-xs font-semibold uppercase tracking-wider text-on-surface-variant'>
            添加标签
          </Text>
          <View className='relative'>
            <Input
              value={tagInput}
              placeholder='输入标签名，按回车添加...'
              placeholderClass='text-outline-variant'
              onInput={(e) => {
                setTagInput(e.detail.value)
                setTagError('')
              }}
              onConfirm={(e) => addTag(e.detail.value)}
              className='h-12 w-full rounded-xl bg-surface-container-low pl-4 pr-14 text-sm text-on-surface'
              style={{ border: 'none', lineHeight: '48px' }}
            />
            <View
              onClick={() => addTag(tagInput)}
              className='absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary active:scale-95'
            >
              添加
            </View>
          </View>
          {tagError && (
            <Text className='mt-1 block px-1 text-xs text-error'>{tagError}</Text>
          )}

          {/* Selected tags */}
          {selectedTagIds.length > 0 && (
            <View className='mt-3 flex flex-wrap gap-2'>
              {selectedTagIds.map((id) => {
                const tag = allTags.find((t) => t.id === id)
                if (!tag) return null
                return (
                  <View
                    key={id}
                    className='flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-on-primary'
                  >
                    <Text>{tag.name}</Text>
                    <Text
                      onClick={() => removeTag(id)}
                      className='ml-1 text-sm leading-none'
                    >
                      ×
                    </Text>
                  </View>
                )
              })}
            </View>
          )}

          {/* Hot tags */}
          {hotTags.length > 0 && (
            <View className='mt-4'>
              <Text className='mb-2 block px-1 text-xs font-semibold text-on-surface-variant'>
                热门标签
              </Text>
              <View className='flex flex-wrap gap-2'>
                {hotTags.map((tag) => {
                  const selected = selectedTagIds.includes(tag.id)
                  return (
                    <View
                      key={tag.id}
                      onClick={() => toggleHotTag(tag.id)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors active:scale-95 ${
                        selected
                          ? 'bg-primary text-on-primary'
                          : 'bg-surface-container-high text-on-surface-variant'
                      }`}
                    >
                      # {tag.name}
                    </View>
                  )
                })}
              </View>
            </View>
          )}
        </View>

        {/* 5. Audio upload */}
        <View className='mb-6'>
          <Text className='mb-2 block px-1 text-xs font-semibold uppercase tracking-wider text-on-surface-variant'>
            音频
          </Text>

          {/* Current audio info */}
          {audioPath && !audioUploading && (
            <View className='mb-3 flex items-center justify-between rounded-xl bg-surface-container-low p-4'>
              <View className='min-w-0 flex-1'>
                <Text className='block truncate text-sm text-on-surface'>
                  {audioFileName || '音频文件'}
                </Text>
                <Text className='mt-0.5 block text-xs text-outline'>
                  时长 {formatDuration(duration)}
                </Text>
              </View>
              <View
                onClick={chooseAudio}
                className='ml-3 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary active:scale-95'
              >
                更换
              </View>
            </View>
          )}

          {/* Upload progress bar */}
          {audioUploading && (
            <View className='mb-3 rounded-xl bg-surface-container-low p-4'>
              <View className='mb-2 flex items-center justify-between'>
                <Text className='text-sm text-on-surface-variant'>上传转码中...</Text>
                <Text className='text-xs font-semibold text-primary'>{audioProgress}%</Text>
              </View>
              <View className='h-2 overflow-hidden rounded-full bg-surface-container-high'>
                <View
                  className='h-full rounded-full bg-primary transition-all duration-200'
                  style={{ width: `${audioProgress}%` }}
                />
              </View>
            </View>
          )}

          {/* Full-width upload button */}
          {!audioUploading && (
            <View
              onClick={chooseAudio}
              className='flex cursor-pointer items-center justify-center gap-3 rounded-xl bg-surface-container p-5 transition-all active:scale-[0.98]'
            >
              <View className='flex h-10 w-10 items-center justify-center rounded-full bg-white text-lg text-primary shadow-sm'>
                ♪
              </View>
              <Text className='text-sm font-medium text-primary'>从本地选择音频</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  )
}
