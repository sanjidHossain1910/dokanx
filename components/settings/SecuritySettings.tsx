import { useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { Fingerprint, ScanFace } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { usePreventRemove } from "expo-router/react-navigation";
import { useTheme } from "@/src/theme/ThemeProvider";
import { useSecurity } from "@/src/security/SecurityProvider";
import { securityIssue } from "@/src/security/messages";
import { Button, Screen, useUi } from "@/components/business/Screen";
import PinSetup from "@/components/security/PinSetup";

export default function SecuritySettings() {
  const { state, controller } = useSecurity(); const { colors } = useTheme(); const { t } = useTranslation(); const ui = useUi(); const [issue, setIssue] = useState(""), [token, setToken] = useState<string>();
  usePreventRemove(state.busy || !!token, () => { if (state.busy) return; controller.cancelPin(); setToken(undefined); });
  const run = async (action: () => Promise<unknown>) => { setIssue(""); try { await action(); } catch (cause) { setIssue(t(`security.${securityIssue(cause)}`)); } };
  const setup = () => run(async () => setToken(await controller.preparePin()));
  if (token) return <PinSetup controller={controller} token={token} onDone={() => setToken(undefined)} onCancel={() => { controller.cancelPin(); setToken(undefined); }} />;
  return <Screen back title={t("security.title")} fallbackHref="/(tabs)/profile">
    <View style={ui.card}><View style={ui.row}><Text style={{ ...ui.subtitle, flex: 1 }}>{t("security.appLock")}</Text><Switch accessibilityLabel={t("security.appLock")} disabled={state.busy} value={state.appLock} onValueChange={(value) => { void run(() => controller.setAppLock(value)); }} trackColor={{ true: colors.primary }} /></View><Text style={ui.text}>{t("security.appHint")}</Text><View style={ui.row}><Fingerprint size={24} color={colors.primary} /><ScanFace size={24} color={colors.primary} /><Text style={[ui.text, { flex: 1 }]}>{t("security.phoneDescription")}</Text></View></View>
    <Text style={ui.subtitle}>{t("security.reportLock")}</Text><View accessibilityRole="radiogroup" accessibilityLabel={t("security.reportLock")} style={{ gap: 8 }}>{(["off", "phone", "pin"] as const).map((mode) => <Pressable key={mode} accessibilityRole="radio" accessibilityState={{ checked: state.reportLock === mode, disabled: state.busy }} disabled={state.busy} onPress={() => { if (mode === state.reportLock) return; if (mode === "pin") void setup(); else void run(() => controller.setReportLock(mode)); }} style={{ ...ui.card, flexDirection: "row", alignItems: "center", padding: 14, gap: 12, backgroundColor: state.reportLock === mode ? colors.primarySoft : colors.card }}><View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: state.reportLock === mode ? colors.primary : colors.muted, alignItems: "center", justifyContent: "center" }}>{state.reportLock === mode && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }} />}</View><View style={{ flex: 1 }}><Text style={ui.subtitle}>{t(`security.mode.${mode}`)}</Text><Text style={ui.text}>{t(`security.modeHint.${mode}`)}</Text></View></Pressable>)}</View>
    {state.pinConfigured && <><Text style={{ color: colors.success }}>{t("security.pinConfigured")}</Text><Button secondary title={t("security.changePin")} disabled={state.busy} onPress={() => { void setup(); }} /></>}
    <View style={ui.card}><Text style={ui.text}>{t("security.sessionHint")}</Text><Text style={ui.text}>{t("security.recoveryHint")}</Text></View>{!!issue && <Text accessibilityRole="alert" style={ui.error}>{issue}</Text>}
  </Screen>;
}
