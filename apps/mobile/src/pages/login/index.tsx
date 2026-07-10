import { useState, type CSSProperties } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Input, Button } from '@tarojs/components'
import { post } from '../../utils/request'
import { useAuthStore } from '../../store/auth'
import type { LoginResponse } from '@qingmalaya/shared'

/**
 * Login page.
 *
 * Adapts the reference design (移动端UI参考/login_qing_malaya/code.html) to
 * Taro components. Material Symbols icons are omitted because that font isn't
 * loaded in the Taro bundle; the brand wordmark alone carries the hierarchy.
 * Background light arcs are rendered as CSS gradients on View layers (no
 * external images), kept very subtle per DESIGN.md.
 */

// Inline style objects keep the page self-contained — Tailwind doesn't process
// the multi-stop radial gradients we need for the arcs.
const ARC_STYLE_BASE: CSSProperties = {
  position: 'absolute',
  width: '180%',
  height: '180%',
  borderRadius: '50%',
  border: '1px solid rgba(77, 98, 101, 0.06)',
  pointerEvents: 'none'
}

export default function Login() {
  const [studentId, setStudentId] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [idFocused, setIdFocused] = useState(false)
  const [pwdFocused, setPwdFocused] = useState(false)
  const [agreed, setAgreed] = useState(false)

  const setAuth = useAuthStore((s) => s.setAuth)

  const canSubmit = studentId.trim().length > 0 && password.length > 0 && !loading && agreed

  async function handleSubmit() {
    if (!canSubmit) return
    setLoading(true)
    try {
      const data = await post<LoginResponse>(
        '/auth/login',
        { studentId: studentId.trim(), password },
        { skipAuth: true }
      )
      setAuth({
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        mustChangePassword: data.mustChangePassword
      })
      // Mirror the access token under the legacy `token` key consumed by
      // request.ts for the Authorization header.
      Taro.setStorageSync('token', data.accessToken)

      if (data.mustChangePassword) {
        Taro.redirectTo({ url: '/pages/change-password/index' })
      } else {
        Taro.switchTab({ url: '/pages/discovery/index' })
      }
    } catch (err) {
      // request.ts already surfaced a toast; just log for debugging.
      console.warn('[login] failed', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="relative min-h-screen w-full overflow-hidden bg-surface text-on-surface">
      {/* Background light arcs — subtle per DESIGN.md ("弱化处理不抢视觉焦点"). */}
      <View className="absolute inset-0 pointer-events-none" style={{ overflow: 'hidden' }}>
        <View
          style={{
            ...ARC_STYLE_BASE,
            top: '-30%',
            left: '-40%',
            transform: 'rotate(-15deg)'
          }}
        />
        <View
          style={{
            ...ARC_STYLE_BASE,
            top: '-50%',
            left: '-40%',
            transform: 'rotate(-15deg)',
            opacity: 0.6
          }}
        />
        <View
          style={{
            ...ARC_STYLE_BASE,
            bottom: '-40%',
            right: '-50%',
            transform: 'rotate(15deg)',
            opacity: 0.7
          }}
        />
      </View>

      {/* Main content */}
      <View className="relative z-10 flex min-h-screen flex-col items-center justify-center px-5 py-10">
        <View className="w-full max-w-md">
          {/* Header */}
          <View className="mb-10 flex flex-col items-center">
            <Text
              className="text-primary"
              style={{
                fontSize: '32px',
                fontWeight: '700',
                letterSpacing: '-0.02em',
                lineHeight: '40px'
              }}
            >
              清马拉雅
            </Text>
            <Text
              className="mt-2 text-on-surface-variant"
              style={{
                fontSize: '12px',
                fontWeight: '600',
                letterSpacing: '0.15em',
                opacity: 0.8
              }}
            >
              G25学生播客平台
            </Text>
          </View>

          {/* Form card */}
          <View
            className="w-full rounded-xl p-6"
            style={{
              background: 'rgba(251, 249, 248, 0.8)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(114, 120, 121, 0.1)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)'
            }}
          >
            {/* Student ID */}
            <View className="mb-4">
              <Text className="mb-1.5 block text-on-surface-variant" style={{ fontSize: '12px', fontWeight: '600', letterSpacing: '0.05em' }}>
                学号
              </Text>
              <Input
                type="text"
                value={studentId}
                placeholder="请输入学号"
                placeholderClass="text-outline-variant"
                onInput={(e) => setStudentId(e.detail.value)}
                onFocus={() => setIdFocused(true)}
                onBlur={() => setIdFocused(false)}
                className="w-full rounded-lg px-4 py-3.5 text-on-surface"
                style={{
                  fontSize: '16px',
                  lineHeight: '24px',
                  backgroundColor: '#efeded',
                  border: idFocused ? '2px solid #4d6265' : '2px solid transparent',
                  transition: 'border-color 0.2s'
                }}
              />
            </View>

            {/* Password */}
            <View className="mb-6">
              <Text className="mb-1.5 block text-on-surface-variant" style={{ fontSize: '12px', fontWeight: '600', letterSpacing: '0.05em' }}>
                密码
              </Text>
              <Input
                type="text"
                password
                value={password}
                placeholder="请输入密码"
                placeholderClass="text-outline-variant"
                onInput={(e) => setPassword(e.detail.value)}
                onFocus={() => setPwdFocused(true)}
                onBlur={() => setPwdFocused(false)}
                className="w-full rounded-lg px-4 py-3.5 text-on-surface"
                style={{
                  fontSize: '16px',
                  lineHeight: '24px',
                  backgroundColor: '#efeded',
                  border: pwdFocused ? '2px solid #4d6265' : '2px solid transparent',
                  transition: 'border-color 0.2s'
                }}
              />
            </View>

            {/* Submit button */}
            <Button
              loading={loading}
              disabled={!canSubmit}
              onClick={handleSubmit}
              className="w-full text-on-primary"
              style={{
                height: '52px',
                borderRadius: '9999px',
                backgroundColor: canSubmit ? '#4d6265' : '#c2c7c8',
                fontSize: '16px',
                fontWeight: '600',
                border: 'none',
                lineHeight: '52px'
              }}
              // Reset Taro Button default styles so it looks like a flat pill.
              hoverClass="none"
            >
              {loading ? '登录中...' : '登录'}
            </Button>
          </View>

          {/* Agreement checkbox */}
          <View className="mt-6 flex items-center justify-center" style={{ gap: '6px' }}>
            <View
              onClick={() => setAgreed((v) => !v)}
              className="flex items-center justify-center"
              style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                border: agreed ? 'none' : '2px solid #c2c7c8',
                backgroundColor: agreed ? '#4d6265' : 'transparent',
                flexShrink: 0,
                transition: 'all 0.2s',
              }}
            >
              {agreed && (
                <Text className="text-white" style={{ fontSize: '12px', fontWeight: '700', lineHeight: '18px' }}>
                  ✓
                </Text>
              )}
            </View>
            <Text className="text-on-surface-variant" style={{ fontSize: '12px', fontWeight: '500' }}>
              我已阅读并同意
            </Text>
            <View onClick={() => Taro.navigateTo({ url: '/pages/terms/index' })}>
              <Text
                className="text-primary"
                style={{ fontSize: '12px', fontWeight: '600' }}
              >
                《用户须知》
              </Text>
            </View>
            <Text className="text-on-surface-variant" style={{ fontSize: '12px', fontWeight: '500' }}>
              和
            </Text>
            <View onClick={() => Taro.navigateTo({ url: '/pages/privacy/index' })}>
              <Text
                className="text-primary"
                style={{ fontSize: '12px', fontWeight: '600' }}
              >
                《隐私政策》
              </Text>
            </View>
          </View>

          {/* Footer disclaimer */}
          <View className="mt-6 flex justify-center">
            <Text className="text-on-surface-variant" style={{ fontSize: '11px', fontWeight: '500', opacity: 0.6, textAlign: 'center' }}>
              仅限本校师生使用，使用学号快捷登录
            </Text>
          </View>
        </View>
      </View>
    </View>
  )
}
