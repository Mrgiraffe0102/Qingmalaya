import { useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Input, Button } from '@tarojs/components'
import { post } from '../../utils/request'
import { useAuthStore } from '../../store/auth'

/**
 * Change password page.
 *
 * Reached either as a forced step after first login (mustChangePassword=true)
 * or voluntarily from the profile page. On success the `mustChangePassword`
 * flag is cleared and the user is sent to the discovery tab.
 */

const MIN_PASSWORD_LENGTH = 6

interface ChangePasswordResponse {
  success: boolean
}

export default function ChangePassword() {
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState<string | null>(null)

  const setMustChangePassword = useAuthStore((s) => s.setMustChangePassword)

  const newPasswordError =
    newPassword.length > 0 && newPassword.length < MIN_PASSWORD_LENGTH
      ? `密码至少 ${MIN_PASSWORD_LENGTH} 位`
      : ''
  const confirmError =
    confirmPassword.length > 0 && newPassword !== confirmPassword
      ? '两次输入的密码不一致'
      : ''

  const canSubmit =
    oldPassword.length > 0 &&
    newPassword.length >= MIN_PASSWORD_LENGTH &&
    confirmPassword.length > 0 &&
    newPassword === confirmPassword &&
    !loading

  async function handleSubmit() {
    if (!canSubmit) return
    setLoading(true)
    try {
      await post<ChangePasswordResponse>(
        '/auth/change-password',
        { oldPassword, newPassword, confirmPassword },
        { silent: true }
      )
      setMustChangePassword(false)
      Taro.showToast({ title: '密码修改成功', icon: 'success', duration: 1500 })
      // Give the toast a beat before navigating so it's visible.
      setTimeout(() => {
        Taro.switchTab({ url: '/pages/discovery/index' })
      }, 800)
    } catch (err) {
      // Surface the backend's message (e.g. "旧密码错误") — request.ts already
      // toasted it when not silent, but we set silent above so we control it here.
      const message =
        err instanceof Error ? err.message : '密码修改失败，请重试'
      Taro.showToast({ title: message, icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  function renderInput(
    value: string,
    setter: (v: string) => void,
    placeholder: string,
    fieldKey: string,
    error?: string
  ) {
    return (
      <View className="mb-5">
        <Input
          type="text"
          password
          value={value}
          placeholder={placeholder}
          placeholderClass="text-outline-variant"
          onInput={(e) => setter(e.detail.value)}
          onFocus={() => setFocused(fieldKey)}
          onBlur={() => setFocused(null)}
          className="w-full rounded-lg px-4 py-3.5 text-on-surface"
          style={{
            fontSize: '16px',
            lineHeight: '24px',
            backgroundColor: '#efeded',
            border: focused === fieldKey ? '2px solid #4d6265' : '2px solid transparent',
            transition: 'border-color 0.2s'
          }}
        />
        {error ? (
          <Text className="mt-1.5 block text-error" style={{ fontSize: '12px' }}>
            {error}
          </Text>
        ) : null}
      </View>
    )
  }

  return (
    <View className="relative min-h-screen bg-surface px-5 py-8">
      <View className="mx-auto w-full max-w-md">
        {/* Header */}
        <View className="mb-8">
          <Text className="block text-on-surface" style={{ fontSize: '24px', fontWeight: '600', lineHeight: '32px' }}>
            修改密码
          </Text>
          <Text className="mt-1 block text-on-surface-variant" style={{ fontSize: '14px', lineHeight: '20px' }}>
            为了账户安全，请设置新密码
          </Text>
        </View>

        {/* Form card */}
        <View
          className="w-full rounded-xl p-6"
          style={{ background: '#ffffff', border: '1px solid rgba(114, 120, 121, 0.1)' }}
        >
          {renderInput(
            oldPassword,
            setOldPassword,
            '旧密码',
            'old'
          )}
          {renderInput(
            newPassword,
            setNewPassword,
            `新密码（至少 ${MIN_PASSWORD_LENGTH} 位）`,
            'new',
            newPasswordError
          )}
          {renderInput(
            confirmPassword,
            setConfirmPassword,
            '确认新密码',
            'confirm',
            confirmError
          )}

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
              lineHeight: '52px',
              marginTop: '8px'
            }}
            hoverClass="none"
          >
            {loading ? '提交中...' : '确认修改'}
          </Button>
        </View>
      </View>
    </View>
  )
}
