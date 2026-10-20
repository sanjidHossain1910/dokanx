import { useTheme } from "@/src/theme/ThemeProvider";
import { useAmountVisibility } from "@/src/dashboard/useAmountVisibility";
import AmountVisibilityButton from "./AmountVisibilityButton";
import { useTranslation } from "react-i18next";
import type { LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";

interface CardPressProps { label: string; onPress: () => void; children: ReactNode }
export function CardPress({ label, onPress, children }: CardPressProps) {
  const scale = useSharedValue(1);
  const reduced = useReducedMotion();
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
    onPressIn={() => { if (!reduced) scale.set(withTiming(0.975, { duration: 90 })); }}
    onPressOut={() => { scale.set(withTiming(1, { duration: reduced ? 0 : 140 })); }} style={{ flex: 1 }}>
    <Animated.View style={[animatedStyle, { flex: 1 }]}>{children}</Animated.View>
  </Pressable>;
}

export type Tone = "primary" | "orange" | "success" | "danger" | "warning";
export function useTone(tone: Tone) {
  const { colors } = useTheme();
  return { color: colors[tone], soft: colors[`${tone}Soft`] };
}
interface SummaryCardProps { label: string; amount: string; icon: LucideIcon; tone: Tone; detail?: string; onPress?: () => void }
export function SummaryCard({ label, amount, icon: Icon, tone, detail, onPress }: SummaryCardProps) {
  const { visible, toggle } = useAmountVisibility();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const { color, soft } = useTone(tone);
  const { colors } = useTheme();
  const content = <View className="flex-1 rounded-[20px] border border-line bg-surface p-4" style={{ gap: 10, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.025, shadowRadius: 9, elevation: 1 }}>
    <View className="flex-row items-center justify-between" style={{ paddingRight: 38 }}><View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: soft, alignItems: "center", justifyContent: "center" }}><Icon size={20} color={color} strokeWidth={1.8} /></View></View>
    <Text className="text-sm font-medium text-muted" style={{ lineHeight: 22 }}>{label}</Text>
    <Text accessibilityLabel={visible ? undefined : t("dashboard.amountHidden")} className="font-bold text-ink" style={{ fontSize: width < 360 ? 18 : 23, lineHeight: 32, fontVariant: ["tabular-nums"], flexShrink: 1 }}>{visible ? amount : "••••••"}</Text>
    {!!detail && <Text className="text-xs text-muted" style={{ lineHeight: 18 }}>{visible ? detail : "—"}</Text>}
  </View>;
  return <View style={{ flex: 1 }}>{onPress ? <CardPress label={label} onPress={onPress}>{content}</CardPress> : content}<View style={{ position: "absolute", top: 10, right: 8 }}><AmountVisibilityButton visible={visible} toggle={toggle} label={label} /></View></View>;
}
interface QuickActionCardProps { label: string; icon: LucideIcon; tone: Tone; onPress: () => void }
export function QuickActionCard({ label, icon: Icon, tone, onPress }: QuickActionCardProps) {
  const { color, soft } = useTone(tone);
  return <CardPress label={label} onPress={onPress}><View className="flex-1 flex-row items-center gap-3 rounded-2xl border border-line bg-surface p-3" style={{ minHeight: 80 }}>
    <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: soft, alignItems: "center", justifyContent: "center" }}><Icon color={color} size={21} strokeWidth={1.8} /></View>
    <Text className="flex-1 text-sm font-semibold text-ink" style={{ lineHeight: 23 }}>{label}</Text>
  </View></CardPress>;
}
interface InventoryStatusCardProps { label: string; value: string; tone: Tone; icon: LucideIcon; onPress: () => void }
export function InventoryStatusCard({ label, value, tone, icon: Icon, onPress }: InventoryStatusCardProps) {
  const { color, soft } = useTone(tone);
  return <CardPress label={`${label}: ${value}`} onPress={onPress}><View className="flex-1 items-start rounded-2xl border border-line bg-surface p-3" style={{ gap: 8 }}>
    <View style={{ backgroundColor: soft, padding: 8, borderRadius: 10 }}><Icon size={18} color={color} /></View>
    <Text className="text-2xl font-bold text-ink" style={{ fontVariant: ["tabular-nums"] }}>{value}</Text>
    <Text className="text-xs font-medium text-muted" style={{ lineHeight: 19 }}>{label}</Text>
  </View></CardPress>;
}
