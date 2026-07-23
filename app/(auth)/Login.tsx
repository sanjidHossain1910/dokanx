import Checkbox from "@/components/ui/Checkbox";
import Header from "@/components/ui/Header";
import Input from "@/components/ui/Input";
import { router } from "expo-router";
import { KeyIcon, PhoneCall } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { SafeAreaView } from "react-native-safe-area-context";
const Login = () => {
  const { t } = useTranslation();
  const [isRememberMe, setIsRememberMe] = useState(false)

  return (
    <SafeAreaView className="flex-1 bg-white">
      <Header />

      <KeyboardAwareScrollView
        enableOnAndroid
        extraScrollHeight={40}
        extraHeight={120}
        keyboardOpeningTime={0}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 24,
          paddingTop: 20,
          paddingBottom: 40,
        }}>

        <View className="mt-15">
          <Text className="text-[32px] font-bold text-[#0F172A]">
            {t("auth.login_title")}
          </Text>
          <Text className="text-[16px] font-normal text-[#64748B]">
            {t("auth.login_subtitle")}
          </Text>
        </View>



        <View
          className="mt-10 w-full box-border border-[#e2e8f0ae] shadow rounded-lg p-4 self-center">
          <Text className="text-[30px] font-bold text-center mb-2">
            {t("auth.login")}
          </Text>

          <View className="mt-4 w-full">

            <View>
              <Input title={t("auth.phone_number")} placeholder={t("auth.phone_number_placeholder")} numericOnly={true} leftIcon={<PhoneCall color="#64748B" size={20} />} />
              <Input title={t("auth.password")} placeholder={t("auth.password_paceholder")} secure={true} leftIcon={<KeyIcon color="#64748B" size={20} />} />
            </View>

            <View className="flex-row justify-between items-center mt-2">

              <Checkbox checked={isRememberMe} onChange={setIsRememberMe} label={t("auth.remember_me")} />
              <Text className="text-blue-600 font-medium text-base">
                Forgot Password
              </Text>

            </View>

            <Pressable
              onPressIn={() => router.replace("/(tabs)")}
              android_ripple={{ color: "#ffffff55" }}
              onPress={() => { }}
              style={({ pressed }) => ({
                opacity: pressed ? 0.9 : 1,
              })}
              className="bg-blue-600 rounded-xl py-4 items-center mt-2"
            >
              <Text className="text-white text-center font-semibold">
                {t("auth.login")}
              </Text>
            </Pressable>

          </View>
        </View>
        <View className="flex-row gap-2 mt-4 items-center justify-center">
          <Text className="text-[#64748B] text-base font-semibold">
            {"Don't have an account?"}
          </Text>
          <Text
            onPress={() => router.push("/(auth)/Signup")}
            className="text-base font-semibold text-blue-500">
            Create account
          </Text>
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView >
  );
};

export default Login; 