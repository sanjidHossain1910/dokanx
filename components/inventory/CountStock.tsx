import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, FlatList, Keyboard, Modal, Pressable, Text, TextInput, View } from "react-native";
import { router, useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import * as Crypto from "expo-crypto";
import { Minus, Plus, ScanBarcode, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBusiness } from "@/src/store/BusinessProvider";
import { useTheme } from "@/src/theme/ThemeProvider";
import { beginCountEntry, completeStockCount, countDifference, stockCountVersion, validCountReason, COUNT_REASONS, type CountEntry, type CountReason } from "@/src/store/stockCounts";
import { allowsFraction, parseQuantityInput, quantityTicks, unitLabel } from "@/src/store/productUnits";
import { formatNumber } from "@/src/dashboard/format";
import { useScanFeedback } from "@/src/scanner/ScanFeedbackProvider";
import { Button, Field, useUi } from "@/components/business/Screen";
import { ProductPhoto } from "@/components/pos/Shared";
import ProductCamera from "@/components/business/ProductCamera";
import SelectField from "@/components/ui/SelectField";
import { CountFrame, CountItemView } from "./StockCountShared";
import { useKeyboardVisible } from "@/hooks/useKeyboardVisible";

type DraftLine = { baseline: CountEntry; text: string; reason: CountReason };
export default function CountStock() {
  const { data, update } = useBusiness(); const { colors, isDark } = useTheme(); const { t, i18n } = useTranslation(); const ui = useUi(); const insets = useSafeAreaInsets(); const navigation = useNavigation(); const feedback = useScanFeedback();
  const [drafts, setDrafts] = useState<Record<string, DraftLine>>({}), [search, setSearch] = useState(""), [note, setNote] = useState("");
  const [review, setReview] = useState(false), [busy, setBusy] = useState(false), [issue, setIssue] = useState(""), [scan, setScan] = useState(false), [saved, setSaved] = useState("");
  const lock = useRef(false), request = useRef<{ id: string; createdAt: string } | undefined>(undefined);
  const keyboardVisible = useKeyboardVisible();
  const entries = Object.values(drafts).map((d) => ({ ...d.baseline, counted: parseQuantityInput(d.text, d.baseline.unit) ?? -1, reason: d.reason }));
  const invalid = entries.some((i) => i.counted < 0), reasonsValid = entries.every(validCountReason);
  const staleIds = entries.filter((i) => stockCountVersion(data, i.productId) !== i.version).map((i) => i.productId);
  const products = useMemo(() => {
    const q = search.trim().normalize("NFKC").toLocaleLowerCase(i18n.language);
    return data.products.filter((p) => !p.deletedAt && `${p.name} ${p.id} ${p.barcode}`.normalize("NFKC").toLocaleLowerCase(i18n.language).includes(q));
  }, [data.products, search, i18n.language]);
  usePreventRemove(busy || (!saved && (entries.length > 0 || !!note)), ({ data: event }) => {
    if (busy) return;
    if (review) { setReview(false); return; }
    Alert.alert(t("stockCount.discardTitle"), t("stockCount.discardHint"), [{ text: t("stockCount.keep"), style: "cancel" }, { text: t("stockCount.discard"), style: "destructive", onPress: () => navigation.dispatch(event.action) }]);
  });
  useEffect(() => { if (saved && !busy) router.replace({ pathname: "/inventory/stock-count", params: { id: saved, success: "1" } }); }, [saved, busy]);
  const onBack = () => { if (busy) return; if (review) setReview(false); else if (router.canGoBack()) router.back(); else router.replace("/inventory/stock-counts"); };
  const changeText = (productId: string, text: string) => {
    setIssue("");
    setDrafts((current) => {
      const next = { ...current };
      if (!text.trim()) delete next[productId];
      else next[productId] = { baseline: current[productId]?.baseline ?? beginCountEntry(data, productId), text, reason: "" };
      return next;
    });
  };
  const save = async () => {
    if (lock.current || !entries.length || invalid || !reasonsValid || staleIds.length) return;
    lock.current = true; setBusy(true); setIssue("");
    request.current ??= { id: Crypto.randomUUID(), createdAt: new Date().toISOString() };
    const input = { ...request.current, items: entries, note: note.trim() };
    try { await update((current) => completeStockCount(current, input)); setSaved(input.id); }
    catch (e) { const key = e instanceof Error ? e.message : ""; setIssue(i18n.exists(`stockCount.${key}`) ? key : "saveFailed"); }
    finally { lock.current = false; setBusy(false); }
  };
  const warning = <>{!!staleIds.length && <><Text accessibilityRole="alert" style={ui.error}>{t("stockCount.countStale")}</Text><Button secondary title={t("stockCount.recount")} disabled={busy} onPress={() => { setDrafts((current) => Object.fromEntries(Object.entries(current).filter(([id]) => !staleIds.includes(id)))); setIssue(""); setReview(false); setSearch(""); }} /></>}{!!issue && <Text accessibilityRole="alert" style={ui.error}>{t(issue === "productNotFound" ? "pos.productNotFound" : `stockCount.${issue}`)}</Text>}</>;
  const summary = t("stockCount.summary", { counted: formatNumber(entries.length, i18n.language), changed: formatNumber(entries.filter((i) => i.counted >= 0 && countDifference(i)).length, i18n.language) });
  return <CountFrame title={t(review ? "stockCount.reviewTitle" : "stockCount.count")} description={review ? summary : t("stockCount.countHint")} onBack={onBack}>
    {review ? <FlatList data={entries} keyExtractor={(i) => i.productId} contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32, gap: 12 }} keyboardShouldPersistTaps="handled" ListHeaderComponent={<View style={{ gap: 10 }}>{warning}</View>}
      renderItem={({ item }) => <View style={ui.card}><CountItemView item={item} />{!!countDifference(item) && <SelectField label={`${t("stockCount.reason")} *`} value={item.reason} disabled={busy} options={[{ id: "", label: t("stockCount.chooseReason") }, ...COUNT_REASONS.filter((r) => validCountReason({ ...item, reason: r })).map((r) => ({ id: r, label: t(`stockCount.${r}`) }))]} onChange={(value) => { setIssue(""); setDrafts((current) => ({ ...current, [item.productId]: { ...current[item.productId], reason: value as CountReason } })); }} />}</View>}
      ListFooterComponent={<View style={{ gap: 12, marginTop: 12 }}><Field label={t("stockCount.note")} value={note} onChangeText={setNote} editable={!busy} multiline maxLength={1000} /><Text style={ui.text}>{t("stockCount.batchHint")}</Text>{!reasonsValid && <Text style={ui.error}>{t("stockCount.invalidStockCount")}</Text>}<Button title={t("stockCount.save")} disabled={busy || !entries.length || invalid || !reasonsValid || !!staleIds.length} onPress={() => { void save(); }} /><Button secondary title={t("stockCount.backEdit")} disabled={busy} onPress={() => setReview(false)} /></View>} /> :
    <FlatList data={products} keyExtractor={(p) => p.id} extraData={drafts} contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32, gap: 10 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
      ListHeaderComponent={<View style={{ gap: 12, marginBottom: 6 }}><View style={{ flexDirection: "row", gap: 8 }}><TextInput accessibilityLabel={t("stockCount.productSearch")} placeholder={t("stockCount.productSearch")} placeholderTextColor={colors.muted} keyboardAppearance={isDark ? "dark" : "light"} style={[ui.input, { flex: 1, minWidth: 0, fontSize: 13 }]} value={search} onChangeText={setSearch} /><Pressable accessibilityRole="button" accessibilityLabel={t("business.scan")} onPress={() => { Keyboard.dismiss(); setScan(true); }} style={{ width: 48, justifyContent: "center", alignItems: "center", borderRadius: 10, backgroundColor: colors.elevated }}><ScanBarcode size={23} color={colors.primary} /></Pressable></View><Text style={ui.text}>{t("stockCount.zeroHint")}</Text>{warning}</View>}
      ListEmptyComponent={<Text style={ui.text}>{t(data.products.some((p) => !p.deletedAt) ? "stockCount.noMatches" : "stockCount.noProducts")}</Text>}
      renderItem={({ item: p }) => {
        const draft = drafts[p.id], before = draft?.baseline.before ?? p.stock, unit = draft?.baseline.unit ?? p.unit;
        const parsed = draft ? parseQuantityInput(draft.text, unit) : null, difference = parsed === null ? null : countDifference({ before, counted: parsed });
        const step = (direction: -1 | 1) => {
          const ticks = quantityTicks(parsed ?? before)!;
          const next = Math.max(0, ticks + direction * 1000);
          if (Number.isSafeInteger(next)) changeText(p.id, String(next / 1000));
        };
        return <View style={{ ...ui.card, padding: 12, gap: 7 }}><View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}><ProductPhoto uri={p.photoUri} name={p.name} size={46} /><Text style={{ ...ui.subtitle, flex: 1 }}>{p.name}</Text>{draft && <Pressable accessibilityRole="button" accessibilityLabel={t("stockCount.remove")} onPress={() => changeText(p.id, "")} style={{ width: 40, height: 40, justifyContent: "center", alignItems: "center" }}><X size={18} color={colors.muted} /></Pressable>}</View><Text style={ui.text}>{t("stockCount.appStock")}: {formatNumber(before, i18n.language)} {unitLabel(unit, i18n.language)}</Text>
          <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>{!allowsFraction(unit) && <Pressable accessibilityRole="button" accessibilityLabel={t("pos.decrease", { name: p.name })} onPress={() => step(-1)} style={{ width: 44, height: 48, borderRadius: 8, justifyContent: "center", alignItems: "center", backgroundColor: colors.elevated }}><Minus size={20} color={colors.primary} /></Pressable>}<TextInput accessibilityLabel={`${p.name}: ${t("stockCount.counted")} (${unitLabel(unit, i18n.language)})`} placeholder={t("stockCount.notCounted")} placeholderTextColor={colors.muted} value={draft?.text ?? ""} onChangeText={(value) => changeText(p.id, value)} keyboardType={allowsFraction(unit) ? "decimal-pad" : "number-pad"} keyboardAppearance={isDark ? "dark" : "light"} style={[ui.input, { flex: 1, minWidth: 0, fontSize: 15, padding: 11 }]} /><Text style={{ color: colors.muted, fontSize: 12 }}>{unitLabel(unit, i18n.language)}</Text>{!allowsFraction(unit) && <Pressable accessibilityRole="button" accessibilityLabel={t("pos.increase", { name: p.name })} onPress={() => step(1)} style={{ width: 44, height: 48, borderRadius: 8, justifyContent: "center", alignItems: "center", backgroundColor: colors.elevated }}><Plus size={20} color={colors.primary} /></Pressable>}</View>
          {draft && parsed === null && <Text style={ui.error}>{t("stockCount.invalidQuantity")}</Text>}{difference !== null && <Text style={{ color: difference < 0 ? colors.danger : difference > 0 ? colors.success : colors.muted, fontSize: 13 }}>{difference ? `${difference > 0 ? "+" : ""}${formatNumber(difference, i18n.language)} ${unitLabel(unit, i18n.language)}` : t("stockCount.unchanged")}</Text>}
        </View>;
      }}
      ListFooterComponent={<Text style={{ ...ui.text, marginTop: 12 }}>{summary}</Text>} />}
    {!review && !keyboardVisible && <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 12, backgroundColor: colors.card, borderTopWidth: 1, borderColor: colors.border }}><Button title={t("stockCount.review", { quantity: formatNumber(entries.length, i18n.language) })} disabled={!entries.length || invalid || !!staleIds.length} onPress={() => { Keyboard.dismiss(); setReview(true); }} /></View>}
    {scan && <Modal visible animationType="slide" onRequestClose={() => setScan(false)}><ProductCamera mode="barcode" onBusyChange={() => {}} onPhoto={() => {}} onClose={() => setScan(false)} onBarcode={(value) => { setScan(false); feedback(Crypto.randomUUID()); const p = data.products.find((p) => !p.deletedAt && (p.barcode === value || p.id === value)); if (p) { setSearch(p.id); setIssue(""); } else setIssue("productNotFound"); }} /></Modal>}
  </CountFrame>;
}
