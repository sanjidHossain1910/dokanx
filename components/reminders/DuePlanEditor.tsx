import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text } from "react-native";
import { useBusiness } from "@/src/store/BusinessProvider";
import { setDuePlan, type DuePlanInput } from "@/src/store/dueReminders";
import { useFinanceAction } from "../business/FinanceShared";
import InventorySheet from "../business/InventorySheet";
import { Button, useUi } from "../business/Screen";
import DuePlanForm from "./DuePlanForm";

export default function DuePlanEditor({ invoiceId, onClose }: { invoiceId: string; onClose: () => void }) {
  const { data } = useBusiness(); const { t } = useTranslation(); const ui = useUi(); const action = useFinanceAction();
  const existing = data.dueReminders?.find((r) => r.invoiceId === invoiceId);
  const [value, setValue] = useState<DuePlanInput | undefined>(existing ? { dueDate: existing.dueDate, remind: existing.remind } : undefined);
  const [expected] = useState(() => JSON.stringify(existing));
  const save = () => void action.run((current) => {
    if (JSON.stringify(current.dueReminders?.find((r) => r.invoiceId === invoiceId)) !== expected) throw new Error("saveFailed");
    return setDuePlan(current, invoiceId, value);
  }).then((ok) => { if (ok) onClose(); });
  return <InventorySheet title={t("due.edit")} busy={action.busy} onClose={onClose}>
    <DuePlanForm value={value} onChange={setValue} disabled={action.busy} />
    {action.issue && <Text style={ui.error}>{t(action.issue === "invalidDuePlan" ? "due.invalid" : "due.saveFailed")}</Text>}
    <Button title={t("due.save")} disabled={action.busy} onPress={save} />
  </InventorySheet>;
}
