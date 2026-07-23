import BottomSheet from "@gorhom/bottom-sheet";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { router } from "expo-router";
import React, { useRef } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ActionBottomSheet from "../bottomSheet/ActionBottomSheet";
import FloatingButton from "./FloatingButton";
import TabButton from "./TabButton";

export default function CustomTabBar({
    state,
    descriptors,
    navigation,
}: BottomTabBarProps) {
    const insets = useSafeAreaInsets();
    const bottomSheetRef = useRef<BottomSheet>(null);
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

                    backgroundColor: "#1F2937",

                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",

                    paddingHorizontal: 12,

                    borderWidth: 1,
                    borderColor: "#374151",

                    shadowColor: "#000",
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
                                onPress={() => bottomSheetRef.current?.expand()}
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
            <ActionBottomSheet
                ref={bottomSheetRef}
                onScanPress={() => {
                    bottomSheetRef.current?.close();

                    setTimeout(() => {
                        router.push("/(scanner)/scan");
                    }, 300);
                }}
            />
        </>

    );
}