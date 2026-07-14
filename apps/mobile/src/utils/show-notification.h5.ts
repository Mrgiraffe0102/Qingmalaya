/**
 * H5 (browser) system notification implementation using the Notification API.
 *
 * Resolved by webpack for H5 builds. Does NOT import expo-notifications or
 * react-native, keeping the H5 bundle clean.
 */

export async function showSystemNotification(
  title: string,
  body: string,
): Promise<void> {
  if (typeof Notification === 'undefined') return

  if (Notification.permission === 'default') {
    await Notification.requestPermission()
  }

  if (Notification.permission === 'granted') {
    new Notification(title, { body })
  }
}
