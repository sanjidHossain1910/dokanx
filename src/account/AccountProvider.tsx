import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { accountController } from "./native";
const Context = createContext(accountController);
export function AccountProvider({ children }: { children: ReactNode }) {
  // Account storage/network never gates app navigation or the offline repository.
  useEffect(() => { void accountController.load(); }, []);
  return <Context.Provider value={accountController}>{children}</Context.Provider>;
}
export function useAccount() {
  const controller = useContext(Context);
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot, controller.snapshot);
  return { controller, ...state };
}
