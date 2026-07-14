/**
 * RN (Android) system notification implementation using expo-notifications.
 *
 * This file is ONLY resolved by Metro (RN builds). H5/WeApp builds resolve
 * show-notification.h5.ts or show-notification.ts instead, so webpack never
 * sees the expo-notifications import (which pulls in react-native and breaks
 * the H5 bundler).
 */

let expoNotifications: any = null
let initialized = false

async function ensureInit(): Promise<void> {
  if (initialized) return
  initialized = true

  try {
    expoNotifications = require('expo-notifications')

    expoNotifications.setNotificationHandler({
      handleNotification: () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    })

    const { status } = await expoNotifications.requestPermissionsAsync()
    if (status !== 'granted') {
      console.warn('[system-notification] Permission not granted')
    }
  } catch (e) {
    console.warn('[system-notification] expo-notifications not available:', e)
  }
}

export async function showSystemNotification(
  title: string,
  body: string,
): Promise<void> {
  await ensureInit()
  if (expoNotifications) {
    await expoNotifications.scheduleNotificationAsync({
      content: { title, body, sound: 'default' },
      trigger: null,
    })
  }
}
