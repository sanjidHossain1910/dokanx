import { useTheme } from "@/src/theme/ThemeProvider";
import { ChevronRight, type LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

export default function MenuRow({ title, subtitle, Icon, color, onPress, right, disabled = false }: { title: string; subtitle?: string; Icon: LucideIcon; color?: string; onPress: () => void; right?: ReactNode; disabled?: boolean }) {
  const { colors } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => ({ padding: 14, minHeight: 72, borderRadius: 14, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: pressed ? colors.elevated : colors.card, borderWidth: 1, borderColor: colors.border, opacity: disabled ? 0.5 : 1 })}>
    <View style={{ backgroundColor: color ?? colors.primary, width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 10 }}><Icon size={21} color="#FFFFFF" /></View>
    <View style={{ flex: 1, gap: 3 }}><Text style={{ color: colors.text, fontSize: 15, fontWeight: "600", lineHeight: 22 }}>{title}</Text>{!!subtitle && <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 19 }}>{subtitle}</Text>}</View>
    {right}<ChevronRight size={18} color={colors.muted} />
  </Pressable>;
}
