export const lightTheme = {
  background: "#F8FAFC", card: "#FFFFFF", elevated: "#F1F5F9", primary: "#2563EB",
  text: "#0F172A", muted: "#64748B", border: "#E2E8F0", success: "#16A34A",
  warning: "#F59E0B", danger: "#EF4444", orange: "#EA580C", primarySoft: "#EFF6FF",
  successSoft: "#F0FDF4", warningSoft: "#FFFBEB", dangerSoft: "#FEF2F2", orangeSoft: "#FFF7ED",
  onPrimary: "#FFFFFF", shadow: "#0F172A", overlay: "#00000099",
};
export type ThemeTokens = typeof lightTheme;
export const darkTheme: ThemeTokens = {
  background: "#020617", card: "#111827", elevated: "#1E293B", primary: "#3B82F6",
  text: "#F8FAFC", muted: "#94A3B8", border: "#334155", success: "#22C55E",
  warning: "#FBBF24", danger: "#F87171", orange: "#FB923C", primarySoft: "#172554",
  successSoft: "#052E16", warningSoft: "#422006", dangerSoft: "#450A0A", orangeSoft: "#431407",
  onPrimary: "#FFFFFF", shadow: "#000000", overlay: "#00000099",
};
export type ThemeMode = "light" | "dark" | "system";
export const isThemeMode = (value: unknown): value is ThemeMode => value === "light" || value === "dark" || value === "system";

export function resolveThemeMode(mode: ThemeMode, system: "light" | "dark" | "unspecified" | null | undefined, ready = true): "light" | "dark" {
  if (!ready) return "light";
  return mode === "system" ? system === "dark" ? "dark" : "light" : mode;
}

export function getThemeVariables(colors: ThemeTokens) {
  return {
    "--app-background": colors.background, "--app-card": colors.card, "--app-elevated": colors.elevated,
    "--app-primary": colors.primary, "--app-text": colors.text, "--app-muted": colors.muted,
    "--app-border": colors.border, "--app-success": colors.success, "--app-warning": colors.warning,
    "--app-danger": colors.danger, "--app-on-primary": colors.onPrimary,
  };
}
