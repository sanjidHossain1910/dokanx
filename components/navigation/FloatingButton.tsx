import { Plus } from "lucide-react-native";
import React, { useEffect, useRef } from "react";
import { Animated, Pressable, View } from "react-native";

interface FloatingButtonProps {
    focused: boolean;
    onPress: () => void;
}

export default function FloatingButton({
    focused,
    onPress,
}: FloatingButtonProps) {

    const rotateAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(rotateAnim, {
            toValue: focused ? 1 : 0,
            duration: 250,
            useNativeDriver: true,
        }).start();
    }, [focused]);



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
                onPress={onPress}
                style={{
                    position: "absolute",
                    top: -34,
                    width: 62,
                    height: 62,
                    borderRadius: 31,
                    justifyContent: "center",
                    alignItems: "center",
                    backgroundColor: "#2563EB",
                    borderWidth: focused ? 3 : undefined,
                    borderColor: focused ? "#93C5FD" : undefined,
                }}
            >
                <Animated.View
                    style={{
                        transform: [{ rotate }],
                    }}
                >
                    <Plus
                        size={30}
                        color="#FFFFFF"
                        strokeWidth={2.5}
                    />
                </Animated.View>
            </Pressable>
        </View>
    );
}