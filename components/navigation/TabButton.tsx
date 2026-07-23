import React from "react";
import { Pressable, Text, View } from "react-native";
import {
    ChartColumn,
    House,
    Package,
    User,
} from "lucide-react-native";

interface TabButtonProps {
    routeName: string;
    label: string;
    focused: boolean;
    onPress: () => void;
}

export default function TabButton({
    routeName,
    label,
    focused,
    onPress,
}: TabButtonProps) {
    const color = focused ? "#2563EB" : "#9CA3AF";

    const renderIcon = () => {
        switch (routeName) {
            case "index":
                return <House size={22} color={color} />;

            case "packege":
                return <Package size={22} color={color} />;

            case "reports":
                return <ChartColumn size={22} color={color} />;

            case "profile":
                return <User size={22} color={color} />;

            default:
                return null;
        }
    };

    return (
        <Pressable
            onPress={onPress}
            style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
                height: "100%",
            }}
        >
            <View
                style={{
                    width: 24,
                    height: 3,
                    borderRadius: 2,
                    backgroundColor: focused ? "#2563EB" : "transparent",
                    marginBottom: 8,
                }}
            />

            {renderIcon()}

            <Text
                style={{
                    marginTop: 6,
                    fontSize: 11,
                    fontWeight: focused ? "700" : "500",
                    color,
                }}
            >
                {label}
            </Text>
        </Pressable>
    );
}