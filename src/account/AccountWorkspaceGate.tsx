import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useAccount } from "./AccountProvider";
import { useBusiness } from "../store/BusinessProvider";
import { useTheme } from "../theme/ThemeProvider";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/business/Screen";
export default function AccountWorkspaceGate({
  children,
}: {
  children: ReactNode;
}) {
  const account = useAccount(),
    business = useBusiness(),
    { colors } = useTheme();
  const [error, setError] = useState(false);
  const { t } = useTranslation();
  const { ready, workspace, selectWorkspace } = business;
  const target = account.session
    ? `account:${account.session.user.id}`
    : "offline";
  const switching =
    !account.ready || !business.ready || business.workspace !== target;
  useEffect(() => {
    if (!account.ready || workspace === target) return;
    let active = true;
    void selectWorkspace(target).catch(() => {
      if (active) setError(true);
    });
    return () => {
      active = false;
    };
  }, [account.ready, ready, workspace, selectWorkspace, target]);
  return (
    <View style={{ flex: 1 }}>
      <View
        style={{ flex: 1 }}
        importantForAccessibility={switching ? "no-hide-descendants" : "auto"}
      >
        {children}
      </View>
      {switching && (
        <View
          accessibilityViewIsModal
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: colors.background,
            justifyContent: "center",
            alignItems: "center",
            padding: 24,
            gap: 12,
          }}
        >
          {error || business.error ? (
            <>
              <Text style={{ color: colors.text }}>
                {t("business.storageUnavailable")}
              </Text>
              <Button
                title={t("business.retry")}
                onPress={() => {
                  if (business.error) business.retry();
                  else
                    void selectWorkspace(target)
                      .then(() => setError(false))
                      .catch(() => setError(true));
                }}
              />
            </>
          ) : (
            <ActivityIndicator color={colors.primary} />
          )}
        </View>
      )}
    </View>
  );
}
