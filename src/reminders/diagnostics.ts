const reported = new Set<string>();
export function reminderFailureStatus(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("localNotificationsUnavailable") || message.includes("null cannot be cast to non-null type expo.modules.notifications.notifications.channels.NotificationsChannelsProvider") ? "unavailable" as const : "failed" as const;
}
/** Native error details are useful in development; no customer/financial payload is logged. */
export function logReminderFailure(stage: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const key = `${stage}:${message}`;
  if (reported.has(key)) return;
  reported.add(key);
  console.info("[due-reminders] operation failed", { stage, message });
}
