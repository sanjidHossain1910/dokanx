import { useBusiness } from "@/src/store/BusinessProvider";
import { Redirect } from "expo-router";
import { useAccount } from '@/src/account/AccountProvider';
export default function Index() {
  const { data } = useBusiness();
  const account=useAccount();
  if(account.session && (account.session.needsSync || !data.shopActive))return <Redirect href='/account-sync'/>;
  return <Redirect href={data.shopActive === true ? "/(tabs)" : "/setup"} />;
}
