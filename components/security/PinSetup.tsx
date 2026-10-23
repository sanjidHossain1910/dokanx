import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/business/Screen";
import type { SecurityController } from "@/src/security/controller";
import { securityIssue } from "@/src/security/messages";
import PinScreen from "./PinScreen";

export default function PinSetup({ controller, token, onDone, onCancel }: { controller: SecurityController; token: string; onDone: () => void; onCancel: () => void }) {
  const { t } = useTranslation(); const [first, setFirst] = useState(""), [pin, setPin] = useState(""), [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false), [issue, setIssue] = useState("");
  const operation = useRef<AbortController | undefined>(undefined);
  const [progress, setProgress] = useState(0);
  useEffect(() => () => { operation.current?.abort(); controller.cancelPin(); }, [controller]);
  const cancel = () => { if (busy) operation.current?.abort(); else onCancel(); };
  const submit = async (value: string) => {
    if (busy || operation.current || value.length !== 4) return;
    if (!confirm) { setFirst(value); setPin(""); setConfirm(true); return; }
    if (first !== value) { setIssue(t("security.pinMismatch")); setPin(""); return; }
    const abort = new AbortController(); operation.current = abort;
    setBusy(true); setProgress(0); setIssue("");
    try { await controller.savePin(value, token, { signal: abort.signal, onProgress: setProgress }); setFirst(""); setPin(""); onDone(); }
    catch (cause) { setPin(""); setIssue(t(`security.${securityIssue(cause)}`)); }
    finally { operation.current = undefined; setBusy(false); }
  };
  return <PinScreen onBack={() => { if (busy) { cancel(); return; } if (confirm) { setConfirm(false); setFirst(""); setPin(""); setIssue(""); } else onCancel(); }} title={t(confirm ? "security.confirmPin" : "security.createPin")} subtitle={t(confirm ? "security.confirmHint" : "security.pinHint")} pin={pin} onChange={(value) => { setPin(value); setIssue(""); }} action={t(confirm ? "security.autoSave" : "security.autoContinue")} busy={busy} progress={progress} issue={issue} onSubmit={(value) => { void submit(value); }} footer={<><Button secondary title={t(confirm ? "security.startAgain" : "buttons.cancel")} disabled={busy} onPress={() => { if (confirm) { setConfirm(false); setFirst(""); setPin(""); setIssue(""); } else onCancel(); }} />{confirm && <Button secondary title={t("buttons.cancel")} onPress={cancel} />}</>} />;
}
