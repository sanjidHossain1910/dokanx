import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { fetch as expoFetch } from "expo/fetch";
import { File } from "expo-file-system";
import { createAccountController, type AccountRequest } from "./controller";

export function accountApiUrl() {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();
  let value = configured;
  if (!value && __DEV__ && Constants.expoConfig?.hostUri) {
    try { value = `http://${new URL(`http://${Constants.expoConfig.hostUri}`).hostname}:3000/api/v1`; } catch {}
  }
  if (!value) throw new Error("serverNotConfigured");
  try { const parsed = new URL(value); if (parsed.username || parsed.password || parsed.search || parsed.hash || !["https:", ...(__DEV__ ? ["http:"] : [])].includes(parsed.protocol)) throw new Error(); }
  catch { throw new Error("serverNotConfigured"); }
  return value.replace(/\/+$/, "");
}
const api = {
  async request(path: string, options: AccountRequest & { token?: string } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.fileUri || options.saveTo ? 120000 : 10000);
    try {
      let uploadBytes: Uint8Array<ArrayBuffer> | undefined;
      if (options.fileUri) {
        const file = new File(options.fileUri);
        if (!file.exists) throw new Error("backupTempMissing");
        if (file.size < 1 || file.size > 60_000_000) throw new Error("invalidBackup");
        // Expo's Blob/File normalizer replaces Content-Type with file.type. A custom
        // .dokanx extension has no Android MIME type, so send bytes to retain our header.
        uploadBytes = new Uint8Array(await file.bytes());
        if (!uploadBytes.length || uploadBytes.length > 60_000_000) throw new Error("invalidBackup");
      }
      const response = await expoFetch(`${accountApiUrl()}${path}`, { method: options.fileUri || options.body !== undefined ? "POST" : "GET", signal: controller.signal, headers: { Accept: options.saveTo ? "application/octet-stream" : "application/json", ...options.headers, ...(options.fileUri ? { "Content-Type": "application/octet-stream" } : options.body !== undefined ? { "Content-Type": "application/json" } : {}), ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}) }, ...(uploadBytes ? { body: uploadBytes } : options.body !== undefined ? { body: JSON.stringify(options.body) } : {}) });
      if (response.ok && options.saveTo) {
        const reader = response.body?.getReader(); if (!reader) throw new Error("invalidBackup");
        const expected=options.expectedBytes ?? Number(response.headers.get('content-length'));
        if(!Number.isSafeInteger(expected) || expected<1 || expected>60_000_000) {await reader.cancel();throw new Error('invalidBackup');}
        options.onProgress?.(0,expected);
        const chunks: Uint8Array[] = []; let total = 0;
        while (true) { const part = await reader.read(); if (part.done) break; total += part.value.length; if (total > expected || total > 60_000_000) { await reader.cancel(); throw new Error("invalidBackup"); } chunks.push(part.value);options.onProgress?.(total,expected); }
        if(total!==expected)throw new Error('invalidBackup');
        const bytes = new Uint8Array(total); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
        new File(options.saveTo).write(bytes); return { uri: options.saveTo };
      }
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) { const code = (result as { code?: unknown } | null)?.code; throw new Error(response.status === 415 && options.fileUri ? "backupUploadType" : response.status === 413 && options.fileUri ? "invalidBackup" : typeof code === "string" ? code : response.status === 401 ? "unauthorized" : response.status === 429 ? "rateLimited" : response.status >= 500 ? "serverUnavailable" : "invalidInput"); }
      return result;
    } catch (error) {
      const message=error && typeof error==='object' && 'message' in error ? String(error.message) : '';
      if (error instanceof TypeError || controller.signal.aborted || /fetch failed|network request failed|ConnectException|ECONNREFUSED|ENETUNREACH|ETIMEDOUT/i.test(message)) throw new Error("networkUnavailable");
      throw error;
    }
    finally { clearTimeout(timer); }
  },
};
const KEY = "dokanx.cloud.account.v1", DEVICE_KEY = "dokanx.cloud.installation.v1";
const storageOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
export const accountController = createAccountController({
  api,
  read: () => SecureStore.getItemAsync(KEY),
  write: (value) => value === null ? SecureStore.deleteItemAsync(KEY) : SecureStore.setItemAsync(KEY, value, storageOptions),
  async device() { const previous = await SecureStore.getItemAsync(DEVICE_KEY); if (previous && /^[0-9a-f-]{36}$/i.test(previous)) return previous; const id = Crypto.randomUUID(); await SecureStore.setItemAsync(DEVICE_KEY, id, storageOptions); return id; },
  deviceName: Platform.OS === "ios" ? "iPhone" : "Android phone",
});
