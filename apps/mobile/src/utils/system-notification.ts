import Taro from '@tarojs/taro'
import { get } from '../utils/request'
import type { Paginated, NotificationItem } from '@qingmalaya/shared'
// Platform-specific import — resolves to show-notification.h5.ts (H5),
// show-notification.rn.ts (RN), or show-notification.ts (fallback).
// This prevents webpack from ever seeing the expo-notifications import.
import { showSystemNotification } from './show-notification'

/**
 * System notification polling — checks for new in-app notifications every
 * 2 minutes while the app is in the foreground and fires OS-level
 * notifications via the platform-specific show-notification module.
 *
 * H5: browser Notification API
 * RN (Android): expo-notifications
 * Other: no-op
 */

const POLL_INTERVAL = 120_000 // 2 minutes
const LAST_NOTIFIED_ID_KEY = 'lastNotifiedNotificationId'

/** Whether system notifications are supported on this platform. */
function isSupported(): boolean {
  if (process.env.TARO_ENV === 'h5') {
    return typeof Notification !== 'undefined'
  }
  if (process.env.TARO_ENV === 'rn') {
    return true
  }
  return false
}

// --- Polling logic ---

let pollTimer: ReturnType<typeof setInterval> | null = null
let lastUnreadCount = 0
let isPolling = false
let lifecycleHandlersRegistered = false

/** Check for new notifications and fire system notifications for new items. */
async function checkNewNotifications(): Promise<void> {
  if (isPolling) return
  isPolling = true

  try {
    const { count } = await get<{ count: number }>('/notifications/unread-count', {
      silent: true,
    })

    if (count > lastUnreadCount) {
      // Fetch the latest unread notifications to fire system notifications.
      const res = await get<Paginated<NotificationItem>>(
        '/notifications?page=1&pageSize=10',
        { silent: true },
      )

      let lastNotifiedId = 0
      try {
        lastNotifiedId = Number(Taro.getStorageSync(LAST_NOTIFIED_ID_KEY)) || 0
      } catch {
        // ignore
      }

      // Fire system notifications for items newer than the last notified ID.
      const newItems = res.items.filter((n) => n.id > lastNotifiedId)
      for (const n of newItems) {
        await showSystemNotification(n.title, n.content)
      }

      if (newItems.length > 0) {
        const maxId = Math.max(...newItems.map((n) => n.id))
        try {
          Taro.setStorageSync(LAST_NOTIFIED_ID_KEY, maxId)
        } catch {
          // ignore
        }
      }
    }

    lastUnreadCount = count
  } catch {
    // Silently ignore — polling failures shouldn't disrupt the user.
  } finally {
    isPolling = false
  }
}

/** Register Taro app lifecycle handlers (only once). */
function registerLifecycleHandlers(): void {
  if (lifecycleHandlersRegistered) return
  lifecycleHandlersRegistered = true

  // Pause polling when the app goes to background.
  Taro.onAppHide?.(() => {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  })

  // Resume polling when the app returns to foreground.
  Taro.onAppShow?.(() => {
    if (!pollTimer) {
      // Reset the unread count so we don't fire a burst of notifications
      // for items that arrived while backgrounded — the user will see them
      // when they open the messages page.
      lastUnreadCount = 0
      void checkNewNotifications()
      pollTimer = setInterval(() => {
        void checkNewNotifications()
      }, POLL_INTERVAL)
    }
  })
}

/**
 * Start polling for new notifications.
 *
 * Called from the app entry point or after login. Polls every 2 minutes
 * while the app is in the foreground. Pauses on background and resumes on
 * foreground automatically.
 */
export function startNotificationPolling(): void {
  if (!isSupported()) return
  if (pollTimer) return // already started

  // Initialize the unread count from the server before starting the loop.
  void checkNewNotifications()

  pollTimer = setInterval(() => {
    void checkNewNotifications()
  }, POLL_INTERVAL)

  registerLifecycleHandlers()
}
