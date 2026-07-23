import Welcome from "@/components/welcomeScreen/Welcome";
import { Redirect } from "expo-router";

export default function Index() {
  const isLogin = true;

  if (isLogin) {
    return <Redirect href="/(tabs)" />
  }



  return <Welcome />;
}