import DateTimePicker from "@react-native-community/datetimepicker";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Linking, Platform, Pressable, Switch, Text, View } from "react-native";
import { dayKey } from "@/src/store/finance";
import { type DuePlanInput, validDueDate } from "@/src/store/dueReminders";
import { reminderPermission } from "@/src/reminders/native";
import { useReminders } from "@/src/reminders/ReminderProvider";
import { reminderFailureStatus } from "@/src/reminders/diagnostics";
import { useTheme } from "@/src/theme/ThemeProvider";
import { Button, useUi } from "../business/Screen";

export function ReminderNotice() {
  const { status, retry } = useReminders(); const { t } = useTranslation(); const ui = useUi();
  if (status === "ok") return null;
  if (status === "unavailable") return <Text style={ui.text}>{t("due.unavailable")}</Text>;
  return <Pressable accessibilityRole="button" onPress={() => { if (status === "denied") void Linking.openSettings().catch(() => {}); else retry(); }}><Text style={ui.error}>{t(`due.${status}`)}</Text></Pressable>;
}
export default function DuePlanForm({ value, onChange, disabled }: { value?: DuePlanInput; onChange: (v?: DuePlanInput) => void; disabled?: boolean }) {
  const { t, i18n } = useTranslation(); const ui = useUi(); const { colors, isDark } = useTheme();
  const [picker, setPicker] = useState(false); const [requesting, setRequesting] = useState(false); const [issue, setIssue] = useState("");
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);
  const selected = value && validDueDate(value.dueDate) ? new Date(`${value.dueDate}T12:00:00`) : new Date();
  const locked = !!disabled || requesting;
  const toggleReminder = async (enabled: boolean) => {
    if (!value || locked) return;
    const current = ++generation.current;
    setIssue("");
    if (!enabled) { onChange({ ...value, remind: false }); return; }
    setRequesting(true);
    try {
      const allowed = await reminderPermission(true);
      if (generation.current === current) {
        onChange({ ...value, remind: allowed });
        if (!allowed) setIssue("denied");
      }
    } catch (error) { if (generation.current === current) setIssue(reminderFailureStatus(error) === "unavailable" ? "unavailable" : "permissionFailed"); }
    finally { setRequesting(false); }
  };
  return <View style={{ gap: 10 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><Text style={[ui.text, { flex: 1 }]}>{t(value ? "due.enabled" : "due.optional")}</Text><Switch accessibilityLabel={t("due.optional")} value={!!value} disabled={locked} trackColor={{ true: colors.primary }} onValueChange={(on) => { generation.current++; setIssue(""); setPicker(false); onChange(on ? { dueDate: dayKey(new Date()), remind: false } : undefined); }} /></View>
    {value && <View style={ui.card}>
      <Text style={ui.subtitle}>{t("due.date")}</Text>
      <Button secondary title={selected.toLocaleDateString(i18n.language === "bn" ? "bn-BD" : "en-GB", { year: "numeric", month: "short", day: "numeric" })} onPress={() => setPicker(true)} disabled={locked} />
      {picker && <><DateTimePicker value={selected} mode="date" display={Platform.OS === "ios" ? "spinner" : "default"} minimumDate={new Date(new Date().setHours(0, 0, 0, 0))} maximumDate={new Date(2199, 11, 31)} themeVariant={isDark ? "dark" : "light"} onValueChange={(_, date) => { if (Platform.OS === "android") setPicker(false); onChange({ ...value, dueDate: dayKey(date) }); }} onDismiss={() => setPicker(false)} />{Platform.OS === "ios" && <Button secondary title={t("due.done")} onPress={() => setPicker(false)} />}</>}
      {value.dueDate < dayKey(new Date()) && <Text style={ui.error}>{t("due.past")}</Text>}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><Text style={[ui.text, { flex: 1 }]}>{t("due.reminder")}</Text><Switch accessibilityLabel={t("due.reminder")} value={value.remind} disabled={locked || value.dueDate < dayKey(new Date())} trackColor={{ true: colors.primary }} onValueChange={(on) => void toggleReminder(on)} /></View>
      <Text style={ui.text}>{t(value.remind ? "due.hint" : "due.dateOnly")}</Text>
      {issue && <Pressable accessibilityRole={issue === "denied" ? "button" : undefined} onPress={() => { if (issue === "denied") void Linking.openSettings().catch(() => {}); }}><Text style={ui.error}>{t(`due.${issue}`)}</Text></Pressable>}
    </View>}
  </View>;
}
