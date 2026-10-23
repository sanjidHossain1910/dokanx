import DateTimePicker from "@react-native-community/datetimepicker";
import { CalendarDays, Clock, X } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Keyboard, Platform, Pressable, Text, View } from "react-native";
import { useTheme } from "@/src/theme/ThemeProvider";
import { localDateInput } from "@/src/store/salesHistory";
import { dayKey } from "@/src/store/finance";
import { Button, useUi } from "@/components/business/Screen";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  mode?: "date" | "time";
  disabled?: boolean;
  clearable?: boolean;
  minimumDate?: Date;
  maximumDate?: Date;
};

export default function DateTimeField({ label, value, onChange, mode = "date", disabled = false, clearable = false, minimumDate, maximumDate }: Props) {
  const { t, i18n } = useTranslation();
  const { colors, isDark } = useTheme();
  const ui = useUi();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(new Date());
  const locale = i18n.language === "bn" ? "bn-BD" : "en-GB";
  let selected = mode === "date" ? localDateInput(value) : null;
  if (mode === "time" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    selected = new Date();
    const [hours, minutes] = value.split(":").map(Number);
    selected.setHours(hours, minutes, 0, 0);
  }
  const format = (date: Date) => mode === "date"
    ? date.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })
    : date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  const commit = (date: Date) => {
    if (disabled) return;
    onChange(mode === "date" ? dayKey(date) : `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`);
  };
  const Icon = mode === "date" ? CalendarDays : Clock;
  return <View style={{ gap: 6 }}>
    <Text style={ui.subtitle}>{label}</Text>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityValue={{ text: selected ? format(selected) : "—" }} accessibilityState={{ disabled, expanded: open }} disabled={disabled} onPress={() => {
        Keyboard.dismiss();
        let initial = selected ?? new Date();
        if (minimumDate && initial < minimumDate) initial = minimumDate;
        if (maximumDate && initial > maximumDate) initial = maximumDate;
        setDraft(initial); setOpen(true);
      }} style={[ui.input, { flex: 1, minHeight: 50, flexDirection: "row", alignItems: "center", gap: 10, opacity: disabled ? 0.45 : 1 }]}>
        <Text style={{ flex: 1, fontSize: 16, color: selected ? colors.text : colors.muted }}>{selected ? format(selected) : label}</Text>
        <Icon size={20} color={colors.primary} />
      </Pressable>
      {clearable && !!value && <Pressable accessibilityRole="button" accessibilityLabel={`${t("business.clearDate")} · ${label}`} disabled={disabled} onPress={() => { setOpen(false); onChange(""); }} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.45 : 1 }}><X size={20} color={colors.muted} /></Pressable>}
    </View>
    {open && !disabled && <>
      <DateTimePicker value={draft} mode={mode} display={Platform.OS === "ios" ? "spinner" : "default"} themeVariant={isDark ? "dark" : "light"} minimumDate={minimumDate} maximumDate={maximumDate ?? (mode === "date" ? new Date(2199, 11, 31) : undefined)} onValueChange={(_, date) => {
        if (Platform.OS === "android") { setOpen(false); commit(date); }
        else setDraft(date);
      }} onDismiss={() => setOpen(false)} />
      {Platform.OS === "ios" && <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}><Button secondary title={t("business.cancel")} onPress={() => setOpen(false)} /></View>
        <View style={{ flex: 1 }}><Button title={t("due.done")} onPress={() => { commit(draft); setOpen(false); }} /></View>
      </View>}
    </>}
  </View>;
}
