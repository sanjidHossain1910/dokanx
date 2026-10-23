import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import type { BusinessData } from "../store/business";
export async function cloudSnapshotSignature(source: BusinessData) {
  const { notificationReadSignature: _read, ...data } = source;
  const [language, theme] = await Promise.all([
    AsyncStorage.getItem("@dokanx/language"),
    AsyncStorage.getItem("@dokanx/theme"),
  ]);
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    JSON.stringify({ data, language, theme }),
  );
}
