import { formatBusinessDate } from "@/src/store/businessSettings";
import { Button, money, useUi } from "@/components/business/Screen";
import { usePurchasing } from "@/src/store/usePurchasing";
import { receivePurchase } from "@/src/store/purchasing";
import { purchaseReceiptHTML, purchasePaper } from "@/src/store/purchaseReceipt";
import { supplierInvoiceDue } from "@/src/store/finance";
import { useReceiptPrinter } from "@/components/payments/PrintableReceipt";
import { shareReceipt } from "@/src/store/receiptOutput";
import { formatNumber } from "@/src/dashboard/format";
import { unitLabel } from "@/src/store/productUnits";
import { useTheme } from "@/src/theme/ThemeProvider";
import { router, useLocalSearchParams } from "expo-router";
import { Check } from "lucide-react-native";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import Animated, { FadeInDown, ReduceMotion } from "react-native-reanimated";
import { PurchaseFrame, PurchaseIssue, SupplierInfo } from "./Shared";

function ReceiptRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  const { colors } = useTheme();
  return <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, paddingVertical: strong ? 6 : 2 }}><Text style={{ flex: 1, color: colors.muted, fontSize: strong ? 15 : 12, lineHeight: 21, fontWeight: strong ? "700" : "400" }}>{label}</Text><Text style={{ flexShrink: 1, textAlign: "right", color: strong ? colors.primary : colors.text, fontSize: strong ? 19 : 13, lineHeight: 23, fontWeight: "600" }}>{value}</Text></View>;
}

export default function Receipt() {
  const { purchaseId, success } = useLocalSearchParams<{ purchaseId?: string; success?: string }>();
  const p = usePurchasing(); const { t, i18n } = useTranslation(); const { colors } = useTheme(); const ui = useUi();
  const [outputBusy, setOutputBusy] = useState(false); const [outputIssue, setOutputIssue] = useState(""); const [received, setReceived] = useState(false); const lock = useRef(false);
  const invoice = p.data.purchaseInvoices?.find((i) => i.id === purchaseId);
  const printer = useReceiptPrinter();
  const legacy = p.data.purchases?.find((i) => !i.invoiceId && i.id === purchaseId);
  const output = async (share: boolean) => {
    if (lock.current || !invoice) return; lock.current = true; setOutputBusy(true); setOutputIssue("");
    try { const html = purchaseReceiptHTML(invoice, i18n.language, t, p.data.businessSettings); if (share) await shareReceipt(html, t("purchase.receipt")); else await printer.print(purchasePaper(invoice, i18n.language, p.data.businessSettings), html); }
    catch (cause) { setOutputIssue(cause instanceof Error && ["shareUnavailable", "printUnavailable", "printerPlatform", "printerBuildRequired", "printerPermission", "printerBusy", "printerFailed"].includes(cause.message) ? `${cause.message.startsWith("printer") ? "flows" : "pos"}.${cause.message}` : "purchase.receiptFailed"); }
    finally { lock.current = false; setOutputBusy(false); }
  };
  return <PurchaseFrame title={t("purchase.receipt")} hideHeader={success === "1"}>
    {printer.node}
    {invoice && <View style={ui.card}><Text style={ui.subtitle}>{t("flows.balance")}: {money(supplierInvoiceDue(p.data, invoice.id))}</Text><Button secondary title={t("flows.suppliers")} onPress={() => router.push({ pathname: "/business/suppliers", params: { id: invoice.supplierId } })} /></View>}
    {invoice ? <>
      {success === "1" && <Animated.View entering={FadeInDown.duration(250).reduceMotion(ReduceMotion.System)} style={{ alignItems: "center", paddingTop: 14, paddingBottom: 6, gap: 8 }}><View style={{ width: 66, height: 66, borderRadius: 33, alignItems: "center", justifyContent: "center", backgroundColor: colors.successSoft }}><Check color={colors.success} size={36} strokeWidth={3} /></View><Text style={[ui.title, { textAlign: "center", fontSize: 21 }]}>{t("purchase.success")}</Text><Text style={[ui.text, { textAlign: "center", fontSize: 12, lineHeight: 20 }]}>{t("purchase.successHint")}</Text></Animated.View>}
      <View style={[ui.card, { padding: 14, gap: 5 }]}><SupplierInfo compact supplier={{ name: invoice.supplierName, phone: invoice.supplierPhone, address: invoice.supplierAddress }} /><Text selectable style={[ui.text, { fontSize: 10, lineHeight: 16 }]}>{invoice.invoiceNumber}</Text><Text style={[ui.text, { fontSize: 11, lineHeight: 18 }]}>{formatBusinessDate(invoice.createdAt, i18n.language, p.data.businessSettings)}</Text><Text style={[ui.subtitle, { fontSize: 13 }]}>{t("purchase.items", { count: formatNumber(invoice.items.length, i18n.language) })}</Text>
      {invoice.items.map((l) => <View key={l.productId} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 5 }}><View style={{ flex: 1 }}><Text style={[ui.subtitle, { fontSize: 13 }]}>{l.name}</Text><Text style={[ui.text, { fontSize: 11, lineHeight: 18 }]}>{formatNumber(l.quantity, i18n.language)} {unitLabel(l.unit, i18n.language)} × {money(l.unitCost)}</Text></View><Text style={[ui.subtitle, { fontSize: 13 }]}>{money(l.grossTotal)}</Text></View>)}
      <ReceiptRow label={t("purchase.subtotal")} value={money(invoice.subtotal)} /><ReceiptRow label={t("purchase.discount")} value={`− ${money(invoice.discountAmount)}`} /><ReceiptRow label={t("purchase.transportLabel")} value={money(invoice.transport)} /><ReceiptRow label={t("purchase.otherLabel")} value={money(invoice.other)} /><ReceiptRow label={t("purchase.total")} value={money(invoice.total)} strong /><ReceiptRow label={t("purchase.paymentMethod")} value={t(`purchase.${invoice.method}`)} /><ReceiptRow label={t("purchase.paid")} value={money(invoice.paid)} /><ReceiptRow label={t("purchase.due")} value={money(invoice.due)} /><ReceiptRow label={t("purchase.receiptStatus")} value={t(`purchase.${invoice.status}`)} />
      {!!invoice.reference && <Text selectable style={ui.text}>{invoice.reference}</Text>}{!!invoice.note && <Text style={ui.text}>{invoice.note}</Text>}</View>
      {invoice.status === "pending" && <><Text style={ui.text}>{t("purchase.statusHint")}</Text><Button title={t("purchase.markReceived")} disabled={p.busy || outputBusy} onPress={() => void p.run((data) => receivePurchase(data, invoice.id, new Date().toISOString())).then((ok) => { if (ok) setReceived(true); })} /></>}
      {received && <Text style={ui.text}>{t("purchase.receivedSuccess")}</Text>}<PurchaseIssue issue={p.issue} />
      <View style={{ flexDirection: "row", gap: 10 }}><View style={{ flex: 1 }}><Button secondary title={t("purchase.print")} disabled={outputBusy || p.busy} onPress={() => void output(false)} /></View><View style={{ flex: 1 }}><Button secondary title={t("purchase.share")} disabled={outputBusy || p.busy} onPress={() => void output(true)} /></View></View>{!!outputIssue && <Text style={ui.error}>{t(outputIssue)}</Text>}
    </> : legacy ? <View style={ui.card}><Text style={ui.title}>{legacy.name}</Text><Text style={ui.text}>{t("purchase.legacyHint")}</Text><ReceiptRow label={t("purchase.total")} value={money(legacy.total)} strong /><Text style={ui.text}>{formatNumber(legacy.quantity, i18n.language)} {unitLabel(legacy.unit, i18n.language)}</Text><Text style={ui.text}>{formatBusinessDate(legacy.createdAt, i18n.language, p.data.businessSettings)}</Text><Text selectable style={ui.text}>{legacy.productId}</Text></View> : <PurchaseIssue issue="receiptMissing" />}
    <Button title={t("purchase.newPurchase")} disabled={p.busy || outputBusy} onPress={() => router.replace("/business/purchases/suppliers")} /><Button secondary title={t("purchase.history")} disabled={p.busy || outputBusy} onPress={() => router.dismissTo("/business/purchases")} />
  </PurchaseFrame>;
}



