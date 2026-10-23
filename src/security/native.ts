import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";
import * as Crypto from "expo-crypto";
import { i18n } from "../i18n";
import { createSecurityController } from "./controller";
import { createDevicePinService } from "./devicePin";

const KEY = "dokanx.security.v1";
const options = { keychainService: "dokanx.security", keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const devicePin = createDevicePinService({
  read: () => SecureStore.getItemAsync("dokanx.security.pin-key.v1", options),
  write: (key) => SecureStore.setItemAsync("dokanx.security.pin-key.v1", key, options),
  random: (size) => Crypto.getRandomValues(new Uint8Array(size)),
});
export const securityController = createSecurityController({
  ...devicePin,
  read: async () => { if (!await SecureStore.isAvailableAsync()) throw new Error("securityStorage"); return SecureStore.getItemAsync(KEY, options); },
  write: (value) => SecureStore.setItemAsync(KEY, value, options),
  random: (size) => Crypto.getRandomBytes(size),
  phone: async (purpose) => {
    const enrolled = await LocalAuthentication.getEnrolledLevelAsync();
    if (enrolled < LocalAuthentication.SecurityLevel.SECRET) throw new Error("phoneLockRequired");
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: i18n.t(`security.phonePrompt.${purpose}`), promptDescription: i18n.t("security.phoneDescription"), disableDeviceFallback: false, biometricsSecurityLevel: "weak", requireConfirmation: true, fallbackLabel: i18n.t("security.useScreenLock"), cancelLabel: i18n.t("buttons.cancel") });
    if (!result.success) throw new Error(["user_cancel", "app_cancel", "system_cancel", "user_fallback"].includes(result.error) ? "authenticationCancelled" : "phoneAuthenticationFailed");
  },
});
