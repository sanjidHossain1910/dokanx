export type ScanSource = "camera" | "photo" | "manual" | "native" | "image";
export type BarcodeEvent = { data: string; type?: string; bounds?: unknown; cornerPoints?: unknown };
export type AcceptedScan = { id: string; barcode: string; source: ScanSource; received: BarcodeEvent };
let sequence = 0;

/** Accept a single result and leave the camera before doing any product work. */
export function createScanFlow(actions: {
  stopCamera: () => void;
  log: (scan: AcceptedScan) => void;
  navigate: (scan: AcceptedScan) => void;
}) {
  let accepted = false;
  return {
    reset() { accepted = false; },
    hasAccepted() { return accepted; },
    accept(event: BarcodeEvent, source: ScanSource) {
      const barcode = event.data?.trim();
      if (accepted || !barcode) return false;
      accepted = true;
      const scan = { id: `${Date.now()}-${++sequence}`, barcode, source, received: event };
      actions.stopCamera();
      actions.log(scan);
      actions.navigate(scan);
      return true;
    },
  };
}
