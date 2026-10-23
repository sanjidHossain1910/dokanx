import {
  formatConflictNumber,
  formatConflictStructure,
  settlementPresence,
} from "@/src/cloudBackup/conflictPresentation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useCloudBackup } from "@/src/cloudBackup/CloudBackupProvider";
import {
  entryKeys,
  paymentMerge,
  type ConflictChoice,
  type PaymentMergePreview,
  fieldDifferences,
  type ConflictGroup,
  type ConflictReview as Review,
} from "@/src/cloudBackup/conflicts";
import { useBusiness } from "@/src/store/BusinessProvider";
import { createBackup } from "@/src/store/backup";
import { manualBackupKey } from "@/src/cloudBackup/keys";
import { formatMoney } from "@/src/dashboard/format";
import { formatBusinessDate } from "@/src/store/businessSettings";
import { Button, Screen, useUi } from "../business/Screen";
import { useTheme } from "@/src/theme/ThemeProvider";

export default function ConflictReviewScreen() {
  const { controller } = useCloudBackup(),
    { data, workspace } = useBusiness(),
    { t, i18n } = useTranslation(),
    ui = useUi(),
    { colors } = useTheme();
  const [review, setReview] = useState<Review>(),
    [busy, setBusy] = useState(true),
    [issue, setIssue] = useState(""),
    [notice, setNotice] = useState("");
  const mergePreviews = useMemo(
    () =>
      new Map(
        review?.groups.map((group) => [
          group.id,
          paymentMerge(review, group),
        ]) ?? [],
      ),
    [review],
  );
  const errorText = useCallback(
    (error: unknown) =>
      t(
        error instanceof Error &&
          ["conflictReviewStale", "restoreStale"].includes(error.message)
          ? "conflicts.stale"
          : error instanceof Error && error.message === "conflictTooLarge"
            ? "conflicts.tooLarge"
            : "conflicts.error",
      ),
    [t],
  );
  const load = async () => {
    if (!controller) return;
    setBusy(true);
    setIssue("");
    try {
      setReview(await controller.reviewConflicts());
    } catch (error) {
      setIssue(errorText(error));
      setReview(undefined);
    } finally {
      setBusy(false);
    }
  };
  // A new account/shop controller requires a fresh, scoped review.
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const result = await controller?.reviewConflicts();
        if (active) {
          setReview(result);
          setIssue("");
        }
      } catch (error) {
        if (active) {
          setReview(undefined);
          setIssue(errorText(error));
        }
      } finally {
        if (active) setBusy(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [controller, errorText]);
  const choiceTitle = (group: ConflictGroup, choice: ConflictChoice) => {
    const preview = mergePreviews.get(group.id),
      party =
        preview?.available && preview.parties.length === 1
          ? preview.parties[0]
          : undefined;
    if (party)
      return t(`conflicts.choice.${choice}`, {
        amount: formatMoney(
          choice === "local"
            ? party.localDue
            : choice === "cloud"
              ? party.cloudDue
              : party.remaining,
          i18n.language,
        ),
      });
    return t(
      choice === "merge"
        ? "conflicts.keepBoth"
        : choice === "local"
          ? "conflicts.keepLocal"
          : "conflicts.keepCloud",
    );
  };
  const decide = (group: ConflictGroup, choice: ConflictChoice) => {
    if (!controller || !review || busy) return;
    Alert.alert(
      t("conflicts.confirm"),
      t(
        choice === "merge"
          ? "conflicts.confirmMerge"
          : choice === "local"
            ? mergePreviews.get(group.id)?.applicable
              ? "conflicts.confirmLocalPayments"
              : "conflicts.confirmLocal"
            : "conflicts.confirmCloud",
      ) +
        "\n\n" +
        t("conflicts.safety"),
      [
        { text: t("buttons.cancel"), style: "cancel" },
        {
          text: choiceTitle(group, choice),
          onPress: () => {
            void (async () => {
              setBusy(true);
              setIssue("");
              setNotice("");
              try {
                await controller.resolveConflict(
                  review,
                  group.id,
                  choice,
                  (source) =>
                    createBackup(source, {
                      metadataKey: manualBackupKey(workspace),
                    }),
                );
                setNotice(t("conflicts.saved"));
                setReview(await controller.reviewConflicts());
              } catch (error) {
                setIssue(errorText(error));
                setReview(undefined);
              } finally {
                setBusy(false);
              }
            })();
          },
        },
      ],
    );
  };
  const date = (value?: string) =>
    value
      ? formatBusinessDate(value, i18n.language, data.businessSettings)
      : "";
  const valueView = (
    value: unknown,
    path: string,
    side?: string,
    recordKey = "",
  ) => {
    if (
      typeof value === "string" &&
      /^asset:\/\/assets\/[a-f0-9]{64}$/.test(value)
    ) {
      const imageUri = review?.images?.[value];
      return imageUri ? (
        <Image
          accessibilityLabel={t("conflicts.photo")}
          source={{ uri: imageUri }}
          style={{
            width: 88,
            height: 88,
            borderRadius: 8,
            backgroundColor: colors.elevated,
          }}
        />
      ) : (
        <Text style={ui.subtitle}>{t("conflicts.photo")}</Text>
      );
    }
    if (Array.isArray(value) && path.split(".").at(-1) === "allocations") {
      return (
        <View style={{ gap: 8 }}>
          {value.map((allocation, index) => {
            const row = allocation as { invoiceId?: string; amount?: number };
            const invoiceKey = `${recordKey.startsWith("supplierPayments/") ? "purchaseInvoices" : "invoices"}/${encodeURIComponent(row.invoiceId ?? "")}`;
            const invoice = (review?.local[invoiceKey] ??
              review?.server.records[invoiceKey]) as
              { invoiceNumber?: string } | undefined;
            return (
              <View key={`${row.invoiceId}-${index}`} style={{ gap: 2 }}>
                <Text style={ui.text}>
                  {t("conflicts.bill")}
                  {invoice?.invoiceNumber ? ` · ${invoice.invoiceNumber}` : ""}
                </Text>
                <Text style={ui.subtitle}>
                  {typeof row.amount === "number"
                    ? formatMoney(row.amount, i18n.language)
                    : t("conflicts.missing")}
                </Text>
              </View>
            );
          })}
        </View>
      );
    }
    let text: string;
    if (value === null || value === undefined) text = t("conflicts.missing");
    else if (typeof value === "boolean")
      text = t(value ? "conflicts.yes" : "conflicts.no");
    else if (typeof value === "number")
      text = formatConflictNumber(value, path, i18n.language, recordKey);
    else if (typeof value === "object")
      text = JSON.stringify(
        formatConflictStructure(value, path, i18n.language, recordKey),
        null,
        2,
      );
    else text = String(value);
    return (
      <Text
        selectable
        accessibilityLabel={side ? `${side}: ${text}` : undefined}
        style={ui.subtitle}
      >
        {text}
      </Text>
    );
  };
  return (
    <Screen back title={t("conflicts.title")}>
      <Text style={ui.text}>{t("conflicts.intro")}</Text>
      <Button
        secondary
        title={t("conflicts.refresh")}
        disabled={busy || !controller}
        onPress={() => void load()}
      />
      {busy && <ActivityIndicator color={colors.primary} />}
      {!!issue && (
        <Text accessibilityRole="alert" style={ui.error}>
          {issue}
        </Text>
      )}
      {!!notice && (
        <Text accessibilityLiveRegion="polite" style={ui.text}>
          {notice}
        </Text>
      )}
      {review?.groups.length === 0 && (
        <Text style={ui.subtitle}>{t("conflicts.empty")}</Text>
      )}
      {review?.groups.map((group) => (
        <View key={group.id} style={ui.card}>
          <Text style={ui.subtitle}>
            {mergePreviews.get(group.id)?.applicable
              ? t("conflicts.paymentReview")
              : t("conflicts.related", { count: group.keys.length })}
          </Text>
          {group.financial && !mergePreviews.get(group.id)?.applicable && (
            <Text style={ui.text}>{t("conflicts.linked")}</Text>
          )}
          {group.keys.map((key) => {
            const local = review.local[key] ?? null,
              cloud = review.server.records[key] ?? null;
            const rows = fieldDifferences(
              local,
              cloud,
              review.server.baseline[key],
              Object.hasOwn(review.server.baseline, key),
            );
            if (!rows.length) return null;
            const paymentPreview = mergePreviews.get(group.id),
              settlement = /^(customerCollections|supplierPayments)\//.test(
                key,
              );
            // Separate payment IDs are events from different devices, not missing field values.
            if (
              paymentPreview?.available &&
              (settlement || rows.every((row) => row.path === "balance"))
            )
              return null;
            const presence = settlement
              ? settlementPresence(
                  local,
                  cloud,
                  review.server.baseline[key],
                  Object.hasOwn(review.server.baseline, key),
                )
              : undefined;
            if (presence)
              return (
                <View
                  key={key}
                  style={{
                    gap: 6,
                    paddingVertical: 10,
                    borderTopWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={ui.subtitle}>
                    {t(`conflicts.presence.${presence.label}`)}
                  </Text>
                  {valueView(presence.value.amount, "amount", undefined, key)}
                  <Text style={ui.text}>
                    {t(`flows.${String(presence.value.method)}`)} ·{" "}
                    {date(String(presence.value.createdAt))}
                  </Text>
                </View>
              );

            const object = (local ?? cloud) as {
              name?: string;
              number?: string;
            } | null;
            const title =
              object?.name ??
              object?.number ??
              (key.startsWith("settings/")
                ? t("conflicts.settings")
                : t("conflicts.record"));
            const editor = review.server.editors[key];
            return (
              <View
                key={key}
                style={{
                  gap: 10,
                  paddingVertical: 10,
                  borderTopWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={ui.subtitle}>{title}</Text>
                <Text style={ui.text}>
                  {t("conflicts.changed", { count: rows.length })}
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={ui.subtitle}>{t("conflicts.local")}</Text>
                    <Text style={ui.text}>
                      {review.server.viewerDeviceId.slice(-8)} ·{" "}
                      {date(
                        review.entries
                          .filter((entry) => entryKeys(entry).includes(key))
                          .at(-1)?.createdAt ?? group.at,
                      )}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={ui.subtitle}>{t("conflicts.cloud")}</Text>
                    <Text style={ui.text}>
                      {editor
                        ? `${editor.deviceName} · ${editor.deviceId.slice(-8)}`
                        : t("conflicts.cloud")}
                    </Text>
                    <Text style={ui.text}>{date(editor?.at)}</Text>
                  </View>
                </View>
                {rows.map((row) => {
                  const field =
                    key.startsWith("settings/") && row.path === "record"
                      ? key.slice(9)
                      : row.path;
                  const labelKey = `conflicts.fields.${field}`;
                  const label = i18n.exists(labelKey)
                    ? t(labelKey)
                    : field
                        .replace(/([a-z])([A-Z])/g, "$1 $2")
                        .replaceAll(".", " / ");
                  return (
                    <View
                      key={row.path}
                      style={{
                        gap: 6,
                        padding: 10,
                        borderRadius: 10,
                        backgroundColor: colors.elevated,
                        borderLeftWidth: 3,
                        borderLeftColor: colors.primary,
                      }}
                    >
                      <Text style={ui.subtitle}>{label}</Text>
                      <View style={{ flexDirection: "row", gap: 12 }}>
                        <View style={{ flex: 1 }}>
                          {valueView(
                            row.local,
                            row.path,
                            t("conflicts.local"),
                            key,
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          {valueView(
                            row.cloud,
                            row.path,
                            t("conflicts.cloud"),
                            key,
                          )}
                        </View>
                      </View>
                      {row.originalKnown ? (
                        <View style={{ gap: 2 }}>
                          <Text style={ui.text}>{t("conflicts.original")}</Text>
                          {valueView(row.before, row.path, undefined, key)}
                        </View>
                      ) : (
                        <Text style={ui.text}>{t("conflicts.unknown")}</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            );
          })}
          {!group.keys.some(
            (key) =>
              fieldDifferences(
                review.local[key] ?? null,
                review.server.records[key] ?? null,
              ).length,
          ) && <Text style={ui.text}>{t("conflicts.same")}</Text>}
          <PaymentMergePanel
            preview={mergePreviews.get(group.id)}
            busy={busy}
            onChoose={() => decide(group, "merge")}
          />
          <Text style={ui.text}>{t("conflicts.safety")}</Text>
          <Button
            title={choiceTitle(group, "local")}
            disabled={busy}
            onPress={() => decide(group, "local")}
          />
          <Button
            secondary
            title={choiceTitle(group, "cloud")}
            disabled={busy}
            onPress={() => decide(group, "cloud")}
          />
        </View>
      ))}
    </Screen>
  );
}

function PaymentMergePanel({
  preview,
  busy,
  onChoose,
}: {
  preview?: PaymentMergePreview;
  busy: boolean;
  onChoose: () => void;
}) {
  const { t, i18n } = useTranslation(),
    ui = useUi();
  if (!preview?.applicable) return null;
  const money = (n: number) => formatMoney(n, i18n.language);
  return (
    <View style={ui.card}>
      <Text style={ui.subtitle}>{t("conflicts.mergeTitle")}</Text>
      <Text style={ui.text}>{t("conflicts.mergeHint")}</Text>
      {preview.available && (
        <>
          {preview.parties.map((party) => (
            <View key={party.key} style={{ gap: 4 }}>
              <Text style={ui.subtitle}>{party.name}</Text>
              <Text style={ui.text}>
                {t("conflicts.beforePayments", {
                  amount: money(party.originalDue),
                })}
              </Text>
              {party.otherDueChange !== 0 && (
                <Text style={ui.text}>
                  {t("conflicts.otherDueChange", {
                    amount: `${party.otherDueChange > 0 ? "+" : ""}${money(party.otherDueChange)}`,
                  })}
                </Text>
              )}
            </View>
          ))}
          {preview.payments.map((payment) => (
            <View key={payment.key} style={{ gap: 2 }}>
              <Text style={ui.subtitle}>
                {t(`conflicts.paymentSide.${payment.side}`)} ·{" "}
                {money(payment.amount)}
              </Text>
              <Text style={ui.text}>
                {t(`flows.${payment.method}`)} ·{" "}
                {new Date(payment.at).toLocaleString(i18n.language)}
              </Text>
            </View>
          ))}
          {preview.reallocated > 0 && (
            <Text style={ui.text}>{t("conflicts.reallocated")}</Text>
          )}
          <Text style={ui.subtitle}>
            {t("conflicts.combinedPaid", {
              amount: money(preview.payments.reduce((n, p) => n + p.amount, 0)),
            })}
          </Text>
          {preview.parties.map((party) => (
            <View key={party.key} style={{ gap: 4 }}>
              <Text style={ui.subtitle}>{party.name}</Text>
              <Text style={ui.text}>
                {t("conflicts.mergeCalculation", {
                  cloud: money(party.cloudDue),
                  local: money(party.localNew),
                })}
              </Text>
              <Text style={ui.subtitle}>
                {t("conflicts.remainingAfterMerge", {
                  amount: money(party.remaining),
                })}
              </Text>
            </View>
          ))}
        </>
      )}
      {!preview.available && (
        <Text style={ui.error}>
          {t(`conflicts.mergeReason.${preview.reason ?? "unsupported"}`)}
        </Text>
      )}
      <Button
        title={
          preview.available && preview.parties.length === 1
            ? t("conflicts.choice.merge", {
                amount: money(preview.parties[0].remaining),
              })
            : t("conflicts.keepBoth")
        }
        disabled={busy || !preview.available}
        onPress={onChoose}
      />
    </View>
  );
}
