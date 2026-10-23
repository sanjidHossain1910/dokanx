import { useRef, useState } from "react";
import { Text } from "react-native";
import { useTranslation } from "react-i18next";
import { router } from "expo-router";
import InventorySheet from "@/components/business/InventorySheet";
import { Button, Field, money, useUi } from "@/components/business/Screen";
import { usePOS } from "@/src/store/usePOS";
import { holdSale } from "@/src/store/heldSales";
import { POSIssue } from "./Shared";
export default function HoldSaleButton({ disabled }: { disabled?: boolean }) {
  const pos = usePOS(); const { t } = useTranslation(); const ui = useUi(); const [open, setOpen] = useState(false); const [label, setLabel] = useState("");
  const lock = useRef(false);
  const customer = pos.data.customers?.find((c) => c.id === pos.draft?.customerId);
  return <><Button secondary title={t("selling.hold")} disabled={disabled || pos.busy || !pos.draft?.lines.length} onPress={() => { pos.setIssue(""); setLabel(""); setOpen(true); }} />
    {open && <InventorySheet title={t("selling.holdTitle")} busy={pos.busy} onClose={() => setOpen(false)}><Field label={t("selling.label")} placeholder={t("selling.labelPlaceholder")} maxLength={80} value={label} onChangeText={setLabel} editable={!pos.busy} /><Text style={ui.text}>{t("pos.customer")}: {customer?.name || t("pos.walkIn")}</Text><Text style={ui.subtitle}>{t("pos.total")}: {money(pos.totals?.total ?? 0)}</Text><Text style={ui.text}>{t("selling.holdHint")}</Text><POSIssue issue={pos.issue} /><Button title={t("selling.saveHold")} disabled={pos.busy || !pos.draft?.lines.length} onPress={() => { const draft = pos.draft; if (!draft || lock.current) return; lock.current = true; const input = { label, createdAt: new Date().toISOString() }; void pos.run((current) => holdSale(current, draft.id, input)).then((ok) => { if (ok) { setOpen(false); router.dismissTo("/(tabs)/sales"); } }).finally(() => { lock.current = false; }); }} /><Button secondary title={t("selling.keepEditing")} disabled={pos.busy} onPress={() => setOpen(false)} /></InventorySheet>}
  </>;
}
