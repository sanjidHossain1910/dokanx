import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocales } from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import bn from "./resources/bn";
import en from "./resources/en";

export const LANGUAGE_STORAGE_KEY = "@dokanx/language";
export const supportedLanguageCodes = ["en", "bn"] as const;
export type LanguageCode = (typeof supportedLanguageCodes)[number];
export const languages: Record<LanguageCode, { label: string; flag: string }> = {
  en: { label: "English", flag: "🇺🇸" },
  bn: { label: "বাংলা", flag: "🇧🇩" },
};

const isSupportedLanguage = (value: string | null): value is LanguageCode =>
  value !== null && supportedLanguageCodes.includes(value as LanguageCode);

const getDeviceLanguage = (): LanguageCode => {
  const locale = getLocales().find(({ languageCode }) => isSupportedLanguage(languageCode));
  const languageCode = locale?.languageCode ?? null;
  return isSupportedLanguage(languageCode) ? languageCode : "en";
};

let initializationPromise: Promise<typeof i18n> | undefined;

export function initializeI18n(): Promise<typeof i18n> {
  if (initializationPromise) return initializationPromise;
  initializationPromise = (async () => {
    const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY).catch(() => null);
    const language = isSupportedLanguage(savedLanguage) ? savedLanguage : getDeviceLanguage();
    // i18next's default instance intentionally exposes these instance methods.
    // eslint-disable-next-line import/no-named-as-default-member
    await i18n.use(initReactI18next).init({
      compatibilityJSON: "v4",
      resources: { en: { translation: en }, bn: { translation: bn } },
      lng: language,
      fallbackLng: "en",
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
    });
    return i18n;
  })().catch((error) => {
    initializationPromise = undefined;
    throw error;
  });
  return initializationPromise;
}

export async function changeLanguage(languageCode: LanguageCode): Promise<void> {
  // eslint-disable-next-line import/no-named-as-default-member
  await i18n.changeLanguage(languageCode);
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, languageCode);
}

export { i18n };
