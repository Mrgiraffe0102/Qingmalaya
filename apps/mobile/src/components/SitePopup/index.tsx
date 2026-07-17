import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import { getActivePopup } from '../../api/popup'
import type { SitePopup } from '@qingmalaya/shared'

/**
 * SitePopup —— 全局强制弹窗。
 *
 * 行为约定：
 * 1. 任何用户打开/刷新网站（包括登录页）时第一时间拉取 GET /popup/active。
 * 2. 后端 enabled=true 且返回了内容 → 弹出。
 * 3. 用户关闭后，本次浏览器会话内不再弹（F5 刷新后才会再弹）。
 * 4. 后端没有内容 / enabled=false / 拉取失败 → 不弹。
 *
 * 实现细节：
 * - 挂载在 `app.tsx` 根层级，所以登录页和登录后所有页面都生效。
 * - z-index: 9999 高于 AppLayout 的所有 chrome（TabBar/PlaybackBar/MessageBell）。
 * - "关闭" 状态用 `sessionStorage` 记录——H5 标签页关闭/小程序进程结束时会自然清除，
 *   重新打开/重新进入就再次弹。`sessionStorage` 不存在的环境（部分 RN）走 fallback：
 *   不记录已关闭，每次都弹（这是"非常强提醒"应有的保守行为）。
 * - 加载失败静默吞掉，不弹 toast——弹窗是辅助功能，不能阻塞首屏。
 */

const DISMISS_KEY = 'sitePopup:dismissed'

/** 跨平台"读 sessionStorage"——不存在或抛错就当作没关闭。 */
function isDismissed(): boolean {
  try {
    if (typeof sessionStorage === 'undefined') return false
    return sessionStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

/** 跨平台"写 sessionStorage"——不存在或抛错就跳过（不阻断关闭）。 */
function markDismissed(): void {
  try {
    if (typeof sessionStorage === 'undefined') return
    sessionStorage.setItem(DISMISS_KEY, '1')
  } catch {
    // ignore
  }
}

export default function SitePopup() {
  // undefined = 加载中（不渲染）；null = 不用弹；SitePopup = 弹
  const [popup, setPopup] = useState<SitePopup | null | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = await getActivePopup()
        if (!cancelled) setPopup(data.popup)
      } catch {
        if (!cancelled) setPopup(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (popup === undefined || popup === null) return null
  if (isDismissed()) return null

  const onClose = () => {
    markDismissed()
    setPopup(null)
  }

  return (
    <View
      className='fixed inset-0 z-[9999] flex items-center justify-center bg-black/50'
      // 兼容 H5：阻止背景点击穿透到下层（详情页/登录页）
      onClick={(e) => e.stopPropagation()}
    >
      <View
        className='mx-5 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl'
        style={{ maxHeight: '80vh', overflowY: 'auto' }}
      >
        <Text
          className='mb-3 block text-on-surface'
          style={{ fontSize: '18px', fontWeight: 700, lineHeight: '26px' }}
        >
          {popup.title}
        </Text>
        <Text
          className='mb-6 block whitespace-pre-line text-on-surface-variant'
          style={{ fontSize: '14px', lineHeight: '22px' }}
        >
          {popup.content}
        </Text>
        <View
          onClick={onClose}
          className='flex items-center justify-center rounded-full bg-primary'
          style={{ height: '44px' }}
          hoverClass='opacity-80'
        >
          <Text
            className='text-on-primary'
            style={{ fontSize: '15px', fontWeight: 600 }}
          >
            我知道了
          </Text>
        </View>
      </View>
    </View>
  )
}
