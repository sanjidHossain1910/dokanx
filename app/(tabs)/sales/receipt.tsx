import Receipt from "@/components/pos/Receipt";
import ReportGate from "@/components/security/ReportGate";
import { useLocalSearchParams } from "expo-router";
export default function ReceiptRoute() {
  const { saleId } = useLocalSearchParams<{ saleId?: string }>();
  return <ReportGate receiptId={saleId}><Receipt /></ReportGate>;
}