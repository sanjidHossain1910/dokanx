import { useTheme } from "@/src/theme/ThemeProvider";
import { Eye, EyeOff } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable } from "react-native";

export default function AmountVisibilityButton({ visible, toggle, label }: { visible: boolean; toggle: () => void; label: string }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const Icon = visible ? EyeOff : Eye;
  return <Pressable accessibilityRole="button" accessibilityLabel={t(visible ? "dashboard.hideAmount" : "dashboard.showAmount", { label })} accessibilityHint={t("dashboard.autoHideHint")} accessibilityState={{ expanded: visible }} onPress={toggle} style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center", backgroundColor: pressed ? colors.elevated : "transparent" })}><Icon size={20} color={colors.muted} /></Pressable>;
}
