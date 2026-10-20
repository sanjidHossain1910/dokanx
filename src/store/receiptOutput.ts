import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
export async function printReceipt(html: string, _title: string) { await Print.printAsync({ html }); }
export async function shareReceipt(html: string, title: string) {
  if (!await Sharing.isAvailableAsync()) throw new Error("shareUnavailable");
  const pdf = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(pdf.uri, { mimeType: "application/pdf", UTI: ".pdf", dialogTitle: title });
}
