import { router } from "expo-router";
import { selectDuePlans } from "@/src/store/dueReminders";
import { Button, Screen, useUi } from "@/components/business/Screen";
import LowStockAlert from "@/components/dashboard/LowStockAlert";
import { selectDashboard } from "@/src/dashboard/selectors";
import { useBusiness } from "@/src/store/BusinessProvider";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text } from "react-native";

export default function Notifications() {
  const ui = useUi();
  const { data, update } = useBusiness();
  const { t } = useTranslation();
  const overview = selectDashboard(data);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const markRead = async () => {
    setBusy(true); setError(false);
    try { await update((current) => ({ ...current, notificationReadSignature: selectDashboard(current).alertSignature })); }
    catch { setError(true); }
    finally { setBusy(false); }
  };
  return <Screen back title={t("dashboard.notifications")}>
    {selectDuePlans(data).length > 0 && <Button secondary title={t("due.open")} onPress={() => router.push("/business/collections")} />}
    <Button title={t("dashboard.markRead")} disabled={busy || !overview.unread} onPress={() => void markRead()} />
    {error && <Text style={ui.error}>{t("business.saveFailed")}</Text>}
    {overview.alerts.length ? overview.alerts.map((product) => <LowStockAlert key={product.id} products={[product]} />) : <Text style={ui.text}>{t("dashboard.noNotifications")}</Text>}
  </Screen>;
}
