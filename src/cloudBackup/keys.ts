export const CLOUD_GENERATION_KEY = "@dokanx/cloud/local-generation/v1";
export const cloudGenerationKey = (workspace: string) =>
  `${CLOUD_GENERATION_KEY}/${workspace}`;
export const cloudSettingsKey = (
  userId: string,
  shopId: string,
  localShopId: string,
) => `@dokanx/cloud/backup/v1/${userId}:${shopId}:${localShopId}`;
export const manualBackupKey = (workspace: string) =>
  workspace === "offline"
    ? "@dokanx/last-backup/v1"
    : `@dokanx/last-backup/v1/${workspace}`;
