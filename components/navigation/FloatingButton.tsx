import { Plus } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { Animated, Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/src/theme/ThemeProvider";
import { useReducedMotion } from "react-native-reanimated";

interface FloatingButtonProps {
    focused: boolean;
    onPress: () => void;
    onLongPress?: () => void;
}

export default function FloatingButton({
    focused,
    onPress,
    onLongPress,
}: FloatingButtonProps) {
    const { t } = useTranslation();
    const { colors } = useTheme();
    const reducedMotion = useReducedMotion();

    const [rotateAnim] = useState(() => new Animated.Value(0));

    useEffect(() => {
        Animated.timing(rotateAnim, {
            toValue: focused ? 1 : 0,
            duration: reducedMotion ? 0 : 250,
            useNativeDriver: true,
        }).start();
    }, [focused, rotateAnim, reducedMotion]);



    const rotate = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ["0deg", "90deg"],
    });

    return (
        <View
            style={{
                flex: 1,
                alignItems: "center",
            }}
        >
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("pos.newSale")}
                accessibilityHint={t("pos.quickActionsHint")}
                onPress={onPress}
                onLongPress={onLongPress}
                style={{
                    position: "absolute",
                    top: -34,
                    width: 62,
                    height: 62,
                    borderRadius: 31,
                    justifyContent: "center",
                    alignItems: "center",
                    backgroundColor: colors.primary,
                    borderWidth: focused ? 3 : undefined,
                    borderColor: focused ? colors.border : undefined,
                }}
            >
                <Animated.View
                    style={{
                        transform: [{ rotate }],
                    }}
                >
                    <Plus
                        size={30}
                        color={colors.onPrimary}
                        strokeWidth={2.5}
                    />
                </Animated.View>
            </Pressable>
        </View>
    );
}
