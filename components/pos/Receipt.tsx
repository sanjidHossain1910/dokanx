import { formatBusinessDate } from "@/src/store/businessSettings";
import { Button, money, useUi } from "@/components/business/Screen";
import { POSFrame, SummaryRow } from "./Shared";
import { useBusiness } from "@/src/store/BusinessProvider";
import { receiptHTML, salePaper } from "@/src/store/receipt";
import { invoiceDue } from "@/src/store/finance";
import { useReceiptPrinter } from "@/components/payments/PrintableReceipt";
import { unitLabel } from "@/src/store/productUnits";
import { formatNumber } from "@/src/dashboard/format";
import { useTheme } from "@/src/theme/ThemeProvider";
import { shareReceipt } from "@/src/store/receiptOutput";
import { router, useLocalSearchParams } from "expo-router";
import { Check, Printer, Share2, Store } from "lucide-react-native";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeInDown, ReduceMotion } from "react-native-reanimated";

export default function ReceiptScreen() {
  const { saleId, success, legacyId } = useLocalSearchParams<{ saleId?: string; success?: string; legacyId?: string }>();
  const { data } = useBusiness();
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const ui = useUi();
  const [busy, setBusy] = useState(false);
  const [issue, setIssue] = useState("");
  const lock = useRef(false);
  const printer = useReceiptPrinter();
  const invoice = data.invoices?.find((i) => i.id === saleId);
  const legacy = data.sales.find((s) => s.id === legacyId && !s.invoiceId);
  const output = async (share: boolean) => {
    if (!invoice || lock.current) return;
    lock.current = true; setBusy(true); setIssue("");
    try {
      const html = receiptHTML(invoice, i18n.language, (key) => t(key), data.businessSettings);
      if (share) await shareReceipt(html, t("pos.share"));
      else await printer.print(salePaper(invoice, i18n.language, data.businessSettings), html);
    } catch (cause) { if (!(cause instanceof Error && /cancel/i.test(cause.message))) setIssue(cause instanceof Error && ["shareUnavailable", "printUnavailable", "printerPlatform", "printerBuildRequired", "printerPermission", "printerBusy", "printerFailed"].includes(cause.message) ? cause.message : "receiptFailed"); }
    finally { lock.current = false; setBusy(false); }
  };
  return <POSFrame title={t("pos.receipt")} hideHeader={!!success}>
    {printer.node}
    {invoice && <><Button secondary title={t("flows.returnSale")} disabled={busy} onPress={() => router.push({ pathname: "/business/return", params: { saleId: invoice.id } })} /><View style={ui.card}><Text style={ui.subtitle}>{t("flows.balance")}: {money(invoiceDue(data, invoice.id))}</Text>{(data.saleReturns ?? []).filter((r) => r.invoiceId === invoice.id).map((r) => <View key={r.id}><Text style={ui.text}>{t("flows.returned")}: {money(r.total)} · {formatBusinessDate(r.createdAt, i18n.language, data.businessSettings)}</Text><Text style={ui.text}>{t("flows.refund")}: {money(r.refund)} · {t("flows.dueReduction")}: {money(r.dueReduction)}</Text><Text style={ui.text}>{r.note}</Text></View>)}</View></>}
    {invoice ? <>
      {!!success && <Animated.View entering={FadeInDown.duration(240).reduceMotion(ReduceMotion.System)} style={{ alignItems: "center", gap: 12, paddingTop: 48, paddingBottom: 16 }}><View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: colors.successSoft, alignItems: "center", justifyContent: "center" }}><Check size={47} color={colors.success} strokeWidth={3} /></View><Text accessibilityRole="header" style={{ ...ui.subtitle, fontSize: 23, lineHeight: 34 }}>{t("pos.success")}</Text><Text style={{ ...ui.text, textAlign: "center" }}>{t("pos.successHint")}</Text></Animated.View>}
      <View style={{ ...ui.card, padding: 18, gap: 12 }}>
        <View style={{ flexDirection: "row", gap: 12 }}><Store size={30} color={colors.primary} /><View style={{ flex: 1, minWidth: 0 }}><Text style={ui.subtitle}>{invoice.shopName}</Text>{!!invoice.shopPhone && <Text style={ui.text}>{invoice.shopPhone}</Text>}<Text selectable style={{ color: colors.muted, fontSize: 10, lineHeight: 18 }}>{invoice.invoiceNumber}</Text><Text style={{ color: colors.muted, fontSize: 12, lineHeight: 21 }}>{formatBusinessDate(invoice.createdAt, i18n.language, data.businessSettings)}</Text></View></View>
        <Text style={ui.text}>{t("pos.customer")}: {invoice.customerName || t("pos.walkIn")}</Text>
        <View style={{ gap: 14, paddingVertical: 14 }}>{invoice.items.map((l) => <View key={l.id} style={{ flexDirection: "row", gap: 10 }}><View style={{ flex: 1 }}><Text style={{ color: colors.text, fontSize: 14, lineHeight: 23 }}>{l.name}</Text><Text style={{ color: colors.muted, fontSize: 11, lineHeight: 19 }}>{money(l.unitPrice)} × {formatNumber(l.quantity, i18n.language)} {unitLabel(l.unit, i18n.language)}</Text></View><Text style={{ color: colors.text, fontWeight: "600", fontSize: 14 }}>{money(l.grossTotal)}</Text></View>)}</View>
        <View style={{ borderTopWidth: 1, borderColor: colors.border }}><SummaryRow label={t("pos.subtotal")} value={money(invoice.subtotal)} /><SummaryRow label={t("pos.discount")} value={`− ${money(invoice.discount)}`} /><SummaryRow label={t("pos.tax")} value={money(invoice.tax)} /></View>
        <View style={{ borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }}><SummaryRow label={t("pos.total")} value={money(invoice.total)} strong /></View>
        <SummaryRow label={t("pos.method")} value={t(`pos.${invoice.method}`)} /><SummaryRow label={t("pos.paymentStatus")} value={t(`pos.${invoice.status === "paid" ? "paidStatus" : invoice.status === "partial" ? "partialStatus" : "dueStatus"}`)} /><SummaryRow label={t("pos.receivedLabel")} value={money(invoice.amountReceived)} /><SummaryRow label={t("pos.paidLabel")} value={money(invoice.amountPaid)} /><SummaryRow label={t(invoice.amountDue ? "pos.remaining" : "pos.change")} value={money(invoice.amountDue || invoice.change)} />
        {!!invoice.receiptFooter && <Text style={ui.text}>{invoice.receiptFooter}</Text>}{!!invoice.reference && <Text style={ui.text}>{invoice.reference}</Text>}{!!invoice.note && <Text style={ui.text}>{invoice.note}</Text>}
        {["bkash", "nagad", "card"].includes(invoice.method) && <Text style={ui.text}>{t("pos.manualHint")}</Text>}
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>{[{ share: false, Icon: Printer, label: t("pos.print") }, { share: true, Icon: Share2, label: t("pos.share") }].map(({ share, Icon, label }) => <Pressable key={label} accessibilityRole="button" disabled={busy} onPress={() => void output(share)} style={{ flex: 1, minHeight: 52, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, justifyContent: "center", alignItems: "center", flexDirection: "row", gap: 7, padding: 8, opacity: busy ? 0.5 : 1 }}><Icon size={20} color={colors.text} /><Text style={{ flexShrink: 1, color: colors.text, fontWeight: "600", fontSize: 13 }}>{label}</Text></Pressable>)}</View>
      {!!issue && <Text accessibilityRole="alert" style={ui.error}>{t(`${issue.startsWith("printer") ? "flows" : "pos"}.${issue}`)}</Text>}
    </> : legacy ? <View style={ui.card}><Text style={ui.subtitle}>{legacy.name}</Text><Text style={ui.text}>{t("pos.legacyHint")}</Text><Text style={ui.text}>{formatNumber(legacy.quantity, i18n.language)} {unitLabel(legacy.unit, i18n.language)} · {money(legacy.total)}</Text><Text style={ui.text}>{formatBusinessDate(legacy.createdAt, i18n.language, data.businessSettings)}</Text></View> : <Text style={ui.error}>{t("pos.receiptMissing")}</Text>}
    <Button title={t("pos.newSale")} onPress={() => router.dismissTo("/(tabs)/sales")} /><Button secondary title={t("pos.history")} onPress={() => router.push("/(tabs)/sales/history")} />
  </POSFrame>;
}



