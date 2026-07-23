import BottomSheet, {
    BottomSheetView,
} from "@gorhom/bottom-sheet";
import {
    Barcode,
    FolderPlus,
    PackagePlus,
    ShoppingCart,
} from "lucide-react-native";
import React, {
    forwardRef,
    useMemo,
} from "react";
import { Pressable, Text, View } from "react-native";

interface ActionBottomSheetProps {
    onScanPress: () => void;
}

const ActionBottomSheet = forwardRef<BottomSheet, ActionBottomSheetProps>(
    ({ onScanPress }, ref) => {


        const snapPoints = useMemo(() => ["40%"], []);





        const menus = [
            {
                title: "Add Product",
                icon: <PackagePlus size={22} color="#2563EB" />,
                onPress: () => console.log("Add Product"),
            },
            {
                title: "New Sale",
                icon: <ShoppingCart size={22} color="#2563EB" />,
                onPress: onScanPress,
            },
            {
                title: "Scan Barcode",
                icon: <Barcode size={22} color="#2563EB" />,
                onPress: onScanPress,
            },
            {
                title: "Add Category",
                icon: <FolderPlus size={22} color="#2563EB" />,
                onPress: () => { },
            },
        ];

        return (
            <BottomSheet
                ref={ref}
                index={-1}
                snapPoints={snapPoints}
                enablePanDownToClose
                backgroundStyle={{
                    backgroundColor: "#FFFFFF",
                    borderTopLeftRadius: 28,
                    borderTopRightRadius: 28,
                }}
                handleIndicatorStyle={{
                    backgroundColor: "#CBD5E1",
                    width: 55,
                }}
            >
                <BottomSheetView
                    style={{
                        flex: 1,
                        paddingHorizontal: 20,
                        paddingTop: 10,
                    }}
                >
                    <Text
                        style={{
                            fontSize: 22,
                            fontWeight: "700",
                            marginBottom: 18,
                            color: "#0F172A",
                        }}
                    >
                        Quick Actions
                    </Text>

                    {menus.map((item) => (
                        <Pressable
                            key={item.title}
                            onPress={item.onPress}
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                paddingVertical: 16,
                                borderBottomWidth: 1,
                                borderBottomColor: "#E2E8F0",
                            }}
                        >
                            <View
                                style={{
                                    width: 46,
                                    height: 46,
                                    borderRadius: 12,
                                    backgroundColor: "#EFF6FF",
                                    justifyContent: "center",
                                    alignItems: "center",
                                    marginRight: 14,
                                }}
                            >
                                {item.icon}
                            </View>

                            <Text
                                style={{
                                    fontSize: 16,
                                    fontWeight: "600",
                                    color: "#1E293B",
                                }}
                            >
                                {item.title}
                            </Text>
                        </Pressable>
                    ))}
                </BottomSheetView>
            </BottomSheet>
        );
    });

export default ActionBottomSheet;