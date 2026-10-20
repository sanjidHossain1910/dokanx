import { useTheme } from "@/src/theme/ThemeProvider";
import { router, type Href } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

export interface HeaderProps {
  title: string;
  description?: string;
  rightSection?: ReactNode;
  onBack?: () => void;
  fallbackHref?: Href;
}

/** Place inside the screen's safe area. The header stays outside scrolling content. */
export default function Header({ title, description, rightSection, onBack, fallbackHref = "/(tabs)" }: HeaderProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const goBack = () => {
    if (onBack) onBack();
    else if (router.canGoBack()) router.back();
    else router.replace(fallbackHref);
  };
  return <View style={{ backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border }}>
    <View className="mx-auto w-full flex-row items-center gap-3 px-4 py-3" style={{ maxWidth: 720, minHeight: 72 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={t("business.back")} onPress={goBack}
        style={({ pressed }) => ({ width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: pressed ? colors.elevated : "transparent" })}>
        <ArrowLeft size={24} strokeWidth={2} color={colors.text} />
      </Pressable>
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 20, fontWeight: "700", lineHeight: 29 }}>{title}</Text>
        {!!description && <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 20 }}>{description}</Text>}
      </View>
      {rightSection != null && <View style={{ flexShrink: 0, alignItems: "flex-end", justifyContent: "center" }}>{rightSection}</View>}
    </View>
  </View>;
}
