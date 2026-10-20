import { router } from "expo-router";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import React, { useState } from "react";
import { View } from "react-native";
import { useKeyboardVisible } from "@/hooks/useKeyboardVisible";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import InventorySheet from "../business/InventorySheet";
import { Button } from "../business/Screen";
import { useTranslation } from "react-i18next";
import FloatingButton from "./FloatingButton";
import TabButton from "./TabButton";
import { useTheme } from "@/src/theme/ThemeProvider";

export default function CustomTabBar({
    state,
    descriptors,
    navigation,
}: BottomTabBarProps) {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const [quickActions, setQuickActions] = useState(false);
    const keyboardVisible = useKeyboardVisible();
    const { t } = useTranslation();
    if (keyboardVisible) return null;
    return (
        <>
            <View
                style={{
                    position: "absolute",
                    left: 16,
                    right: 16,
                    bottom: insets.bottom + 12,

                    height: 74,
                    borderRadius: 24,

                    backgroundColor: colors.card,

                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",

                    paddingHorizontal: 12,

                    borderWidth: 1,
                    borderColor: colors.border,

                    shadowColor: colors.shadow,
                    shadowOpacity: 0.15,
                    shadowRadius: 12,
                    shadowOffset: {
                        width: 0,
                        height: 5,
                    },
                    elevation: 12,
                }}
            >
                {state.routes.map((route, index) => {
                    const focused = state.index === index;

                    const onPress = () => {
                        const event = navigation.emit({
                            type: "tabPress",
                            target: route.key,
                            canPreventDefault: true,
                        });

                        if (!focused && !event.defaultPrevented) {
                            navigation.navigate(route.name);
                        }
                    };

                    const options = descriptors[route.key].options;

                    // Middle Floating Button
                    if (route.name === "sales") {
                        return (
                            <FloatingButton
                                key={route.key}
                                onPress={() => { navigation.navigate(route.name); router.dismissTo("/(tabs)/sales"); }}
                                onLongPress={() => setQuickActions(true)}
                                focused={focused}
                            />
                        );
                    }

                    return (
                        <TabButton
                            key={route.key}
                            routeName={route.name}
                            label={(options.title as string) || route.name}
                            focused={focused}
                            onPress={onPress}
                        />
                    );
                })}
            </View>
            {quickActions && <InventorySheet title={t("business.quickActions")} onClose={() => setQuickActions(false)}>
                <Button title={t("pos.newSale")} onPress={() => { setQuickActions(false); navigation.navigate("sales"); router.dismissTo("/(tabs)/sales"); }} />
                <Button secondary title={t("business.addProduct")} onPress={() => { setQuickActions(false); router.push("/inventory/add-product"); }} />
                <Button secondary title={t("business.addCategory")} onPress={() => { setQuickActions(false); router.push("/inventory/categories"); }} />
                <Button secondary title={t("business.scan")} onPress={() => { setQuickActions(false); router.push("/(scanner)/scan"); }} />
            </InventorySheet>}
        </>

    );
}
