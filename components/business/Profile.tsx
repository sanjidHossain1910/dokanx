import AmountVisibilityButton from "@/components/dashboard/AmountVisibilityButton";
import MenuRow from "@/components/settings/MenuRow";
import { money, useUi } from "./Screen";
import { selectDashboard } from "@/src/dashboard/selectors";
import { formatNumber } from "@/src/dashboard/format";
import { useAmountVisibility } from "@/src/dashboard/useAmountVisibility";
import { useBusiness } from "@/src/store/BusinessProvider";
import { useTheme } from "@/src/theme/ThemeProvider";
import ShopPhotoPicker from "./ShopPhotoPicker";
import { router } from "expo-router";
import { BadgeHelp, ChevronRight, CreditCard, DatabaseBackup, Printer, Languages, Palette, Settings, UserRound, Wallet, Users } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

export default function Profile() {
  const { data } = useBusiness(); const { colors, mode } = useTheme(); const { t, i18n } = useTranslation(); const ui = useUi(); const insets = useSafeAreaInsets(); const amount = useAmountVisibility();
  const stats = selectDashboard(data); const edit = () => router.push("/business/shop");
  return <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: colors.background }}>
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 22, paddingVertical: 10, width: "100%", maxWidth: 600, alignSelf: "center" }}><Text accessibilityRole="header" style={{ color: colors.primary, fontSize: 24, fontWeight: "800" }}>DokanX</Text><Pressable accessibilityRole="button" accessibilityLabel={t("profileSettings.businessSettings")} onPress={() => router.push("/settings")} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Settings size={24} color={colors.text} /></Pressable></View>
    <View style={{ width: "100%", maxWidth: 600, alignSelf: "center", paddingHorizontal: 20, paddingBottom: 14, gap: 6, flexShrink: 0, borderBottomWidth: 1, borderColor: colors.border }}>
      <ShopPhotoPicker />
      <Pressable accessibilityRole="button" accessibilityLabel={t("profileSettings.editProfile")} onPress={edit} style={{ alignItems: "center", gap: 7, paddingVertical: 6 }}>
        <Text style={[ui.subtitle, { fontSize: 21, textAlign: "center", lineHeight: 29 }]}>{data.shopName}</Text>{!!data.ownerName && <Text style={{ color: colors.muted, fontSize: 13 }}>{data.ownerName}</Text>}{!!data.shopPhone && <Text style={{ color: colors.muted, fontSize: 12 }}>{data.shopPhone}</Text>}<ChevronRight size={18} color={colors.primary} style={{ position: "absolute", right: 0, top: "65%" }} />
      </Pressable>
    </View>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ width: "100%", maxWidth: 600, alignSelf: "center", paddingHorizontal: 20, paddingTop: 16, paddingBottom: insets.bottom + 120, gap: 20 }}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {[{ value: stats.productCount, label: t("business.products"), onPress: () => router.push("/(tabs)/packege") }, { value: data.customers?.length ?? 0, label: t("profileSettings.customers"), onPress: () => router.push("/business/customers") }].map((item) => <Pressable key={item.label} accessibilityRole="button" onPress={item.onPress} style={{ ...ui.card, flex: 1, padding: 10, gap: 6, alignItems: "center", justifyContent: "center" }}><Text style={[ui.subtitle, { fontSize: 18 }]}>{formatNumber(item.value, i18n.language)}</Text><Text style={{ color: colors.muted, fontSize: 10, textAlign: "center" }}>{item.label}</Text></Pressable>)}
        <View style={{ ...ui.card, flex: 1, padding: 8, gap: 2, alignItems: "center" }}><Pressable accessibilityRole="button" accessibilityLabel={t("profileSettings.todaySales")} onPress={() => router.push("/(tabs)/sales/history")} style={{ alignItems: "center", gap: 5 }}><Text style={[ui.subtitle, { fontSize: 14 }]}>{amount.visible ? money(stats.sales) : "••••••"}</Text><Text style={{ color: colors.muted, fontSize: 10, textAlign: "center" }}>{t("profileSettings.todaySales")}</Text></Pressable><AmountVisibilityButton label={t("profileSettings.todaySales")} visible={amount.visible} toggle={amount.toggle} /></View>
      </View>
      <View style={{ gap: 8 }}>
        <MenuRow title={t("flows.backup")} Icon={DatabaseBackup} onPress={() => router.push("/settings/backup")} />
        <MenuRow title={t("flows.printer")} Icon={Printer} onPress={() => router.push("/settings/printer")} />
        <MenuRow title={t("flows.cashDay")} Icon={Wallet} onPress={() => router.push("/business/cash-day")} />
        <MenuRow title={t("flows.suppliers")} Icon={Users} onPress={() => router.push("/business/suppliers")} />
        <MenuRow title={t("profileSettings.editProfile")} subtitle={t("profileSettings.editHint")} Icon={UserRound} color="#0EA5E9" onPress={edit} />
        <MenuRow title={t("setup.paymentMethods")} subtitle={t("profileSettings.paymentHint")} Icon={CreditCard} color="#EC4899" onPress={() => router.push("/settings/payments")} />
        <MenuRow title={t("profileSettings.businessSettings")} subtitle={t("profileSettings.businessHint")} Icon={Settings} onPress={() => router.push("/settings")} />
        <MenuRow title={t("profileSettings.language")} subtitle="English / বাংলা" Icon={Languages} color="#D946EF" right={<Text style={{ color: colors.muted, fontSize: 11 }}>{i18n.language.startsWith("bn") ? "বাংলা" : "English"}</Text>} onPress={() => router.push("/settings/appearance")} />
        <MenuRow title={t("profileSettings.appearance")} subtitle={t(`dashboard.${mode}`)} Icon={Palette} color="#059669" onPress={() => router.push("/settings/appearance")} />
        <MenuRow title={t("profileSettings.helpAbout")} subtitle={t("profileSettings.helpHint")} Icon={BadgeHelp} color="#F59E0B" onPress={() => router.push("/settings/help")} />
      </View>
    </ScrollView>
  </SafeAreaView>;
}

