import { Button, Field, Screen, useUi } from "@/components/business/Screen";
import { useBusiness } from "@/src/store/BusinessProvider";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text } from "react-native";

export default function Categories() {
  const ui = useUi();
  const { data, update } = useBusiness();
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const save = async () => {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      await update((current) => {
        const clean = name.trim();
        if (!clean || current.categories.some((item) => item.toLowerCase() === clean.toLowerCase())) throw new Error("invalidCategory");
        return { ...current, categories: [...current.categories, clean] };
      });
      setName("");
    } catch (cause) { setError(cause instanceof Error && cause.message === "invalidCategory" ? "invalidCategory" : "saveFailed"); }
    finally { saving.current = false; setBusy(false); }
  };
  return <Screen title={t("business.addCategory")} back><Field label={t("business.category")} value={name} onChangeText={setName} /><Button title={t("business.save")} disabled={busy} onPress={() => void save()} />{!!error && <Text style={ui.error}>{t(`business.${error}`)}</Text>}{data.categories.map((item) => <Text key={item} style={ui.card}>{item}</Text>)}{!data.categories.length && <Text style={ui.text}>{t("business.emptyCategories")}</Text>}</Screen>;
}
