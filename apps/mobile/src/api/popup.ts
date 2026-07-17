import { get } from '../utils/request'
import type { ActivePopupResponse } from '@qingmalaya/shared'

/**
 * 拉取当前全站弹窗（公开接口，GET /popup/active）。
 *
 * 返回 `{ popup: SitePopup | null }`：
 * - `null` ——管理员还没建，或者建了但 enabled=false
 * - 有值 ——前台需要弹出
 *
 * 用 `silent: true` 避免任何弹窗加载错误打断首屏（弹窗是辅助功能，
 * 拉不到就当没有）。
 */
export function getActivePopup(): Promise<ActivePopupResponse> {
  return get<ActivePopupResponse>('/popup/active', { skipAuth: true, silent: true })
}
