// app/(scanner)/scan.tsx

import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { ArrowLeft, Flashlight, FlashlightOff } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";




export default function Scan() {
    const [permission, requestPermission] = useCameraPermissions();
    const [torch, setTorch] = useState(false);
    if (!permission) {
        return (
            <View
                style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                }}
            >
                <ActivityIndicator size="large" />
            </View>
        );
    }

    if (!permission.granted) {
        return (
            <SafeAreaView
                style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                    padding: 24,
                }}
            >
                <Text
                    style={{
                        fontSize: 20,
                        fontWeight: "700",
                        marginBottom: 10,
                    }}
                >
                    Camera Permission Required
                </Text>

                <Text
                    style={{
                        textAlign: "center",
                        color: "#64748B",
                        marginBottom: 20,
                    }}
                >
                    Please allow camera permission to scan barcode.
                </Text>

                <Pressable
                    onPress={requestPermission}
                    style={{
                        backgroundColor: "#2563EB",
                        paddingHorizontal: 22,
                        paddingVertical: 12,
                        borderRadius: 10,
                    }}
                >
                    <Text
                        style={{
                            color: "#fff",
                            fontWeight: "700",
                        }}
                    >
                        Allow Camera
                    </Text>
                </Pressable>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1 }}>
            <CameraView
                style={{ flex: 1 }}
                facing="back"
                enableTorch={torch}
                onBarcodeScanned={({ data }) => {
                    router.replace({
                        pathname: "/(scanner)/product",
                        params: {
                            barcode: data,
                        },
                    });
                }}
            />

            {/* Close Button */}

            <Pressable
                onPress={() => router.back()}
                style={{
                    position: "absolute",
                    top: 60,
                    left: 20,
                    width: 46,
                    height: 46,
                    borderRadius: 23,
                    backgroundColor: "rgba(0,0,0,.5)",
                    justifyContent: "center",
                    alignItems: "center",
                }}
            >
                <ArrowLeft color="#fff" size={22} />
            </Pressable>

            {/* Scan Box */}

            <View
                style={{
                    position: "absolute",
                    top: "30%",
                    left: "12%",
                    width: "76%",
                    aspectRatio: 1.6,
                    borderWidth: 3,
                    borderColor: "#2563EB",
                    borderRadius: 18,
                }}
            />

            {/* Instruction */}

            <Text
                style={{
                    position: "absolute",
                    bottom: 120,
                    alignSelf: "center",
                    color: "#fff",
                    fontSize: 16,
                    fontWeight: "600",
                }}
            >
                Place the barcode inside the frame
            </Text>
            <Pressable
                onPress={() => setTorch((prev) => !prev)}
                style={{
                    position: "absolute",
                    top: 60,
                    right: 20,
                    width: 46,
                    height: 46,
                    borderRadius: 23,
                    backgroundColor: "rgba(0,0,0,0.5)",
                    justifyContent: "center",
                    alignItems: "center",
                }}
            >
                {torch ? (
                    <Flashlight size={22} color="#FFD700" />
                ) : (
                    <FlashlightOff size={22} color="#FFFFFF" />
                )}
            </Pressable>
        </SafeAreaView>
    );
}