import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useBusiness } from "../store/BusinessProvider";
import { useAccount } from "../account/AccountProvider";
import { createNativeIncremental } from "./nativeIncremental";
import {
  CLOUD_GENERATION_KEY,
  cloudGenerationKey,
  cloudSettingsKey,
} from "./keys";

const Context = createContext<ReturnType<
  typeof createNativeIncremental
> | null>(null);
export default function CloudBackupProvider({
  children,
}: {
  children: ReactNode;
}) {
  const business = useBusiness(),
    account = useAccount();
  const latest = useRef({ business, account });
  const binding = account.session?.binding;
  const key =
    business.ready &&
    account.ready &&
    !account.session?.needsSync &&
    business.workspace === `account:${account.session?.user.id}` &&
    business.data.shopActive &&
    binding &&
    binding.localShopId === business.data.shopId
      ? `${account.session!.user.id}:${binding.id}:${business.data.shopId}`
      : undefined;
  const contextKey = key
    ? `${key}:restore-${business.restoreEpoch}`
    : undefined;
  const currentKey = useRef(contextKey);
  useLayoutEffect(() => {
    latest.current = { business, account };
    currentKey.current = contextKey;
    return () => {
      currentKey.current = undefined;
    };
  }, [business, account, contextKey]);
  const controller = useMemo(() => {
    if (!key || !binding) return null;
    const prefix = `/backups/${binding.id}`,
      storageKey = cloudSettingsKey(
        account.session!.user.id,
        binding.id,
        binding.localShopId,
      );
    // These callbacks read refs only when scheduled work runs, never during construction/render.
    // eslint-disable-next-line react-hooks/refs
    return createNativeIncremental({
      storageKey,
      outbox:()=>latest.current.business.syncOutbox(),
      current: () => currentKey.current === contextKey,
      capture: () => latest.current.business.data,
      resolve: input => latest.current.business.resolveConflict(input),
      apply: (data,expected) => latest.current.business.applySync(data,expected),
      generation: async () =>
        (await AsyncStorage.getItem(cloudGenerationKey(latest.current.business.workspace))) ??
        (await AsyncStorage.getItem(CLOUD_GENERATION_KEY)) ?? "initial",
      request: (path, options) => account.controller.cloudRequest(`${prefix}${path}`, options),
    });
    // Bind settings and pending work to the account + linked local shop, never to phone business data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextKey]);
  useEffect(() => {
    if (!controller) return;
    // Read durable review counts even when automatic sync is disabled or offline.
    void Promise.all([controller.load(), controller.refreshQueue().catch(() => {})]).then(() => controller.check());
    const timer = setInterval(() => {
      if (AppState.currentState === "active") void controller.check();
    }, 30000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void controller.check();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [controller]);
  return <Context.Provider value={controller}>{children}</Context.Provider>;
}
const unavailable = {
  intervalMinutes: 10,
  ready: true,
  busy: false,
  enabled: false,
  error: "",
  pending: true,
  versions: [],
  canUpload: true,
  autoRestore: false, uploaded:0, downloaded:0,
  queueCounts:{pending:0,processing:0,conflict:0},
  failureStage:undefined as string|undefined,
};
export function useCloudBackup() {
  const controller = useContext(Context);
  const state = useSyncExternalStore(
    controller?.subscribe ?? (() => () => {}),
    controller?.snapshot ?? (() => unavailable),
    controller?.snapshot ?? (() => unavailable),
  );
  return { controller, ...state };
}
