import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import type { BusinessData } from "@/src/store/business";
import { useBusiness } from "@/src/store/BusinessProvider";
import { Button, useUi } from "./Screen";
import type { MoneyMethod } from "@/src/store/finance";
export function useFinanceAction() {
  const { update } = useBusiness(); const lock = useRef(false); const [busy, setBusy] = useState(false); const [issue, setIssue] = useState("");
  const run = async (change: (data: BusinessData) => BusinessData) => {
    if (lock.current) return false;
    lock.current = true; setBusy(true); setIssue("");
    try { await update(change); return true; }
    catch (e) { setIssue(e instanceof Error ? e.message : "saveFailed"); return false; }
    finally { lock.current = false; setBusy(false); }
  };
  return { run, busy, issue, setIssue };
}
export function FinanceIssue({ issue }: { issue: string }) {
  const { t, i18n } = useTranslation(); const ui = useUi();
  return issue ? <Text accessibilityLiveRegion="polite" style={ui.error}>{t(`flows.${i18n.exists(`flows.${issue}`) ? issue : "saveFailed"}`)}</Text> : null;
}
export function MoneyMethods({ value, onChange, disabled }: { value: MoneyMethod; onChange: (v: MoneyMethod) => void; disabled?: boolean }) {
  const { t } = useTranslation();
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{(["cash", "bkash", "nagad"] as const).map((method) => <Button key={method} title={`${method === value ? "✓ " : ""}${t(`flows.${method}`)}`} secondary={method !== value} disabled={disabled} onPress={() => onChange(method)} />)}</View>;
}
