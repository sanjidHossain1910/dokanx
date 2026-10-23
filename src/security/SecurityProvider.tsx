import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { ActivityIndicator, Modal, Pressable, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/business/Screen";
import PinScreen, { SecurityPage } from "@/components/security/PinScreen";
import PinSetup from "@/components/security/PinSetup";
import { securityController } from "./native";
import { securityIssue } from "./messages";
import type { SecurityController, SecurityState } from "./controller";
import { useTheme } from "../theme/ThemeProvider";

type Context = { state: SecurityState; controller: SecurityController; requestReports: () => Promise<boolean> };
const SecurityContext = createContext<Context | null>(null);
export function useSecurity() { const value = useContext(SecurityContext); if (!value) throw new Error("SecurityProvider missing"); return value; }

export function SecurityProvider({ children, controller = securityController }: { children: ReactNode; controller?: SecurityController }) {
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot, controller.snapshot);
  const [prompt, setPrompt] = useState(false);
  const pending = useRef<{ promise: Promise<boolean>; resolve: (ok: boolean) => void } | undefined>(undefined);
  useEffect(() => { void controller.load().catch(() => {}); return () => { pending.current?.resolve(false); pending.current = undefined; }; }, [controller]);
  const finish = useCallback((ok: boolean) => { pending.current?.resolve(ok); pending.current = undefined; setPrompt(false); }, []);
  const requestReports = useCallback(() => {
    const current = controller.snapshot();
    if (current.reportsUnlocked) return Promise.resolve(true);
    if (!current.ready || current.error || !current.appUnlocked) return Promise.resolve(false);
    if (pending.current) return pending.current.promise;
    let resolve!: (ok: boolean) => void;
    const promise = new Promise<boolean>((done) => { resolve = done; }); pending.current = { promise, resolve }; setPrompt(true); return promise;
  }, [controller]);
  return <SecurityContext.Provider value={{ state, controller, requestReports }}>{children}{prompt && <Modal visible animationType="fade" onRequestClose={() => { if (!controller.snapshot().busy) finish(false); }}><ReportsPrompt onFinish={finish} /></Modal>}</SecurityContext.Provider>;
}

function ReportsPrompt({ onFinish }: { onFinish: (ok: boolean) => void }) {
  const { state, controller } = useSecurity(); const { t } = useTranslation(); const { colors } = useTheme();
  const [pin, setPin] = useState(""), [issue, setIssue] = useState(""), [token, setToken] = useState<string>(); const [now, setNow] = useState(() => Date.now());
  const attempted = useRef(false);
  const [progress, setProgress] = useState(0);
  const seconds = Math.max(0, Math.ceil((state.blockedUntil - now) / 1000));
  useEffect(() => { if (state.blockedUntil <= Date.now()) return; const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, [state.blockedUntil]);
  const unlock = async (value?: string) => { if (controller.snapshot().busy) return; setIssue(""); setProgress(0); try { await controller.unlockReports(value, { onProgress: setProgress }); setPin(""); onFinish(true); } catch (cause) { setNow(Date.now()); setPin(""); setIssue(t(`security.${securityIssue(cause)}`)); } };
  useEffect(() => {
    if (state.reportLock !== "phone" || attempted.current || state.busy) return;
    attempted.current = true;
    void controller.unlockReports().then(() => onFinish(true)).catch((cause) => setIssue(t(`security.${securityIssue(cause)}`)));
  }, [state.reportLock, state.busy, controller, onFinish, t]);
  const recover = async () => { setIssue(""); try { setToken(await controller.preparePin(true)); setPin(""); } catch (cause) { setIssue(t(`security.${securityIssue(cause)}`)); } };
  if (token) return <PinSetup controller={controller} token={token} onDone={() => onFinish(true)} onCancel={() => { controller.cancelPin(); setToken(undefined); }} />;
  if (state.reportLock === "pin" && state.pinNeedsUpgrade) return <SecurityPage title={t("security.upgradePin")} subtitle={t("security.upgradeHint")} onBack={() => { if (!state.busy) onFinish(false); }}><Button title={t("security.upgradePin")} disabled={state.busy} onPress={() => { void recover(); }} />{!!issue && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{issue}</Text>}<Button secondary title={t("buttons.cancel")} disabled={state.busy} onPress={() => onFinish(false)} /></SecurityPage>;
  if (state.reportLock === "phone") return <SecurityPage title={t("security.reportsTitle")} subtitle={t("security.phoneReportsHint")} onBack={() => { if (!state.busy) onFinish(false); }}><Button title={t("security.unlockPhone")} disabled={state.busy} onPress={() => { void unlock(); }} />{!!issue && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{issue}</Text>}<Button secondary title={t("buttons.cancel")} disabled={state.busy} onPress={() => onFinish(false)} /></SecurityPage>;
  return <PinScreen onBack={() => { if (!state.busy) onFinish(false); }} title={t("security.enterPin")} subtitle={t("security.reportsHint")} pin={pin} onChange={(value) => { setPin(value); setIssue(""); }} action={t("security.autoUnlock")} busy={state.busy} progress={progress} disabled={seconds > 0} issue={seconds ? t("security.waitSeconds", { seconds }) : issue} onSubmit={(value) => { void unlock(value); }} inputFooter={<Pressable accessibilityRole="button" accessibilityState={{ disabled: state.busy }} disabled={state.busy} hitSlop={10} onPress={() => { void recover(); }} style={({ pressed }) => ({ alignSelf: "center", paddingHorizontal: 6, paddingVertical: 4, opacity: state.busy ? 0.4 : pressed ? 0.65 : 1 })}><Text style={{ color: colors.primary, fontSize: 13, lineHeight: 20 }}>{t("security.forgotPin")}</Text></Pressable>} footer={<><Text style={{ color: colors.muted, textAlign: "center", fontSize: 12 }}>{t("security.newSalesAllowed")}</Text><Button secondary title={t("buttons.cancel")} disabled={state.busy} onPress={() => onFinish(false)} /></>} />;
}

export function AppAccessGate({ children }: { children: ReactNode }) {
  const { state, controller } = useSecurity(); const { t } = useTranslation(); const { colors } = useTheme(); const [issue, setIssue] = useState(""); const attempted = useRef(false);
  useEffect(() => {
    if (!state.ready || state.error || state.appUnlocked || state.busy || attempted.current) return;
    attempted.current = true; void controller.unlockApp().catch((cause) => setIssue(t(`security.${securityIssue(cause)}`)));
  }, [state.ready, state.error, state.appUnlocked, state.busy, controller, t]);
  if (state.error) return <SecurityPage title={t("security.title")} subtitle={t("security.securityStorage")}><Button title={t("business.retry")} disabled={state.busy} onPress={() => { attempted.current = false; void controller.load().catch(() => {}); }} /></SecurityPage>;
  if (!state.ready) return <SecurityPage title="DokanX" subtitle={t("common.loading")}><ActivityIndicator color={colors.primary} /></SecurityPage>;
  if (!state.appUnlocked) return <SecurityPage title="DokanX" subtitle={t("security.appHint")}><Button title={t("security.unlockPhone")} disabled={state.busy} onPress={() => { setIssue(""); void controller.unlockApp().catch((cause) => setIssue(t(`security.${securityIssue(cause)}`))); }} />{!!issue && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{issue}</Text>}</SecurityPage>;
  return children;
}
