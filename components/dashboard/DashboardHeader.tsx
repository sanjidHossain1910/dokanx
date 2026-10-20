import { formatNumber } from "@/src/dashboard/format";
import { localGreeting } from "@/src/dashboard/greeting";
import ShopAvatar from "@/components/business/ShopAvatar";
import { useTheme } from "@/src/theme/ThemeProvider";
import { router } from "expo-router";
import { Bell } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

interface DashboardHeaderProps { name: string; ownerName?: string; photoUri?: string; now: Date; unread: number }
export default function DashboardHeader({ name, ownerName, photoUri, now, unread }: DashboardHeaderProps) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const greeting = localGreeting(now);
  return <View className="gap-2">
    <View className="flex-row items-center gap-3">
      <View className="flex-1 gap-1" style={{ minWidth: 0 }}><Text className="text-sm font-medium text-muted" style={{ lineHeight: 23 }}>{t(`dashboard.${greeting}`)}</Text><Text numberOfLines={2} className="text-[25px] font-bold text-ink" style={{ lineHeight: 35 }}>{name}</Text>{!!ownerName?.trim() && <Text numberOfLines={2} className="text-sm text-muted" style={{ lineHeight: 23 }}>{ownerName}</Text>}</View>
      <Pressable accessibilityRole="button" accessibilityLabel={t("dashboard.openNotifications", { quantity: formatNumber(unread, i18n.language) })} onPress={() => router.push("/business/notifications")} className="items-center justify-center rounded-full border border-line bg-surface" style={{ width: 46, height: 46 }}>
        <Bell size={21} color={colors.text} strokeWidth={1.7} />
        {unread > 0 && <View className="absolute -right-1 -top-1 items-center justify-center rounded-full bg-negative" style={{ minWidth: 19, height: 19, paddingHorizontal: 4, borderWidth: 2, borderColor: colors.background }}><Text style={{ color: colors.onPrimary, fontSize: 10, fontWeight: "700" }}>{formatNumber(unread, i18n.language)}</Text></View>}
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t("dashboard.openProfile")} onPress={() => router.push("/(tabs)/profile")} style={{ width: 46, height: 46 }}><ShopAvatar uri={photoUri} name={name} size={46} /></Pressable>
    </View>
    <Text className="text-sm text-muted" style={{ lineHeight: 24 }}>{t("dashboard.overview")}</Text>
  </View>;
}
