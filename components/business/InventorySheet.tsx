import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { useTheme } from "@/src/theme/ThemeProvider";
import { X } from "lucide-react-native";
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Animated, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function InventorySheet({ title, children, onClose, busy = false }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { formMaxWidth } = useResponsiveLayout();
  const [offset] = useState(() => new Animated.Value(0));
  const current = useRef({ busy, onClose });
  const closing = useRef(false);
  const mounted = useRef(true);
  const sheetHeight = useRef(900);
  useLayoutEffect(() => { current.current = { busy, onClose }; }, [busy, onClose]);
  useLayoutEffect(() => { mounted.current = true; return () => { mounted.current = false; offset.stopAnimation(); }; }, [offset]);
  // Gesture callbacks run on touch events, not while the gesture is configured.
  const drag = useMemo(() => {
    const reset = () => Animated.spring(offset, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
    return Gesture.Pan()
      .enabled(!busy)
      .runOnJS(true)
      .activeOffsetY(8)
      .failOffsetY(-8)
      .failOffsetX([-24, 24])
      .onStart(() => { offset.stopAnimation(); Keyboard.dismiss(); })
      // eslint-disable-next-line react-hooks/refs
      .onUpdate((event) => {
        if (!current.current.busy && !closing.current) offset.setValue(Math.max(0, event.translationY));
      })
      // eslint-disable-next-line react-hooks/refs
      .onEnd((event, success) => {
        if (success && !current.current.busy && !closing.current && (event.translationY > 70 || (event.translationY > 20 && event.velocityY > 700))) {
          closing.current = true;
          Animated.timing(offset, { toValue: Math.max(event.translationY, sheetHeight.current + 40), duration: 180, useNativeDriver: true }).start(({ finished }) => {
            if (!mounted.current) return;
            closing.current = false;
            if (finished && !current.current.busy) current.current.onClose();
            else reset();
          });
        } else if (!closing.current) reset();
      })
      // eslint-disable-next-line react-hooks/refs
      .onFinalize(() => { if (!closing.current && mounted.current) reset(); });
  }, [offset, busy]);
  return <Modal visible transparent animationType="slide" onRequestClose={() => { if (!busy) onClose(); }}>
    <GestureHandlerRootView style={{ flex: 1 }}>
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, justifyContent: "flex-end", backgroundColor: colors.overlay }}>
      <Pressable disabled={busy} accessibilityLabel={t("business.cancel")} accessibilityRole="button" onPress={onClose} style={{ position: "absolute", inset: 0 }} />
      <Animated.View onLayout={(event) => { sheetHeight.current = event.nativeEvent.layout.height; }} style={{ transform: [{ translateY: offset }], maxHeight: "85%", width: "100%", maxWidth: formMaxWidth, alignSelf: "center", backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: insets.bottom + 16 }}>
        <GestureDetector gesture={drag}>
        <View collapsable={false} style={{ paddingTop: 6 }}>
        <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginTop: 12 }} />
        <View className="flex-row items-center justify-between px-5 py-3"><Text accessibilityRole="header" style={{ flex: 1, color: colors.text, fontSize: 20, lineHeight: 30, fontWeight: "700" }}>{title}</Text><Pressable disabled={busy} onPress={onClose} accessibilityRole="button" accessibilityLabel={t("business.cancel")} style={{ width: 44, height: 44, justifyContent: "center", alignItems: "center" }}><X size={22} color={colors.muted} /></Pressable></View>
        </View>
        </GestureDetector>
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}>{children}</ScrollView>
      </Animated.View>
    </KeyboardAvoidingView>
    </GestureHandlerRootView>
  </Modal>;
}
