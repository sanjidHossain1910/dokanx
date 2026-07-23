import React from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

const Signup = () => {
  const { t } = useTranslation();

  return (
    <View>
      <Text>{t("auth.signup")}</Text>
    </View>
  );
};

export default Signup;
