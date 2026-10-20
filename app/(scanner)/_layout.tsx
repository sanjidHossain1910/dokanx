import { Stack } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";

export default function ScannerLayout() {
    const { colors } = useTheme();
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.background },
            }}
        />
    );
}
