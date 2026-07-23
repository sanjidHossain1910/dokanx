import CustomTabBar from "@/components/navigation/CustomTabBar";
import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
        }}
      />

      <Tabs.Screen
        name="packege"
        options={{
          title: "Products",
        }}
      />

      <Tabs.Screen
        name="sales"
        options={{
          title: "Sales",
        }}
      />

      <Tabs.Screen
        name="reports"
        options={{
          title: "Reports",
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
        }}
      />
    </Tabs>
  );
}