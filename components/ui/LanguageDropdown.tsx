import { useLanguage } from "@/hooks/useLanguage";
import { LanguageCode, languages, supportedLanguageCodes } from "@/src/i18n";
import { Check, ChevronDown } from "lucide-react-native";
import { memo, useEffect, useRef, useState } from "react";
import { Animated, Easing, Modal, Pressable, Text, View } from "react-native";

const MENU_WIDTH = 192;

type MenuPosition = {
  left: number;
  top: number;
};

function LanguageDropdown() {
  const triggerRef = useRef<View>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition>({ left: 0, top: 0 });
  const animation = useRef(new Animated.Value(0)).current;
  const { changeLanguage, currentLanguage } = useLanguage();
  useEffect(() => {
    Animated.timing(animation, { toValue: isOpen ? 1 : 0, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [animation, isOpen]);

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
    await changeLanguage(languageCode);
    setIsOpen(false);
  };
  const selectedLanguage = languages[currentLanguage];
  return (
    <View ref={triggerRef}>
      <Pressable accessibilityRole="button" accessibilityLabel="Choose language" onPress={isOpen ? () => setIsOpen(false) : openMenu} className="flex-row items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <Text className="text-base">{selectedLanguage.flag}</Text>
        <Text className="font-semibold text-slate-700">{selectedLanguage.label}</Text>
        <ChevronDown size={16} color="#475569" />
      </Pressable>
      <Modal transparent visible={isOpen} animationType="none" onRequestClose={() => setIsOpen(false)}>
        <Pressable accessibilityLabel="Close language menu" onPress={() => setIsOpen(false)} className="absolute inset-0" />
        <Animated.View style={{ left: menuPosition.left, top: menuPosition.top, opacity: animation, transform: [{ scale: animation.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }} className="absolute w-48 overflow-hidden rounded-2xl border border-slate-100 bg-white py-1 shadow-lg">
        {supportedLanguageCodes.map((languageCode) => {
          const language = languages[languageCode];
          const isSelected = currentLanguage === languageCode;
          return <Pressable key={languageCode} accessibilityRole="menuitem" onPress={() => void selectLanguage(languageCode)} className="flex-row items-center px-4 py-3 active:bg-slate-50">
            <Text className="mr-3 text-lg">{language.flag}</Text>
            <Text className="flex-1 font-medium text-slate-700">{language.label}</Text>
            {isSelected ? <Check size={18} color="#2563eb" strokeWidth={3} /> : null}
          </Pressable>;
        })}
        </Animated.View>
      </Modal>
    </View>
  );
}
export default memo(LanguageDropdown);
