/**
 * Admin site-wide popup API client.
 *
 * 始终只有一条弹窗记录（id=1）。管理端用 upsert 模式更新：
 * - GET /admin/popup  — 读取当前唯一一条；不存在返回 null
 * - PUT /admin/popup  — 整体替换（不存在则创建）
 */
import type { SitePopup, PopupUpdatePayload } from '@qingmalaya/shared';
import { get, put } from '@/utils/request';

export function getPopup(): Promise<SitePopup | null> {
  return get<SitePopup | null>('/admin/popup');
}

export function updatePopup(
  payload: PopupUpdatePayload,
): Promise<SitePopup> {
  return put<SitePopup>('/admin/popup', payload);
}
