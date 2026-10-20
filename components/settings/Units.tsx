import { Screen, useUi } from "@/components/business/Screen";
import { PRODUCT_UNITS, UNIT_GROUPS } from "@/src/store/productUnits";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
export default function Units() {
  const { t, i18n } = useTranslation(); const ui = useUi(); const language = i18n.language.startsWith("bn") ? "bn" : "en";
  return <Screen back title={t("profileSettings.units")} fallbackHref="/settings"><Text style={ui.text}>{t("profileSettings.unitInfo")}</Text>{UNIT_GROUPS.map((group) => <View style={ui.card} key={group.id}><Text style={ui.subtitle}>{group[language]}</Text><Text style={ui.text}>{PRODUCT_UNITS.filter((unit) => unit.group === group.id).map((unit) => unit[language]).join(" · ")}</Text></View>)}</Screen>;
}
