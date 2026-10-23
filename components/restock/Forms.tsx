import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Minus, Plus } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import InventorySheet from "@/components/business/InventorySheet";
import { Button, Field, useUi } from "@/components/business/Screen";
import SelectField from "@/components/ui/SelectField";
import { useBusiness } from "@/src/store/BusinessProvider";
import { useTheme } from "@/src/theme/ThemeProvider";
import { defaultPackSize, restockData, type RestockRule, type RestockSettings } from "@/src/restock/settings";
import type { RestockSuggestion } from "@/src/restock/engine";
import { allowsFraction, normalizeNumericInput, parseMoneyInput, parseQuantityInput, unitLabel } from "@/src/store/productUnits";

export function RestockIssue({ issue }: { issue: string }) {
  const ui = useUi(); const { t, i18n } = useTranslation();
  return issue ? <Text accessibilityRole="alert" style={ui.error}>{t(`restock.error.${i18n.exists(`restock.error.${issue}`) ? issue : "saveFailed"}`)}</Text> : null;
}
const integer = (text: string) => /^\d+$/.test(normalizeNumericInput(text)) ? Number(normalizeNumericInput(text)) : NaN;

export function PlanningForm({ initial, busy, issue, onClose, onSave }: { initial: RestockSettings; busy: boolean; issue: string; onClose: () => void; onSave: (settings: RestockSettings) => Promise<boolean> }) {
  const { t } = useTranslation(); const ui = useUi();
  const [history, setHistory] = useState(String(initial.historyDays)), [target, setTarget] = useState(String(initial.targetDays)), [lead, setLead] = useState(String(initial.leadDays)), [safety, setSafety] = useState(String(initial.safetyDays)), [budget, setBudget] = useState(initial.budget === null ? "" : (initial.budget / 100).toFixed(2)), [error, setError] = useState("");
  const save = async () => {
    const amount = budget.trim() ? parseMoneyInput(budget) : null;
    if (budget.trim() && (!amount || amount <= 0)) { setError("invalidSettings"); return; }
    const settings = { historyDays: Number(history) as RestockSettings["historyDays"], targetDays: integer(target), leadDays: integer(lead), safetyDays: integer(safety), budget: amount };
    if (!Number.isInteger(settings.targetDays) || settings.targetDays < 1 || settings.targetDays > 90 || ![settings.leadDays, settings.safetyDays].every(n => Number.isInteger(n) && n >= 0 && n <= 30)) { setError("invalidSettings"); return; }
    if (await onSave(settings)) onClose();
  };
  return <InventorySheet title={t("restock.settings")} busy={busy} onClose={onClose}>
    <SelectField disabled={busy} label={t("restock.history")} value={history} onChange={setHistory} options={[30, 60, 90].map(n => ({ id: String(n), label: String(n) }))} />
    <Field label={t("restock.target")} value={target} onChangeText={setTarget} keyboardType="number-pad" editable={!busy} />
    <Field label={t("restock.lead")} value={lead} onChangeText={setLead} keyboardType="number-pad" editable={!busy} />
    <Field label={t("restock.safety")} value={safety} onChangeText={setSafety} keyboardType="number-pad" editable={!busy} />
    <Field label={t("restock.budget")} value={budget} onChangeText={setBudget} keyboardType="decimal-pad" placeholder={t("restock.optional")} editable={!busy} />
    <Text style={ui.text}>{t("restock.keepList")}</Text><RestockIssue issue={error || issue} /><Button title={t("restock.apply")} disabled={busy} onPress={() => { void save(); }} />
  </InventorySheet>;
}

export function RuleForm({ row, busy, issue, onClose, onSave }: { row: RestockSuggestion; busy: boolean; issue: string; onClose: () => void; onSave: (rule: RestockRule) => Promise<boolean> }) {
  const { t, i18n } = useTranslation(); const { data } = useBusiness(); const ui = useUi();
  const [pack, setPack] = useState(String(row.rule?.packSize ?? defaultPackSize(row.unit))), [lead, setLead] = useState(row.rule?.leadDays === undefined ? "" : String(row.rule.leadDays)), [shelf, setShelf] = useState(row.rule?.shelfLifeDays === undefined ? "" : String(row.rule.shelfLifeDays)), [max, setMax] = useState(row.rule?.maxOrder === undefined ? "" : String(row.rule.maxOrder)), [supplier, setSupplier] = useState(row.rule?.supplierId ?? ""), [error, setError] = useState("");
  const save = async () => {
    const packSize = parseQuantityInput(pack, row.unit, false), maxOrder = max.trim() ? parseQuantityInput(max, row.unit, false) : undefined;
    const leadDays = lead.trim() ? integer(lead) : undefined, shelfLifeDays = shelf.trim() ? integer(shelf) : undefined;
    if (packSize === null || maxOrder === null || leadDays !== undefined && (!Number.isInteger(leadDays) || leadDays < 0 || leadDays > 30) || shelfLifeDays !== undefined && (!Number.isInteger(shelfLifeDays) || shelfLifeDays < 1 || shelfLifeDays > 3650)) { setError("invalidRule"); return; }
    if (await onSave({ productId: row.product.id, unit: row.unit, packSize, ...(leadDays !== undefined ? { leadDays } : {}), ...(shelfLifeDays !== undefined ? { shelfLifeDays } : {}), ...(maxOrder !== undefined ? { maxOrder } : {}), ...(supplier ? { supplierId: supplier } : {}) })) onClose();
  };
  return <InventorySheet title={t("restock.editRule")} busy={busy} onClose={onClose}>
    <Text style={ui.subtitle}>{row.product.name} · {unitLabel(row.unit, i18n.language)}</Text>
    <Field label={t("restock.pack")} value={pack} onChangeText={setPack} editable={!busy} keyboardType={allowsFraction(row.unit) ? "decimal-pad" : "number-pad"} />
    <Field label={t("restock.productLead")} value={lead} onChangeText={setLead} editable={!busy} keyboardType="number-pad" placeholder={String(restockData(data).settings.leadDays)} />
    <Field label={t("restock.shelf")} value={shelf} onChangeText={setShelf} editable={!busy} keyboardType="number-pad" />
    <Field label={t("restock.maxOrder")} value={max} onChangeText={setMax} editable={!busy} keyboardType={allowsFraction(row.unit) ? "decimal-pad" : "number-pad"} />
    <SelectField disabled={busy} label={t("restock.preferredSupplier")} value={supplier} onChange={setSupplier} options={[{ id: "", label: t("restock.none") }, ...(data.suppliers ?? []).map(s => ({ id: s.id, label: s.name }))]} />
    <Text style={ui.text}>{t("restock.keepList")}</Text><RestockIssue issue={error || issue} /><Button title={t("buttons.save")} disabled={busy} onPress={() => { void save(); }} />
  </InventorySheet>;
}

export function QuantityForm({ row, initial, busy, issue, onClose, onSave }: { row: RestockSuggestion; initial: number | undefined; busy: boolean; issue: string; onClose: () => void; onSave: (quantity: number) => Promise<boolean> }) {
  const { t, i18n } = useTranslation(); const ui = useUi(); const { colors } = useTheme();
  const [text, setText] = useState(initial !== undefined ? String(initial) : row.quantity === null ? "" : String(row.quantity)), [error, setError] = useState("");
  const value = parseQuantityInput(text, row.unit);
  const step = (direction: -1 | 1) => setText(String(Math.max(0, Math.round(((value ?? 0) + direction * row.packSize) * 1000) / 1000)));
  return <InventorySheet title={row.product.name} busy={busy} onClose={onClose}>
    {row.quantity === null && <Text style={ui.text}>{t("restock.noData")}</Text>}
    <Field label={t("restock.quantity", { unit: unitLabel(row.unit, i18n.language) })} value={text} onChangeText={v => { setText(v); setError(""); }} editable={!busy} keyboardType={allowsFraction(row.unit) ? "decimal-pad" : "number-pad"} />
    <View style={{ flexDirection: "row", gap: 10 }}>{([-1, 1] as const).map(direction => <Pressable key={direction} accessibilityRole="button" accessibilityLabel={t(direction === -1 ? "pos.decrease" : "pos.increase", { name: row.product.name })} disabled={busy} onPress={() => step(direction)} style={{ flex: 1, height: 44, borderRadius: 10, backgroundColor: colors.elevated, alignItems: "center", justifyContent: "center" }}>{direction === -1 ? <Minus color={colors.primary} size={20} /> : <Plus color={colors.primary} size={20} />}</Pressable>)}</View>
    <Text style={ui.text}>{t("restock.keepList")}</Text><RestockIssue issue={error || issue} /><Button title={t("buttons.save")} disabled={busy} onPress={() => { if (value === null) { setError("invalidQuantity"); return; } void onSave(value).then(ok => { if (ok) onClose(); }); }} />
  </InventorySheet>;
}
