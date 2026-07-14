import Taro from '@tarojs/taro'
import { get } from '../utils/request'
import { APP_VERSION, APP_VERSION_CODE } from '../config/env'
import type { LatestReleaseResponse, AppRelease } from '@qingmalaya/shared'

/**
 * App version check + update prompt utilities.
 *
 * H5 flow:
 *   On app open, fetch /releases/latest. If the latest versionCode differs
 *   from the last-seen versionCode stored locally, show an "已更新到 X.X.X"
 *   popup with the update content. Then save the latest versionCode.
 *
 * Android (RN) flow:
 *   On login, fetch /releases/latest.
 *   - If latest.versionCode > APP_VERSION_CODE → show "发现新版本" popup
 *     with a download button (downloads the APK via Taro.downloadFile).
 *   - If latest.versionCode <= APP_VERSION_CODE and the last-seen
 *     versionCode differs from APP_VERSION_CODE → show "已更新到 X.X.X"
 *     popup (the app was just updated).
 *   Then save APP_VERSION_CODE as the last-seen versionCode.
 */

const LAST_SEEN_VERSION_CODE_KEY = 'lastSeenVersionCode'
const VERSION_CHECK_GUARD_KEY = 'versionCheckDone'

/** Fetch the latest release from the server (public endpoint, no auth needed). */
export async function fetchLatestRelease(): Promise<AppRelease | null> {
  try {
    const res = await get<LatestReleaseResponse>('/releases/latest', {
      skipAuth: true,
      silent: true,
    })
    return res.latest
  } catch {
    return null
  }
}

/** Show the "已更新到 X.X.X" informational popup. */
function showUpdatedPopup(release: AppRelease): void {
  Taro.showModal({
    title: `万卷回响已更新到 v${release.version}`,
    content: release.updateContent,
    showCancel: false,
    confirmText: '知道了',
  })
}

/**
 * Download APK on Android (RN only).
 * Uses Taro.downloadFile + Taro.openDocument to trigger the system installer.
 */
async function downloadAndInstallApk(url: string): Promise<void> {
  Taro.showLoading({ title: '下载安装包中...', mask: true })
  try {
    const res = await Taro.downloadFile({ url })
    Taro.hideLoading()
    if (res.statusCode === 200) {
      // On RN (Android), openDocument opens the APK with the system installer.
      // fileType is omitted because 'apk' is not in Taro's FileType union but
      // the native Android handler resolves it from the file extension.
      await Taro.openDocument({
        filePath: res.tempFilePath,
        showMenu: true,
      })
    } else {
      Taro.showToast({ title: '下载失败，请稍后重试', icon: 'none' })
    }
  } catch {
    Taro.hideLoading()
    // Fallback: open the download URL in the system browser so the user can
    // download and install manually.
    Taro.showToast({ title: '请在浏览器中下载安装', icon: 'none' })
    setTimeout(() => {
      Taro.setClipboardData({ data: url })
    }, 1500)
  }
}

/** Show the "发现新版本" update popup with download button (Android only). */
function showUpdateAvailablePopup(release: AppRelease): void {
  if (!release.downloadUrl) {
    showUpdatedPopup(release)
    return
  }
  Taro.showModal({
    title: `发现新版本 v${release.version}`,
    content: release.updateContent,
    confirmText: '立即更新',
    cancelText: '稍后再说',
    success: (res) => {
      if (res.confirm) {
        void downloadAndInstallApk(release.downloadUrl!)
      }
    },
  })
}

/**
 * Check for updates on H5 (web).
 *
 * Called on app open. If the latest version differs from the last-seen
 * version, shows an informational popup about the update.
 */
export async function checkUpdateOnWebOpen(): Promise<void> {
  // Guard against running multiple times in a single session.
  if (sessionStorage.getItem(VERSION_CHECK_GUARD_KEY)) return
  sessionStorage.setItem(VERSION_CHECK_GUARD_KEY, '1')

  const latest = await fetchLatestRelease()
  if (!latest) return

  let lastSeen = 0
  try {
    lastSeen = Number(Taro.getStorageSync(LAST_SEEN_VERSION_CODE_KEY)) || 0
  } catch {
    // ignore
  }

  if (latest.versionCode !== lastSeen) {
    showUpdatedPopup(latest)
  }

  try {
    Taro.setStorageSync(LAST_SEEN_VERSION_CODE_KEY, latest.versionCode)
  } catch {
    // ignore
  }
}

/**
 * Check for updates on Android (RN) after login.
 *
 * - If server has a newer version → show update popup with download button.
 * - If app was just updated (current version != last seen) → show "已更新" popup.
 */
export async function checkUpdateOnLogin(): Promise<void> {
  const latest = await fetchLatestRelease()
  if (!latest) return

  let lastSeen = 0
  try {
    lastSeen = Number(Taro.getStorageSync(LAST_SEEN_VERSION_CODE_KEY)) || 0
  } catch {
    // ignore
  }

  if (latest.versionCode > APP_VERSION_CODE) {
    // Server has a newer version — prompt to download.
    showUpdateAvailablePopup(latest)
  } else if (lastSeen !== 0 && lastSeen !== APP_VERSION_CODE) {
    // App was just updated (versionCode changed since last login).
    showUpdatedPopup(latest)
  }

  try {
    Taro.setStorageSync(LAST_SEEN_VERSION_CODE_KEY, APP_VERSION_CODE)
  } catch {
    // ignore
  }
}

/**
 * Manual "检查更新" — triggered from the profile page.
 *
 * On Android: if a newer version exists, show the update popup.
 * On H5: always says "已是最新版本" (web auto-updates).
 */
export async function manualCheckUpdate(): Promise<void> {
  const isRn = process.env.TARO_ENV === 'rn'

  Taro.showLoading({ title: '检查更新中...', mask: true })
  const latest = await fetchLatestRelease()
  Taro.hideLoading()

  if (!latest) {
    Taro.showToast({ title: '检查更新失败，请稍后重试', icon: 'none' })
    return
  }

  if (isRn && latest.versionCode > APP_VERSION_CODE) {
    showUpdateAvailablePopup(latest)
  } else {
    Taro.showToast({
      title: `已是最新版本 v${APP_VERSION}`,
      icon: 'none',
    })
  }
}
