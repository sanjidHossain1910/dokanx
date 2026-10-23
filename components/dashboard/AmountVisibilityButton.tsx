import { useBusiness } from "@/src/store/BusinessProvider";
import { amountVisibilitySettings } from "@/src/store/businessSettings";
import { useSecurity } from "@/src/security/SecurityProvider";
import { formatNumber } from "@/src/dashboard/format";
import { useTheme } from "@/src/theme/ThemeProvider";
import { Eye, EyeOff, LockKeyhole } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable } from "react-native";

export default function AmountVisibilityButton({ visible, toggle, label }: { visible: boolean; toggle: () => void; label: string }) {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const { data } = useBusiness();
  const { state: security } = useSecurity();
  const { enabled, seconds } = amountVisibilitySettings(data.businessSettings);
  if (!enabled && security.reportsUnlocked) return null;
  const Icon = !enabled ? LockKeyhole : visible ? EyeOff : Eye;
  return <Pressable accessibilityRole="button" accessibilityLabel={enabled ? t(visible ? "dashboard.hideAmount" : "dashboard.showAmount", { label }) : t("security.reportsTitle")} accessibilityHint={enabled ? t("dashboard.autoHideHint", { seconds: formatNumber(seconds, i18n.language) }) : t("security.reportsTitle")} accessibilityState={{ expanded: visible }} onPress={toggle} style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center", backgroundColor: pressed ? colors.elevated : "transparent" })}><Icon size={20} color={colors.muted} /></Pressable>;
}
