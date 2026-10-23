import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { responsiveLayout } from "@/src/layout/responsive";

export function useResponsiveLayout() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const availableWidth = width - insets.left - insets.right;
  return { ...responsiveLayout(availableWidth), availableWidth };
}
