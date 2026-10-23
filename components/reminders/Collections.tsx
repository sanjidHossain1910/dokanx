import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useBusiness } from "@/src/store/BusinessProvider";
import { selectDuePlans } from "@/src/store/dueReminders";
import { useDeviceTime } from "@/src/dashboard/useDeviceTime";
import { useTheme } from "@/src/theme/ThemeProvider";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Header from "../ui/Header";
import { Button, Field, money, useUi } from "../business/Screen";
import DuePlanEditor from "./DuePlanEditor";
import { ReminderNotice } from "./DuePlanForm";

export default function Collections() {
  const { data } = useBusiness(); const now = useDeviceTime(); const { t } = useTranslation(); const ui = useUi();
  const { colors } = useTheme(); const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState("all"); const [search, setSearch] = useState(""); const [editing, setEditing] = useState<string>();
  const plans = selectDuePlans(data, now);
  const rows = plans.filter((r) => (filter === "all" || filter === r.status) && `${r.customer?.name ?? r.invoice.customerName} ${r.customer?.phone ?? ""} ${r.invoice.invoiceNumber}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  return <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: colors.background }}>
    <Header title={t("due.list")} />
    <FlatList data={rows} keyExtractor={(r) => r.invoiceId} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30, gap: 12 }}
      ListHeaderComponent={<View style={{ gap: 12, marginBottom: 4 }}><ReminderNotice /><Field label={t("flows.search")} value={search} onChangeText={setSearch} /><View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>{["all", "today", "overdue", "upcoming"].map((id) => <Button key={id} secondary={id !== filter} title={t(`due.${id}`)} onPress={() => setFilter(id)} />)}</View></View>}
      ListEmptyComponent={<Text style={ui.text}>{t("due.empty")}</Text>}
      renderItem={({ item: r }) => <View style={ui.card}>
        <Text style={[ui.subtitle, { color: r.status === "overdue" ? colors.danger : colors.primary }]}>{t(`due.${r.status}`)} · {r.dueDate}</Text>
        <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: "/business/customer", params: { id: r.invoice.customerId! } })}><Text style={ui.subtitle}>{r.customer?.name ?? r.invoice.customerName}</Text><Text style={ui.text}>{r.customer?.phone}</Text></Pressable>
        <Text style={ui.text}>{r.invoice.invoiceNumber}</Text><Text style={ui.subtitle}>{t("due.amount")}: {money(r.due)}</Text><Text style={ui.text}>{t(r.remind ? "due.on" : "due.off")}</Text>
        <Button title={t("flows.collect")} onPress={() => router.push({ pathname: "/business/customer", params: { id: r.invoice.customerId!, collect: "1" } })} /><Button secondary title={t("due.change")} onPress={() => setEditing(r.invoiceId)} />
      </View>} />
    {editing && <DuePlanEditor invoiceId={editing} onClose={() => setEditing(undefined)} />}
  </SafeAreaView>;
}
