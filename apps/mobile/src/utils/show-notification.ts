/**
 * Fallback system notification implementation for platforms that don't support
 * OS-level notifications (e.g. WeApp). All calls are no-ops.
 */
export async function showSystemNotification(
  _title: string,
  _body: string,
): Promise<void> {
  // No-op — system notifications are not supported on this platform.
}
