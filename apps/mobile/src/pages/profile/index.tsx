import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import AppLayout from '../../components/AppLayout'
import { useIsDesktop } from '../../components/AppLayout/useIsDesktop'
import { useAuthRedirect } from '../../utils/route-guard'
import { get } from '../../utils/request'
import { useAuthStore } from '../../store/auth'
import type { User, Class } from '@qingmalaya/shared'

/**
 * Profile (我的) page — Task 18.
 *
 * Adapts the reference design (移动端UI参考/profile_qing_malaya/code.html) to
 * Taro components. Material Symbols icons are omitted (font not bundled); we
 * use emoji glyphs as lightweight icon stand-ins for the function list.
 */

// Relative path of the static file server. Avatar URLs come back as something
// like "uploads/2026/07/uuid.jpg" — prepended with /static/.
const STATIC_BASE = 'http://localhost:3000/static/'

/** Compact number formatter: 1000+ -> "1k", 10000+ -> "1w". */
function formatCount(n: number): string {
  if (n >= 10000) {
    const w = n / 10000
    return `${w % 1 === 0 ? w.toFixed(0) : w.toFixed(1)}w`
  }
  if (n >= 1000) {
    const k = n / 1000
    return `${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}k`
  }
  return String(n)
}

/** Stable hue derived from the user id so placeholder avatars vary per user. */
function avatarHue(seed: number): number {
  return (seed * 47) % 360
}

interface FunctionItem {
  key: string
  label: string
  icon: string
  tint: string
  danger?: boolean
  onTap: () => void
}

export default function Profile() {
  const ok = useAuthRedirect()
  const isDesktop = useIsDesktop()
  const { user, clearAuth, updateUser } = useAuthStore()
  const [classes, setClasses] = useState<Class[]>([])

  useEffect(() => {
    if (!ok) return
    // Fetch the class catalog and refresh the user profile in the background.
    // Errors are surfaced by request.ts as toasts; we swallow them here so the
    // page still renders with the cached user from the auth store.
    get<Class[]>('/classes')
      .then(setClasses)
      .catch(() => {})
    if (user) {
      get<User>('/users/me')
        .then(updateUser)
        .catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ok])

  const handleLogout = () => {
    Taro.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      confirmText: '退出',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          clearAuth()
          Taro.redirectTo({ url: '/pages/login/index' })
        }
      }
    })
  }

  const showComingSoon = (label: string) => {
    Taro.showToast({ title: `${label}功能开发中`, icon: 'none' })
  }

  const showAbout = () => {
    Taro.showModal({
      title: '关于清马拉雅',
      content:
        '清马拉雅 v1.0\nG25 校园播客平台\n让校园声音被听见，让青春故事被记录。',
      showCancel: false,
      confirmText: '知道了'
    })
  }

  if (!ok || !user) return null

  const className =
    classes.find((c) => c.id === user.classId)?.name ?? '未分班'
  const avatarUrl = user.avatar ? `${STATIC_BASE}${user.avatar}` : null
  const initial = user.name ? user.name.charAt(0) : '?'
  const placeholderBg = `hsl(${avatarHue(user.id)} 40% 70%)`

  const generalItems: FunctionItem[] = [
    {
      key: 'settings',
      label: '账号设置',
      icon: '⚙',
      tint: 'text-primary',
      onTap: () => showComingSoon('账号设置')
    },
    {
      key: 'favorites',
      label: '我的收藏',
      icon: '★',
      tint: 'text-secondary',
      onTap: () => showComingSoon('我的收藏')
    },
    {
      key: 'history',
      label: '播放历史',
      icon: '⏱',
      tint: 'text-tertiary',
      onTap: () => showComingSoon('播放历史')
    }
  ]

  const supportItems: FunctionItem[] = [
    {
      key: 'about',
      label: '关于我们',
      icon: 'ⓘ',
      tint: 'text-on-surface-variant',
      onTap: showAbout
    },
    {
      key: 'logout',
      label: '退出登录',
      icon: '⎋',
      tint: 'text-error',
      danger: true,
      onTap: handleLogout
    }
  ]

  return (
    <AppLayout currentTab='profile'>
      <View
        className='mx-auto max-w-md px-5 pt-6 pb-4'
        style={isDesktop ? { maxWidth: '672px' } : undefined}
      >
        {/* Page title */}
        <Text
          className='block text-primary'
          style={{
            fontSize: '20px',
            fontWeight: '600',
            lineHeight: '28px',
            marginBottom: '20px'
          }}
        >
          我的
        </Text>

        {/* 18.1 Personal info section */}
        <View className='flex flex-col items-center text-center'>
          <View
            className='relative'
            style={{ width: '96px', height: '96px' }}
          >
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                className='rounded-full'
                style={{
                  width: '96px',
                  height: '96px',
                  border: '4px solid #e0f7fa',
                  objectFit: 'cover'
                }}
                mode='aspectFill'
              />
            ) : (
              <View
                className='flex items-center justify-center rounded-full text-on-primary'
                style={{
                  width: '96px',
                  height: '96px',
                  backgroundColor: placeholderBg,
                  border: '4px solid #e0f7fa',
                  fontSize: '36px',
                  fontWeight: '600'
                }}
              >
                {initial}
              </View>
            )}
          </View>
          <Text
            className='block text-on-surface'
            style={{
              fontSize: '24px',
              fontWeight: '600',
              lineHeight: '32px',
              letterSpacing: '-0.01em',
              marginTop: '16px'
            }}
          >
            {user.name}
          </Text>
          <View
            className='flex flex-wrap items-center justify-center'
            style={{ gap: '8px', marginTop: '6px' }}
          >
            <View
              className='rounded-full text-on-secondary-container'
              style={{
                backgroundColor: 'rgba(187, 233, 255, 0.3)',
                padding: '2px 10px'
              }}
            >
              <Text
                style={{
                  fontSize: '11px',
                  fontWeight: '500',
                  lineHeight: '14px'
                }}
              >
                {className}
              </Text>
            </View>
            <Text className='text-outline' style={{ fontSize: '11px' }}>
              •
            </Text>
            <Text
              className='text-outline'
              style={{ fontSize: '11px', fontWeight: '500' }}
            >
              学号 {user.studentId}
            </Text>
          </View>
        </View>

        {/* 18.2 Stats section */}
        <View
          className='grid grid-cols-2'
          style={{ gap: '16px', marginTop: '24px' }}
        >
          <View
            className='rounded-xl'
            style={{
              backgroundColor: '#f5f3f3',
              padding: '16px',
              border: '1px solid rgba(194, 199, 200, 0.2)'
            }}
          >
            <View
              className='flex items-center text-primary'
              style={{ gap: '6px', marginBottom: '4px' }}
            >
              <Text style={{ fontSize: '16px' }}>🎧</Text>
              <Text
                style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  letterSpacing: '0.05em'
                }}
              >
                总收听量
              </Text>
            </View>
            <Text
              className='block text-on-surface'
              style={{
                fontSize: '32px',
                fontWeight: '700',
                lineHeight: '40px',
                letterSpacing: '-0.02em'
              }}
            >
              {formatCount(user.totalListens)}
            </Text>
          </View>
          <View
            className='rounded-xl'
            style={{
              backgroundColor: '#f5f3f3',
              padding: '16px',
              border: '1px solid rgba(194, 199, 200, 0.2)'
            }}
          >
            <View
              className='flex items-center text-secondary'
              style={{ gap: '6px', marginBottom: '4px' }}
            >
              <Text style={{ fontSize: '16px' }}>♥</Text>
              <Text
                style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  letterSpacing: '0.05em'
                }}
              >
                总获赞
              </Text>
            </View>
            <Text
              className='block text-on-surface'
              style={{
                fontSize: '32px',
                fontWeight: '700',
                lineHeight: '40px',
                letterSpacing: '-0.02em'
              }}
            >
              {formatCount(user.totalLikes)}
            </Text>
          </View>
        </View>

        {/* 18.3 Function list — General */}
        <Text
          className='block text-outline'
          style={{
            fontSize: '12px',
            fontWeight: '600',
            letterSpacing: '0.1em',
            marginTop: '24px',
            marginLeft: '4px',
            marginBottom: '8px'
          }}
        >
          常用功能
        </Text>
        <View
          className='overflow-hidden rounded-xl'
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid rgba(194, 199, 200, 0.15)'
          }}
        >
          {generalItems.map((item, idx) => (
            <FunctionRow key={item.key} item={item} last={idx === generalItems.length - 1} />
          ))}
        </View>

        {/* 18.3 Function list — Support + Logout */}
        <Text
          className='block text-outline'
          style={{
            fontSize: '12px',
            fontWeight: '600',
            letterSpacing: '0.1em',
            marginTop: '16px',
            marginLeft: '4px',
            marginBottom: '8px'
          }}
        >
          其他
        </Text>
        <View
          className='overflow-hidden rounded-xl'
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid rgba(194, 199, 200, 0.15)'
          }}
        >
          {supportItems.map((item, idx) => (
            <FunctionRow key={item.key} item={item} last={idx === supportItems.length - 1} />
          ))}
        </View>
      </View>
    </AppLayout>
  )
}

interface FunctionRowProps {
  item: FunctionItem
  last: boolean
}

function FunctionRow({ item, last }: FunctionRowProps) {
  const iconBg = item.danger ? 'rgba(186, 26, 26, 0.1)' : 'rgba(77, 98, 101, 0.08)'
  return (
    <View>
      <View
        onClick={item.onTap}
        className='flex items-center justify-between'
        style={{ padding: '16px' }}
      >
        <View className='flex items-center' style={{ gap: '16px' }}>
          <View
            className={`flex items-center justify-center rounded-full ${item.tint}`}
            style={{
              width: '40px',
              height: '40px',
              backgroundColor: iconBg,
              fontSize: '18px'
            }}
          >
            {item.icon}
          </View>
          <Text
            className={item.danger ? 'text-error' : 'text-on-surface'}
            style={{ fontSize: '16px', fontWeight: '400', lineHeight: '24px' }}
          >
            {item.label}
          </Text>
        </View>
        <Text
          className={item.danger ? 'text-error' : 'text-outline'}
          style={{
            fontSize: '20px',
            opacity: item.danger ? 0.6 : 1,
            lineHeight: '24px'
          }}
        >
          ›
        </Text>
      </View>
      {!last && (
        <View
          style={{
            height: '1px',
            backgroundColor: 'rgba(194, 199, 200, 0.2)',
            marginLeft: '16px'
          }}
        />
      )}
    </View>
  )
}
