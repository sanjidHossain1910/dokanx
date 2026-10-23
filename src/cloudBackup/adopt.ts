import AsyncStorage from "@react-native-async-storage/async-storage";
import type { BusinessData } from "../store/business";
import type { CloudVersion } from "./controller";
import type { CloudShop } from "./sync";
import {
  cloudGenerationKey,
  cloudSettingsKey,
  CLOUD_GENERATION_KEY,
} from "./keys";
import { cloudSnapshotSignature } from "./signature";
export async function adoptCloudSnapshot(
  userId: string,
  shop: CloudShop,
  data: BusinessData,
  version?: CloudVersion,
) {
  if (data.shopId !== shop.localShopId) throw new Error("invalidBackup");
  const generation =
    (await AsyncStorage.getItem(cloudGenerationKey(`account:${userId}`))) ??
    (await AsyncStorage.getItem(CLOUD_GENERATION_KEY)) ??
    "initial";
  const signature = await cloudSnapshotSignature(data);
  if (
    version &&
    (!version.completedAt || !Number.isFinite(Date.parse(version.completedAt)))
  )
    throw new Error("invalidBackup");
  await AsyncStorage.setItem(
    cloudSettingsKey(userId, shop.id, shop.localShopId),
    JSON.stringify({
      enabled: true,
      generation,
      checkedAt: version ? Date.now() : 0,
      ...(version
        ? { checkpoint: { id: version.id, signature, at: version.completedAt } }
        : {}),
    }),
  );
}
