import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { captureRef } from "react-native-view-shot";
import type { ReceiptPaper } from "@/src/store/receipt";
import { printBitmap, readPrinter } from "@/src/store/printer";
import { printReceipt } from "@/src/store/receiptOutput";
export function ReceiptPaperView({ paper, width }: { paper: ReceiptPaper; width?: number }) {
  return <View style={{ width: width ?? "100%", maxWidth: width ?? 340, padding: 16, backgroundColor: "#fff", gap: 14 }}><Text style={{ color: "#000", textAlign: "center", fontSize: 23, lineHeight: 33, fontWeight: "800" }}>{paper.shopName}</Text><Text style={{ color: "#000", fontSize: 14, lineHeight: 23 }}>Transaction ID: {paper.transactionId}{"\n"}{paper.date}</Text>{paper.items.map((l) => <View key={l.id} style={{ flexDirection: "row", gap: 8, borderBottomWidth: 1, borderStyle: "dashed", borderColor: "#000", paddingBottom: 10 }}><View style={{ flex: 1 }}><Text style={{ color: "#000", fontSize: 17, lineHeight: 26 }}>{l.name}</Text><Text style={{ color: "#000", fontSize: 13, lineHeight: 22 }}>{l.detail}</Text></View><Text style={{ color: "#000", fontSize: 16, lineHeight: 26 }}>{l.price}</Text></View>)}<View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10, borderTopWidth: 2, borderColor: "#000", paddingTop: 12 }}><Text style={{ color: "#000", fontSize: 22, fontWeight: "800" }}>{paper.totalLabel}</Text><Text style={{ color: "#000", fontSize: 22, fontWeight: "800" }}>{paper.total}</Text></View><Text style={{ color: "#000", fontSize: 18, lineHeight: 28, textAlign: "center", marginVertical: 14 }}>Thank you</Text></View>;
}
export function useReceiptPrinter() {
  const view = useRef<View>(null); const resolve = useRef<(() => void) | undefined>(undefined); const reject = useRef<((e: Error) => void) | undefined>(undefined); const [job, setJob] = useState<{ paper: ReceiptPaper; width: number; id: number }>();
  useEffect(() => () => { reject.current?.(new Error("printerFailed")); }, []);
  const print = async (paper: ReceiptPaper, html: string) => {
    const settings = await readPrinter();
    if (!settings) { await printReceipt(html, paper.transactionId); return; }
    const width = settings.paperWidth === 58 ? 384 : 576;
    try {
      await new Promise<void>((yes, no) => { const timeout = setTimeout(() => no(new Error("printerFailed")), 5000); resolve.current = () => { clearTimeout(timeout); yes(); }; reject.current = (e) => { clearTimeout(timeout); no(e); }; setJob({ paper, width, id: Date.now() }); });
      const bitmap = await captureRef(view, { format: "png", quality: 1, result: "base64", width });
      await printBitmap(settings, bitmap);
    } finally { resolve.current = undefined; reject.current = undefined; setJob(undefined); }
  };
  const node = job ? <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: "absolute", left: -10000, top: 0 }}><View key={job.id} ref={view} collapsable={false} onLayout={() => { requestAnimationFrame(() => resolve.current?.()); }}><ReceiptPaperView paper={job.paper} width={job.width} /></View></View> : null;
  return { print, node };
}
