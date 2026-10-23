import { useMemo, useRef, useState } from "react";
import { FlatList, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { router } from "expo-router";
import * as Crypto from "expo-crypto";
import { CheckCircle2, Circle, Cpu, Pencil, SlidersHorizontal, Trash2 } from "lucide-react-native";
import { Button, money, useUi } from "@/components/business/Screen";
import InventorySheet from "@/components/business/InventorySheet";
import SelectField from "@/components/ui/SelectField";
import { POSFrame, ProductPhoto, SummaryRow } from "@/components/pos/Shared";
import { SearchBox } from "@/components/purchase/Shared";
import { useBusiness } from "@/src/store/BusinessProvider";
import type { BusinessData } from "@/src/store/business";
import { lineAmount, unitLabel } from "@/src/store/productUnits";
import { useTheme } from "@/src/theme/ThemeProvider";
import { formatNumber, localeFor } from "@/src/dashboard/format";
import { useDeviceTime } from "@/src/dashboard/useDeviceTime";
import { suggestRestock, type RestockSuggestion } from "@/src/restock/engine";
import { beginRestockPurchase, planTotal, restockData, saveRestockRule, saveRestockSettings, setRestockPlanItem, type RestockPlanItem } from "@/src/restock/settings";
import { PlanningForm, QuantityForm, RestockIssue, RuleForm } from "./Forms";

type Tab = "suggestions" | "insights" | "list";
type ListRow = { id: string; row?: RestockSuggestion; item?: RestockPlanItem };
export default function Restock() {
  const { data, update } = useBusiness(); const { colors } = useTheme(); const { t, i18n } = useTranslation(); const ui = useUi(); const insets = useSafeAreaInsets();
  const clock = useDeviceTime(), [manualTime, setManualTime] = useState<Date>(); const now = manualTime && manualTime > clock ? manualTime : clock;
  const [tab, setTab] = useState<Tab>("suggestions"), [filter, setFilter] = useState("all"), [search, setSearch] = useState("");
  const [planning, setPlanning] = useState(false), [source, setSource] = useState(false), [detail, setDetail] = useState<string>(), [rule, setRule] = useState<string>(), [quantity, setQuantity] = useState<string>();
  const [purchase, setPurchase] = useState<{ expected: string; supplier: string; selected: string[] }>();
  const [busy, setBusy] = useState(false), [issue, setIssue] = useState(""), [saved, setSaved] = useState(false); const lock = useRef(false);
  const state = restockData(data), settings = state.settings;
  const rows = useMemo(() => suggestRestock(data, now), [data, now]);
  const byId = useMemo(() => new Map(rows.map(r => [r.product.id, r])), [rows]);
  const n = (value: number) => formatNumber(Math.round(value * 1000) / 1000, i18n.language);
  const u = (r: RestockSuggestion) => unitLabel(r.unit, i18n.language);
  const run = async (change: (current: BusinessData) => BusinessData) => {
    if (lock.current) return false; lock.current = true; setBusy(true); setIssue(""); setSaved(false);
    try { await update(change); setSaved(true); return true; }
    catch (cause) { setIssue(cause instanceof Error ? cause.message : "saveFailed"); return false; }
    finally { lock.current = false; setBusy(false); }
  };
  const open = (setter: (value: string) => void, id: string) => { setIssue(""); setter(id); };
  const planAmount = planTotal(data), recommended = rows.filter(r => r.quantity !== null && r.quantity > 0);
  const estimated = recommended.reduce<number | null>((sum, r) => sum === null || r.estimatedCost === null || !Number.isSafeInteger(sum + r.estimatedCost) ? null : sum + r.estimatedCost, 0);
  const unknownCost = (tab === "list" ? state.plan.map(l => byId.get(l.productId)) : recommended).some(r => r?.product.cost === 0);
  const entries: ListRow[] = tab === "list" ? state.plan.map(item => ({ id: item.productId, item, row: byId.get(item.productId) })) : rows.filter(r => {
    const query = search.trim().normalize("NFKC").toLocaleLowerCase();
    return `${r.product.name} ${r.product.barcode}`.normalize("NFKC").toLocaleLowerCase().includes(query) && (tab === "insights" ? r.trend !== null || r.warnings.length > 0 || r.quantity === null || r.status === "slow" : filter === "all" || filter === "urgent" && ["out", "low"].includes(r.status) || filter === "limited" && r.confidence === "low");
  }).map(row => ({ id: row.product.id, row }));
  const currentDetail = detail ? byId.get(detail) : undefined, currentRule = rule ? byId.get(rule) : undefined, currentQuantity = quantity ? byId.get(quantity) : undefined;
  const setAmount = (r: RestockSuggestion, amount: number) => run(current => setRestockPlanItem(current, r.product.id, amount, r.unit));
  const start = () => { setIssue(""); setPurchase({ expected: JSON.stringify(state.plan), supplier: "", selected: state.plan.filter(l => byId.get(l.productId)?.unit === l.unit).map(l => l.productId) }); };
  const createDraft = async () => {
    if (!purchase?.supplier) { setIssue("supplierRequired"); return; }
    const id = Crypto.randomUUID();
    if (await run(current => beginRestockPurchase(current, purchase.supplier, id, purchase.expected, purchase.selected))) { setPurchase(undefined); router.push("/business/purchases/items"); }
  };
  const trendTitle = (r: RestockSuggestion) => t(r.trend === null ? "restock.trendNone" : r.trend > 0.1 ? "restock.trendUp" : r.trend < -0.1 ? "restock.trendDown" : "restock.trendStable");
  const photoTitle = (r: RestockSuggestion) => <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><ProductPhoto uri={r.product.photoUri} name={r.product.name} size={48} /><View style={{ flex: 1, gap: 3 }}><Text style={ui.subtitle}>{r.product.name}</Text><Text style={ui.text}>{t("restock.stock")}: {n(r.stock)} {u(r)}</Text></View></View>;
  const line = (entry: ListRow) => {
    const r = entry.row, l = entry.item;
    if (tab === "list" && l) {
      const stale = !r || r.unit !== l.unit;
      const cost = r ? lineAmount(r.product.cost, l.quantity) : null;
      return <View style={{ ...ui.card, padding: 12 }}><View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><View style={{ flex: 1 }}>{r ? photoTitle(r) : <Text style={ui.subtitle}>{data.products.find(p => p.id === l.productId)?.name ?? l.productId}</Text>}</View><Pressable accessibilityRole="button" accessibilityLabel={t("restock.remove")} disabled={busy} onPress={() => { void run(current => setRestockPlanItem(current, l.productId, 0, l.unit)); }} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Trash2 size={19} color={colors.danger} /></Pressable></View>
        {stale ? <Text style={ui.error}>{t("restock.staleItem")}</Text> : <><Text style={ui.subtitle}>{n(l.quantity)} {u(r!)} · {cost === null ? "—" : money(cost)}</Text><Text style={ui.text}>{money(r!.product.cost)} / {u(r!)}</Text><Button secondary title={t("restock.editAmount")} disabled={busy} onPress={() => open(setQuantity, r!.product.id)} />{r?.rule?.supplierId && <Text style={ui.text}>{t("restock.preferredSupplier")}: {data.suppliers?.find(s => s.id === r.rule?.supplierId)?.name}</Text>}</>}
      </View>;
    }
    if (!r) return null;
    const planned = state.plan.some(l => l.productId === r.product.id);
    const badgeColor = r.status === "out" ? colors.danger : ["low", "buy"].includes(r.status) ? colors.warning : r.status === "enough" ? colors.success : colors.muted;
    return <View style={{ ...ui.card, padding: 12, gap: 8 }}>
      {photoTitle(r)}<View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 5 }}><Text style={{ color: badgeColor, fontSize: 12, fontWeight: "600" }}>{t(`restock.status.${r.status}`)}</Text><Text style={{ color: colors.muted, fontSize: 11 }}>{t(`restock.confidence.${r.confidence}`)}</Text></View>
      {tab === "insights" ? <><Text style={ui.subtitle}>{trendTitle(r)}</Text>{r.trend !== null && <Text style={ui.text}>{t("restock.trendChange", { percent: n(r.trend * 100) })}</Text>}{r.warnings.slice(0, 1).map(w => <Text key={w} style={ui.text}>{t(`restock.warning.${w}`)}</Text>)}</> : <>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: 1, borderColor: colors.border, paddingTop: 8 }}><View style={{ flex: 1 }}><Text style={{ color: colors.muted, fontSize: 12 }}>{t(r.quantity === null ? "restock.unavailable" : "restock.buy")}</Text><Text style={{ color: colors.text, fontSize: 22, fontWeight: "700" }}>{r.quantity === null ? "—" : n(r.quantity)} <Text style={{ fontSize: 12 }}>{u(r)}</Text></Text></View><Pressable accessibilityRole="button" accessibilityLabel={`${t(planned ? "restock.editAmount" : "restock.add")}: ${r.product.name}`} disabled={busy} onPress={() => { if (planned || r.quantity === null || r.quantity === 0) open(setQuantity, r.product.id); else void setAmount(r, r.quantity); }} style={{ borderRadius: 9, padding: 11, minHeight: 44, justifyContent: "center", backgroundColor: planned ? colors.elevated : colors.primary }}><Text style={{ color: planned ? colors.text : colors.onPrimary, fontWeight: "600", fontSize: 12 }}>{t(planned ? "restock.editAmount" : r.quantity ? "restock.add" : "restock.manual")}</Text></Pressable></View>
        <Text style={{ color: colors.muted, fontSize: 12 }}>{t("restock.perDay")}: {n(r.rate)} {u(r)}{r.daysLeft !== null ? ` · ${t("restock.left", { days: n(r.daysLeft) })}` : ""}</Text>
        {r.incoming > 0 && <Text style={ui.text}>{t("restock.incoming")}: {n(r.incoming)} {u(r)}</Text>}
        {r.warnings.includes("budgetCap") && <Text style={{ color: colors.warning, fontSize: 12 }}>{t("restock.warning.budgetCap")}</Text>}
      </>}
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 6 }}><Pressable accessibilityRole="button" onPress={() => open(setDetail, r.product.id)} style={{ minHeight: 40, justifyContent: "center", flex: 1 }}><Text style={{ color: colors.primary, fontSize: 12 }}>{t("restock.why")}</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={t("restock.edit")} disabled={busy} onPress={() => open(setRule, r.product.id)} style={{ minHeight: 40, paddingHorizontal: 8, flexDirection: "row", gap: 5, alignItems: "center" }}><Pencil size={14} color={colors.primary} /><Text style={{ color: colors.primary, fontSize: 12 }}>{t("restock.edit")}</Text></Pressable></View>
    </View>;
  };
  return <POSFrame title={t("restock.title")} subtitle={t("restock.hint")} scroll={false} right={<Pressable accessibilityRole="button" accessibilityLabel={t("restock.settings")} disabled={busy} onPress={() => { setIssue(""); setPlanning(true); }} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><SlidersHorizontal size={21} color={colors.primary} /></Pressable>}>
    <View accessibilityRole="tablist" style={{ flexDirection: "row", paddingHorizontal: 16, gap: 4, paddingVertical: 6 }}>{(["suggestions", "insights", "list"] as Tab[]).map(value => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: tab === value }} onPress={() => setTab(value)} style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: tab === value ? colors.primary : colors.elevated }}><Text style={{ color: tab === value ? colors.onPrimary : colors.text, textAlign: "center", fontSize: 12 }}>{t(`restock.${value}`)}{value === "list" ? ` (${n(state.plan.length)})` : ""}</Text></Pressable>)}</View>
    <FlatList data={entries} keyExtractor={item => item.id} renderItem={({ item }) => line(item)} keyboardShouldPersistTaps="handled" initialNumToRender={8} maxToRenderPerBatch={8} windowSize={5} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 12, width: "100%", maxWidth: 720, alignSelf: "center" }}
      ListHeaderComponent={<View style={{ gap: 12, paddingBottom: 4 }}>
        <Pressable accessibilityRole="button" onPress={() => setSource(true)} style={{ ...ui.card, padding: 12, flexDirection: "row", alignItems: "center", gap: 8 }}><Cpu color={colors.primary} size={18} /><Text style={{ color: colors.text, flex: 1 }}>{t("restock.device")}</Text><Text style={{ color: colors.success, fontSize: 12 }}>{t("restock.offlineLabel")}</Text></Pressable>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}><Text style={{ color: colors.muted, fontSize: 11, flex: 1 }}>{t("restock.lastDays", { days: n(settings.historyDays) })}</Text><Pressable accessibilityRole="button" accessibilityLabel={t("restock.refresh")} onPress={() => setManualTime(new Date())} style={{ minHeight: 40, justifyContent: "center" }}><Text style={{ color: colors.primary, fontSize: 12 }}>{t("restock.refresh")}</Text></Pressable></View>
        {tab === "suggestions" && <View style={{ flexDirection: "row", gap: 10 }}>{[{ title: t("restock.need"), value: n(recommended.length) }, { title: t("restock.estimate"), value: estimated === null ? "—" : money(estimated) }].map(item => <View key={item.title} style={{ ...ui.card, padding: 12, flex: 1 }}><Text style={{ color: colors.muted, fontSize: 11 }}>{item.title}</Text><Text style={{ color: colors.text, fontSize: 20, fontWeight: "700" }}>{item.value}</Text></View>)}</View>}
        {tab !== "list" && <SearchBox label={t("restock.search")} value={search} onChangeText={setSearch} />}
        {tab === "suggestions" && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{["all", "urgent", "limited"].map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: filter === value }} onPress={() => setFilter(value)} style={{ minHeight: 40, paddingHorizontal: 14, justifyContent: "center", borderRadius: 8, backgroundColor: filter === value ? colors.primary : colors.elevated }}><Text style={{ color: filter === value ? colors.onPrimary : colors.text }}>{t(`restock.${value}`)}</Text></Pressable>)}</ScrollView>}
        {tab !== "list" && unknownCost && <Text style={ui.error}>{t("restock.uncertainCost")}</Text>}{saved && <Text accessibilityLiveRegion="polite" style={{ color: colors.success }}>{t("restock.saved")}</Text>}<RestockIssue issue={issue} />
      </View>}
      ListEmptyComponent={<Text style={ui.text}>{t(tab === "list" ? "restock.emptyList" : !rows.length ? "restock.noProducts" : tab === "insights" ? "restock.noInsights" : "restock.noMatch")}</Text>}
      ListFooterComponent={<View style={{ gap: 12, paddingTop: 8 }}>{tab === "list" && state.plan.length > 0 ? <>
        <SummaryRow label={t("restock.total")} value={planAmount === null ? "—" : money(planAmount)} strong />
        {settings.budget !== null && <SummaryRow label={t(planAmount !== null && planAmount > settings.budget ? "restock.overBudget" : "restock.budgetRemaining")} value={planAmount === null ? "—" : money(Math.abs(settings.budget - planAmount))} />}
        {unknownCost && <Text style={ui.error}>{t("restock.uncertainCost")}</Text>}<Text style={ui.text}>{t("restock.costsHint")}</Text>
        {data.purchaseDraft ? <><Text style={ui.text}>{t("restock.draftExists")}</Text><Button title={t("restock.continuePurchase")} onPress={() => router.push("/business/purchases/items")} /></> : <Button title={t("restock.startPurchase")} disabled={busy || !state.plan.some(l => byId.get(l.productId)?.unit === l.unit)} onPress={start} />}
      </> : <><Text style={ui.text}>{t("restock.manualReview")}</Text>{tab !== "list" && <Button title={t("restock.viewList")} onPress={() => setTab("list")} />}</>}
        <Text style={{ color: colors.muted, fontSize: 11 }}>{t("restock.calculated", { time: now.toLocaleTimeString(localeFor(i18n.language), { hour: "2-digit", minute: "2-digit" }) })}</Text>
      </View>} />
    {planning && <PlanningForm initial={settings} busy={busy} issue={issue} onClose={() => setPlanning(false)} onSave={next => run(current => saveRestockSettings(current, next))} />}
    {currentRule && <RuleForm row={currentRule} busy={busy} issue={issue} onClose={() => setRule(undefined)} onSave={next => run(current => saveRestockRule(current, next))} />}
    {currentQuantity && <QuantityForm row={currentQuantity} initial={state.plan.find(l => l.productId === currentQuantity.product.id)?.quantity} busy={busy} issue={issue} onClose={() => setQuantity(undefined)} onSave={amount => setAmount(currentQuantity, amount)} />}
    {currentDetail && <InventorySheet title={t("restock.why")} busy={busy} onClose={() => setDetail(undefined)}>{photoTitle(currentDetail)}
      <Text style={ui.subtitle}>{t(`restock.confidence.${currentDetail.confidence}`)}</Text>
      {[ [t("restock.sold"), `${n(currentDetail.sold)} ${u(currentDetail)}`], [t("restock.available"), n(currentDetail.availableDays)], [t("restock.stockouts"), n(currentDetail.stockoutDays)], [t("restock.base"), `${n(currentDetail.baseRate)} ${u(currentDetail)}`], [t("restock.targetQty"), `${n(currentDetail.target)} ${u(currentDetail)}`], [t("restock.safetyQty"), `${n(currentDetail.safety)} ${u(currentDetail)}`], [t("restock.stock"), `− ${n(currentDetail.stock)} ${u(currentDetail)}`], [t("restock.incoming"), `− ${n(currentDetail.incoming)} ${u(currentDetail)}`] ].map(([label, value]) => <SummaryRow key={label} label={label} value={value} />)}
      <SummaryRow label={t("restock.buy")} value={currentDetail.quantity === null ? "—" : `${n(currentDetail.quantity)} ${u(currentDetail)}`} strong /><Text style={ui.text}>{t("restock.formula")}</Text><Text style={ui.text}>{t("restock.excludedToday")}</Text>
      {currentDetail.warnings.map(warning => <Text key={warning} style={{ color: colors.warning, lineHeight: 23 }}>{t(`restock.warning.${warning}`)}</Text>)}
      <Text style={ui.subtitle}>{t("restock.week")}</Text>{currentDetail.daily.slice(-7).map(day => <View key={day.day} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}><Text style={ui.text}>{day.day}</Text><Text style={ui.text}>{day.available ? `${n(day.sold)} ${u(currentDetail)}` : t("restock.status.out")}</Text></View>)}
      <Button secondary title={t("restock.editRule")} onPress={() => { setDetail(undefined); open(setRule, currentDetail.product.id); }} /><Button title={t("restock.editAmount")} onPress={() => { setDetail(undefined); open(setQuantity, currentDetail.product.id); }} />
    </InventorySheet>}
    {source && <InventorySheet title={t("restock.source")} onClose={() => setSource(false)}><Text style={ui.subtitle}>{t("restock.device")} · {t("restock.offlineLabel")}</Text><Text style={ui.text}>{t("restock.offline")}</Text><View style={ui.card}><Text style={ui.subtitle}>{t("restock.ai")} · {t("restock.later")}</Text><Text style={ui.text}>{t("restock.aiHint")}</Text><Text style={ui.text}>{t("restock.privacy")}</Text></View><Button title={t("restock.device")} onPress={() => setSource(false)} /></InventorySheet>}
    {purchase && <InventorySheet title={t("restock.supplier")} busy={busy} onClose={() => setPurchase(undefined)}>
      <SelectField label={t("restock.supplier")} disabled={busy} value={purchase.supplier} onChange={supplier => setPurchase({ ...purchase, supplier })} options={[{ id: "", label: t("restock.none") }, ...(data.suppliers ?? []).map(s => ({ id: s.id, label: s.name }))]} />
      <Button secondary title={t("restock.manageSuppliers")} disabled={busy} onPress={() => { setPurchase(undefined); router.push("/business/suppliers"); }} />
      <Text style={ui.subtitle}>{t("restock.selectedItems")}</Text>{state.plan.map(item => { const r = byId.get(item.productId), stale = !r || r.unit !== item.unit, checked = purchase.selected.includes(item.productId); return <Pressable key={item.productId} accessibilityRole="checkbox" accessibilityState={{ checked, disabled: busy || stale }} disabled={busy || stale} onPress={() => setPurchase({ ...purchase, selected: checked ? purchase.selected.filter(id => id !== item.productId) : [...purchase.selected, item.productId] })} style={{ flexDirection: "row", gap: 10, alignItems: "center", minHeight: 48 }}>{checked ? <CheckCircle2 color={colors.primary} size={22} /> : <Circle color={colors.muted} size={22} />}<Text style={{ ...ui.text, flex: 1 }}>{r?.product.name ?? item.productId} · {n(item.quantity)} {unitLabel(item.unit, i18n.language)}{stale ? ` · ${t("restock.staleItem")}` : ""}</Text></Pressable>; })}
      <Text style={ui.text}>{t("restock.planMoved")}</Text><RestockIssue issue={issue} /><Button title={t("restock.startPurchase")} disabled={busy || !purchase.supplier || !purchase.selected.length} onPress={() => { void createDraft(); }} />
    </InventorySheet>}
  </POSFrame>;
}
