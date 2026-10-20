import { useBusiness } from "@/src/store/BusinessProvider";
import { Redirect } from "expo-router";
export default function Index() {
  const { data } = useBusiness();
  return <Redirect href={data.shopActive === true ? "/(tabs)" : "/setup"} />;
}
