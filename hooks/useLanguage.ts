import { useCallback, useEffect, useState } from "react";
import { changeLanguage, i18n, LanguageCode } from "@/src/i18n";

const RTL_LANGUAGE_CODES = new Set(["ar", "fa", "he", "ur"]);

export function useLanguage() {
  const [currentLanguage, setCurrentLanguage] = useState<LanguageCode>(
    () => (i18n.resolvedLanguage as LanguageCode | undefined) ?? "en",
  );
  useEffect(() => {
    const onLanguageChanged = (language: string) => setCurrentLanguage(language as LanguageCode);
    i18n.on("languageChanged", onLanguageChanged);
    return () => i18n.off("languageChanged", onLanguageChanged);
  }, []);
  return {
    currentLanguage,
    changeLanguage: useCallback((languageCode: LanguageCode) => changeLanguage(languageCode), []),
    isRTL: RTL_LANGUAGE_CODES.has(currentLanguage),
  };
}
