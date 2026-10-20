import { Stack } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
export default function BusinessLayout() {
  const { colors } = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}
