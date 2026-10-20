/** Device-local hours, including when the device timezone changes. */
export function localGreeting(now: Date): "morning" | "afternoon" | "evening" | "night" {
  const hour = now.getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}
