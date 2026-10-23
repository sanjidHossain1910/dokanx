import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useAccount } from "@/src/account/AccountProvider";
import type { OtpChallenge } from "@/src/account/controller";
import { useBusiness } from "@/src/store/BusinessProvider";
import { Button, Field, Screen, useUi } from "../business/Screen";

const digits = (value: string) => value.replace(/[০-৯٠-٩]/g, (c) => String(c.charCodeAt(0) - (c >= "০" && c <= "৯" ? 0x9e6 : 0x660)));
export default function Account() {
  const account = useAccount(); const { data } = useBusiness(); const { t, i18n } = useTranslation(); const ui = useUi();
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<"login" | "signup">(() => params.mode === "signup" ? "signup" : "login");
  const [phone, setPhone] = useState(""); const [code, setCode] = useState(""); const [challenge, setChallenge] = useState<OtpChallenge>(); const [issue, setIssue] = useState(""); const [notice, setNotice] = useState(""); const [retryAt, setRetryAt] = useState(0); const [now, setNow] = useState(() => Date.now());
  useEffect(() => { if (!challenge) return; const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, [challenge]);
  const offline = () => router.replace(data.shopActive ? "/(tabs)" : "/setup/basic");
  const run = async (work: () => Promise<void>) => { setIssue(""); setNotice(""); try { await work(); } catch (e) { setIssue(e instanceof Error ? e.message : "failed"); } };
  const send = () => void run(async () => { const next = await account.controller.requestCode(digits(phone), mode); setChallenge(next); setCode(""); setNow(Date.now()); setRetryAt(Date.now() + next.retryAfterSeconds * 1000); });
  const verify = () => void run(async () => { if (challenge) { await account.controller.verify(challenge.challengeId, code, mode); setChallenge(undefined); setCode(""); router.replace("/account-sync"); } });
  const changeMode = (next: "login" | "signup") => { setMode(next); setChallenge(undefined); setCode(""); setIssue(""); setNotice(""); };
  const disabled = account.busy || !account.ready;
  const remaining = Math.max(0, Math.ceil((retryAt - now) / 1000));
  return <Screen back title={t("account.title")} fallbackHref={data.shopActive ? "/(tabs)/profile" : "/setup"}>
    <View style={ui.card}><Text style={ui.subtitle}>{t("account.offline")}</Text><Text style={ui.text}>{t("account.offlineHint")}</Text><Button secondary title={t("account.offline")} onPress={offline} /></View>
    {account.storageError && <Text style={ui.error}>{t("account.storage")}</Text>}
    {account.session ? <View style={ui.card}>
      <Text style={ui.subtitle}>{t("account.connected")}</Text><Text selectable style={ui.text}>{account.session.user.phone}</Text><Text style={ui.text}>{t("account.savedHint")}</Text>
      <Button title={t('accountSync.button')} disabled={disabled} onPress={()=>router.push('/account-sync')}/>
      {data.shopActive && data.shopId ? <>{account.session.binding?.localShopId === data.shopId ? <Text style={ui.subtitle}>{t("account.linked")} · {account.session.binding.name}</Text> : <>{account.session.binding && <Text style={ui.text}>{t("account.wrongBinding")}</Text>}<Text style={ui.text}>{data.shopName}</Text><Text style={ui.text}>{t("account.linkHint")}</Text><Button title={t("account.link")} disabled={disabled} onPress={() => void run(() => account.controller.linkShop(data.shopId!, data.shopName))} /></>}</> : <Button title={t("account.setup")} onPress={offline} />}
      {data.shopActive && account.session.binding?.localShopId === data.shopId && <Button title={t("cloudBackup.title")} onPress={() => router.push("/settings/cloud-backup")} />}
      <Button secondary title={t("account.check")} disabled={disabled} onPress={() => void run(() => account.controller.refreshProfile())} />
      <Text style={ui.text}>{t("account.logoutHint")}</Text><Button secondary title={t("account.logout")} disabled={disabled} onPress={() => Alert.alert(t("account.logout"), t("account.logoutHint"), [{ text: t("buttons.cancel"), style: "cancel" }, { text: t("account.logout"), onPress: () => void run(async () => { const result = await account.controller.logout(); setChallenge(undefined); if (!result.revoked) setNotice("localLogout"); }) }])} />
    </View> : <View style={ui.card}>
      <View style={{ flexDirection: "row", gap: 8 }}>{(["login", "signup"] as const).map((item) => <View key={item} style={{ flex: 1 }}><Button title={`${mode === item ? "✓ " : ""}${t(`account.${item}`)}`} secondary={mode !== item} disabled={disabled} onPress={() => changeMode(item)} /></View>)}</View>
      <Text style={ui.subtitle}>{t(`account.${mode}Title`)}</Text><Text style={ui.text}>{t(`account.${mode}Hint`)}</Text>
      {!challenge ? <><Field label={t("account.phone")} placeholder={t("account.phoneHint")} keyboardType="phone-pad" autoComplete="tel" value={phone} onChangeText={setPhone} editable={!disabled} /><Button title={t(account.busy ? "account.loading" : "account.send")} disabled={disabled || !phone.trim()} onPress={send} /></> : <>
        <Text style={ui.text}>{t("account.sent", { phone: challenge.phone })}</Text>
        {__DEV__ && challenge.delivery === "development" && challenge.developmentCode && <Text selectable style={ui.subtitle}>{t("account.development", { code: challenge.developmentCode })}</Text>}
        <Field label={t("account.code")} keyboardType="number-pad" autoComplete="sms-otp" textContentType="oneTimeCode" maxLength={6} value={code} onChangeText={(s) => setCode(digits(s).replace(/\D/g, "").slice(0, 6))} editable={!disabled} />
        <Button title={t(account.busy ? "account.loading" : mode === "signup" ? "account.verifySignup" : "account.verifyLogin")} disabled={disabled || code.length !== 6} onPress={verify} />
        <Button secondary title={remaining ? t("account.retryIn", { seconds: remaining }) : t("account.resend")} disabled={disabled || remaining > 0} onPress={send} />
        <Button secondary title={t("account.changePhone")} disabled={disabled} onPress={() => { setChallenge(undefined); setCode(""); setIssue(""); }} />
      </>}
    </View>}
    {issue && <Text accessibilityLiveRegion="polite" style={ui.error}>{t(`account.errors.${i18n.exists(`account.errors.${issue}`) ? issue : "failed"}`)}</Text>}
    {!account.session && <Button secondary title={t(mode === "login" ? "account.noAccount" : "account.haveAccount")} disabled={disabled} onPress={() => changeMode(mode === "login" ? "signup" : "login")} />}
    {notice && <Text accessibilityLiveRegion="polite" style={ui.text}>{t(`account.${notice}`)}</Text>}
  </Screen>;
}
