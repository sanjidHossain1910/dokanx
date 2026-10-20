import { useLanguage } from "@/hooks/useLanguage";
import { LanguageCode, languages, supportedLanguageCodes } from "@/src/i18n";
import { Check, ChevronDown } from "lucide-react-native";
import { memo, useEffect, useRef, useState } from "react";
import { Alert, Animated, Easing, Modal, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/src/theme/ThemeProvider";
import { useReducedMotion } from "react-native-reanimated";

const MENU_WIDTH = 192;

type MenuPosition = {
  left: number;
  top: number;
};

function LanguageDropdown({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const triggerRef = useRef<View>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition>({ left: 0, top: 0 });
  const [animation] = useState(() => new Animated.Value(0));
  const { changeLanguage, currentLanguage } = useLanguage();
  useEffect(() => {
    Animated.timing(animation, { toValue: isOpen ? 1 : 0, duration: reducedMotion ? 0 : 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [animation, isOpen, reducedMotion]);

  const openMenu = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setMenuPosition({
        left: Math.max(16, x + width - MENU_WIDTH),
        top: y + height + 8,
      });
      setIsOpen(true);
    });
  };

  const selectLanguage = async (languageCode: LanguageCode) => {
    try {
      await changeLanguage(languageCode);
      setIsOpen(false);
    } catch {
      Alert.alert(t("errors.generic"));
    }
  };
  const selectedLanguage = languages[currentLanguage];
  return (
    <View ref={triggerRef} collapsable={false}>
      <Pressable accessibilityRole="button" accessibilityLabel={t("dashboard.chooseLanguage")} onPress={isOpen ? () => setIsOpen(false) : openMenu} className="flex-row items-center gap-2 rounded-xl border px-3 py-2 shadow-sm" style={{ backgroundColor: colors.card, borderColor: colors.border, minHeight: 44 }}>
        <Text className="text-base" style={{ color: colors.text }}>{selectedLanguage.flag}</Text>
        {!compact && <Text className="font-semibold" style={{ color: colors.text }}>{selectedLanguage.label}</Text>}
        <ChevronDown size={16} color={colors.muted} />
      </Pressable>
      <Modal transparent visible={isOpen} animationType="none" onRequestClose={() => setIsOpen(false)}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("dashboard.closeLanguage")} onPress={() => setIsOpen(false)} className="absolute inset-0" />
        <Animated.View style={{ backgroundColor: colors.card, borderColor: colors.border, left: menuPosition.left, top: menuPosition.top, opacity: animation, transform: [{ scale: animation.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }} className="absolute w-48 overflow-hidden rounded-2xl border py-1 shadow-lg">
        {supportedLanguageCodes.map((languageCode) => {
          const language = languages[languageCode];
          const isSelected = currentLanguage === languageCode;
          return <Pressable key={languageCode} accessibilityRole="menuitem" onPress={() => void selectLanguage(languageCode)} className="flex-row items-center px-4 py-3" style={({ pressed }) => ({ backgroundColor: pressed || isSelected ? colors.elevated : colors.card })}>
            <Text className="mr-3 text-lg" style={{ color: colors.text }}>{language.flag}</Text>
            <Text className="flex-1 font-medium" style={{ color: colors.text }}>{language.label}</Text>
            {isSelected ? <Check size={18} color={colors.primary} strokeWidth={3} /> : null}
          </Pressable>;
        })}
        </Animated.View>
      </Modal>
    </View>
  );
}
export default memo(LanguageDropdown);
