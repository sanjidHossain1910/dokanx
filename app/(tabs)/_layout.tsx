import CustomTabBar from "@/components/navigation/CustomTabBar";
import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/src/theme/ThemeProvider";

export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("business.home"),
        }}
      />

      <Tabs.Screen
        name="packege"
        options={{
          title: t("business.products"),
        }}
      />

      <Tabs.Screen
        name="sales"
        options={{
          title: t("business.sales"),
        }}
      />

      <Tabs.Screen
        name="reports"
        options={{
          title: t("business.reports"),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: t("business.profile"),
        }}
      />
    </Tabs>
  );
}
