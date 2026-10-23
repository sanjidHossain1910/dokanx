import { useCallback, type ReactNode } from "react";
import { router, useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSecurity } from "@/src/security/SecurityProvider";
import { Button } from "@/components/business/Screen";
import { SecurityPage } from "./PinScreen";

export default function ReportGate({ children, receiptId }: { children: ReactNode; receiptId?: string }) {
  const { state, requestReports } = useSecurity(); const { t } = useTranslation();
  const allowed = state.reportsUnlocked || !!receiptId && state.receiptIds.includes(receiptId);
  useFocusEffect(useCallback(() => { if (!allowed) void requestReports(); }, [allowed, requestReports]));
  if (allowed) return children;
  return <SecurityPage title={t("security.reportsTitle")} subtitle={t("security.reportsHint")}><Button title={t("security.unlock")} onPress={() => { void requestReports(); }} /><Button secondary title={t("security.back")} onPress={() => { if (router.canGoBack()) router.back(); else router.replace("/(tabs)"); }} /><Button secondary title={t("pos.newSale")} onPress={() => router.dismissTo("/(tabs)/sales")} /></SecurityPage>;
}
