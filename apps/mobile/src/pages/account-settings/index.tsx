import { useEffect, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image, Textarea, Button } from '@tarojs/components'
import AppLayout from '../../components/AppLayout'
import PageContainer from '../../components/AppLayout/PageContainer'
import { useAuthRedirect } from '../../utils/route-guard'
import { useAuthStore } from '../../store/auth'
import { get, put } from '../../utils/request'
import { coverUrl } from '../../utils/format'
import { API_BASE_URL } from '../../config/env'
import type { User, Class } from '@qingmalaya/shared'

const IS_WEAPP = process.env.TARO_ENV === 'weapp'

interface UploadResult {
  path: string
  size: number
  mimetype: string
}

async function uploadAvatarH5(file: File): Promise<UploadResult> {
  const formData = new FormData()
  formData.append('file', file)
  const token = Taro.getStorageSync('token')
  const res = await fetch(`${API_BASE_URL}/upload/cover`, {
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

function uploadAvatarWeapp(filePath: string): Promise<UploadResult> {
  const token = Taro.getStorageSync('token')
  return new Promise((resolve, reject) => {
    Taro.uploadFile({
      url: `${API_BASE_URL}/upload/cover`,
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
  })
}

function handleBack(): void {
  Taro.navigateBack({
    fail: () => Taro.switchTab({ url: '/pages/profile/index' }),
  })
}

function avatarHue(seed: number): number {
  return (seed * 47) % 360
}

export default function AccountSettings() {
  const ok = useAuthRedirect()
  const { user, updateUser } = useAuthStore()
  const [classes, setClasses] = useState<Class[]>([])
  const [bio, setBio] = useState('')
  const [bioSaving, setBioSaving] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!ok) return
    get<Class[]>('/classes')
      .then(setClasses)
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ok])

  useEffect(() => {
    if (user) setBio(user.bio ?? '')
  }, [user])

  if (!ok || !user) return null

  const className =
    classes.find((c) => c.id === user.classId)?.name ?? '未分班'
  const avatarUrl = user.avatar ? coverUrl(user.avatar) : null
  const initial = user.name ? user.name.charAt(0) : '?'
  const placeholderBg = `hsl(${avatarHue(user.id)} 40% 70%)`

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarUploading(true)
    Taro.showLoading({ title: '上传中...' })
    try {
      const result = await uploadAvatarH5(file)
      await put<User>('/users/me', { avatar: result.path })
      updateUser({ avatar: result.path })
      Taro.showToast({ title: '头像更新成功', icon: 'success' })
    } catch (err) {
      Taro.showToast({
        title: err instanceof Error ? err.message : '头像上传失败',
        icon: 'none',
      })
    } finally {
      Taro.hideLoading()
      setAvatarUploading(false)
      e.target.value = ''
    }
  }

  async function chooseAvatarWeapp() {
    Taro.showLoading({ title: '上传中...' })
    setAvatarUploading(true)
    try {
      const res = await Taro.chooseImage({
        count: 1,
        sourceType: ['album', 'camera'],
      })
      const filePath = res.tempFilePaths[0]
      const result = await uploadAvatarWeapp(filePath)
      await put<User>('/users/me', { avatar: result.path })
      updateUser({ avatar: result.path })
      Taro.showToast({ title: '头像更新成功', icon: 'success' })
    } catch (err) {
      Taro.showToast({
        title: err instanceof Error ? err.message : '头像上传失败',
        icon: 'none',
      })
    } finally {
      Taro.hideLoading()
      setAvatarUploading(false)
    }
  }

  function handleAvatarTap() {
    if (avatarUploading) return
    if (IS_WEAPP) {
      chooseAvatarWeapp()
    } else {
      fileInputRef.current?.click()
    }
  }

  async function handleBioSave() {
    if (bio === (user?.bio ?? '')) return
    setBioSaving(true)
    try {
      await put<User>('/users/me', { bio }, { silent: true })
      updateUser({ bio })
      Taro.showToast({ title: '简介已保存', icon: 'success' })
    } catch (err) {
      Taro.showToast({
        title: err instanceof Error ? err.message : '保存失败',
        icon: 'none',
      })
    } finally {
      setBioSaving(false)
    }
  }

  function handleChangePassword() {
    Taro.navigateTo({ url: '/pages/change-password/index?from=settings' })
  }

  const bioChanged = bio !== (user.bio ?? '')

  return (
    <AppLayout currentTab='profile' hideChrome>
      <PageContainer>
        {/* Hidden file input for H5 avatar selection */}
        {!IS_WEAPP && (
          <input
            ref={fileInputRef}
            type='file'
            accept='image/*'
            style={{ display: 'none' }}
            onChange={handleAvatarChange}
          />
        )}

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

        <View className='mx-auto max-w-md px-4 pb-10'>
          {/* Page title */}
          <Text className='mb-6 block text-xl font-bold tracking-tight text-primary'>
            账号设置
          </Text>

          {/* Avatar section */}
          <View className='flex flex-col items-center'>
            <View
              onClick={handleAvatarTap}
              className='relative'
              style={{ width: '100px', height: '100px' }}
            >
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  className='rounded-full'
                  style={{
                    width: '100px',
                    height: '100px',
                    border: '4px solid #e0f7fa',
                    objectFit: 'cover',
                  }}
                  mode='aspectFill'
                />
              ) : (
                <View
                  className='flex items-center justify-center rounded-full text-on-primary'
                  style={{
                    width: '100px',
                    height: '100px',
                    backgroundColor: placeholderBg,
                    border: '4px solid #e0f7fa',
                    fontSize: '38px',
                    fontWeight: '600',
                  }}
                >
                  {initial}
                </View>
              )}
              {/* Camera overlay */}
              <View
                className='flex items-center justify-center rounded-full'
                style={{
                  position: 'absolute',
                  bottom: '0',
                  right: '0',
                  width: '32px',
                  height: '32px',
                  backgroundColor: '#4d6265',
                  border: '3px solid #fbf9f8',
                }}
              >
                <Text style={{ fontSize: '16px', color: '#fff' }}>📷</Text>
              </View>
            </View>
            <Text
              className='mt-3 block text-outline'
              style={{ fontSize: '12px' }}
            >
              点击头像更换
            </Text>
          </View>

          {/* Read-only info card */}
          <Text
            className='block text-outline'
            style={{
              fontSize: '12px',
              fontWeight: '600',
              letterSpacing: '0.1em',
              marginTop: '28px',
              marginLeft: '4px',
              marginBottom: '8px',
            }}
          >
            基本信息
          </Text>
          <View
            className='overflow-hidden rounded-xl'
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid rgba(194, 199, 200, 0.15)',
            }}
          >
            <InfoRow label='姓名' value={user.name} />
            <Divider />
            <InfoRow label='学号' value={user.studentId} />
            <Divider />
            <InfoRow label='班级' value={className} />
          </View>

          {/* Bio editing card */}
          <Text
            className='block text-outline'
            style={{
              fontSize: '12px',
              fontWeight: '600',
              letterSpacing: '0.1em',
              marginTop: '20px',
              marginLeft: '4px',
              marginBottom: '8px',
            }}
          >
            个人简介
          </Text>
          <View
            className='rounded-xl p-4'
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid rgba(194, 199, 200, 0.15)',
            }}
          >
            <Textarea
              value={bio}
              onInput={(e) => setBio(e.detail.value)}
              placeholder='写点什么介绍一下自己吧...'
              placeholderClass='text-outline-variant'
              maxlength={200}
              style={{
                width: '100%',
                minHeight: '80px',
                fontSize: '14px',
                lineHeight: '22px',
                color: '#1d1b20',
              }}
            />
            <View
              className='flex items-center justify-between'
              style={{ marginTop: '8px' }}
            >
              <Text className='text-outline' style={{ fontSize: '11px' }}>
                {bio.length}/200
              </Text>
              <Button
                onClick={handleBioSave}
                disabled={!bioChanged || bioSaving}
                className='text-on-primary'
                style={{
                  height: '36px',
                  lineHeight: '36px',
                  padding: '0 20px',
                  borderRadius: '9999px',
                  fontSize: '13px',
                  fontWeight: '600',
                  backgroundColor: bioChanged && !bioSaving ? '#4d6265' : '#c2c7c8',
                  border: 'none',
                }}
                hoverClass='none'
              >
                {bioSaving ? '保存中...' : '保存'}
              </Button>
            </View>
          </View>

          {/* Security section */}
          <Text
            className='block text-outline'
            style={{
              fontSize: '12px',
              fontWeight: '600',
              letterSpacing: '0.1em',
              marginTop: '20px',
              marginLeft: '4px',
              marginBottom: '8px',
            }}
          >
            安全设置
          </Text>
          <View
            className='overflow-hidden rounded-xl'
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid rgba(194, 199, 200, 0.15)',
            }}
          >
            <View
              onClick={handleChangePassword}
              className='flex items-center justify-between'
              style={{ padding: '16px' }}
            >
              <View className='flex items-center' style={{ gap: '16px' }}>
                <View
                  className='flex items-center justify-center rounded-full text-primary'
                  style={{
                    width: '40px',
                    height: '40px',
                    backgroundColor: 'rgba(77, 98, 101, 0.08)',
                    fontSize: '18px',
                  }}
                >
                  <Text className='material-symbols-outlined' style={{ fontSize: '20px' }}>
                    lock
                  </Text>
                </View>
                <Text
                  className='text-on-surface'
                  style={{ fontSize: '16px', fontWeight: '400', lineHeight: '24px' }}
                >
                  修改密码
                </Text>
              </View>
              <Text
                className='text-outline'
                style={{ fontSize: '20px', lineHeight: '24px' }}
              >
                ›
              </Text>
            </View>
          </View>
        </View>
      </PageContainer>
    </AppLayout>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View
      className='flex items-center justify-between'
      style={{ padding: '16px' }}
    >
      <Text
        className='text-on-surface-variant'
        style={{ fontSize: '14px', fontWeight: '500' }}
      >
        {label}
      </Text>
      <Text
        className='text-on-surface'
        style={{ fontSize: '15px', fontWeight: '400' }}
      >
        {value}
      </Text>
    </View>
  )
}

function Divider() {
  return (
    <View
      style={{
        height: '1px',
        backgroundColor: 'rgba(194, 199, 200, 0.2)',
        marginLeft: '16px',
      }}
    />
  )
}
