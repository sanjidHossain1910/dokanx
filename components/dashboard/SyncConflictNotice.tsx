import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { ArrowRight, CircleAlert } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useCloudBackup } from "@/src/cloudBackup/CloudBackupProvider";
import { useTheme } from "@/src/theme/ThemeProvider";

export default function SyncConflictNotice() {
  const backup = useCloudBackup();
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  if (!backup.controller || (!backup.queueCounts.conflict && !["syncConflict", "syncInvalidMerge", "syncKeyConflict"].includes(backup.error))) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("conflicts.dashboard.action")}
      accessibilityHint={t("conflicts.dashboard.body")}
      accessibilityState={{ disabled: backup.busy }}
      disabled={backup.busy}
      onPress={() => router.push("/settings/sync-conflicts")}
      style={({ pressed }) => ({
        backgroundColor: colors.warningSoft, borderColor: colors.warning,
        borderWidth: 1, borderLeftWidth: 4, borderRadius: 16,
        padding: 16, gap: 10, opacity: backup.busy ? 0.65 : pressed ? 0.8 : 1,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <CircleAlert size={23} color={colors.warning} />
        <Text accessibilityLiveRegion="polite" style={{ flex: 1, color: colors.text, fontSize: 17, fontWeight: "700", lineHeight: 27 }}>
          {t("conflicts.dashboard.title")}
        </Text>
      </View>
      {backup.queueCounts.conflict > 0 && <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600", lineHeight: 23 }}>
        {t("conflicts.dashboard.count", { number: backup.queueCounts.conflict.toLocaleString(i18n.language) })}
      </Text>}
      <Text style={{ color: colors.text, fontSize: 14, lineHeight: 23 }}>{t("conflicts.dashboard.body")}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 32 }}>
        <Text style={{ flex: 1, color: colors.primary, fontSize: 15, fontWeight: "700", lineHeight: 24 }}>{t("conflicts.dashboard.action")}</Text>
        <ArrowRight size={19} color={colors.primary} />
      </View>
    </Pressable>
  );
}
