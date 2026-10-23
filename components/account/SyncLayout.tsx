import type { BusinessData } from "@/src/store/business";
import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  ChevronRight,
  Circle,
  Clock3,
  CloudDownload,
  CloudUpload,
  EllipsisVertical,
  Info,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Store,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/src/theme/ThemeProvider";
import type { CloudShop, SyncPhase } from "@/src/cloudBackup/sync";
import type { CloudVersion } from "@/src/cloudBackup/controller";
import { formatBusinessDate } from "@/src/store/businessSettings";
import { Screen } from "../business/Screen";
import InventorySheet from "../business/InventorySheet";

type Props = {
  uploading?: boolean;
  offlineShop?: BusinessData;
  phone: string;
  name?: string;
  photo?: string;
  shops: CloudShop[];
  selected?: CloudShop;
  latest?: CloudVersion;
  loading: boolean;
  busy: boolean;
  disabled: boolean;
  done: boolean;
  phase: SyncPhase;
  progress: number;
  bytes: { received: number; total: number };
  issue: string;
  canContinue: boolean;
  localName?: string;
  offlineName?: string;
  hasSafety: boolean;
  onChoose: (shop: CloudShop) => void;
  onRefresh: () => void;
  onSync: () => void;
  onStart: (copyOffline: boolean) => void;
  onSetup: () => void;
  onHome: () => void;
  onLogout: () => void;
  onSafety: () => void;
  onBack: () => void;
  onRestore: () => void;
};

export default function SyncLayout(p: Props) {
  const { colors: c } = useTheme(),
    { t, i18n } = useTranslation();
  const [sheet, setSheet] = useState<"shops" | "menu" | "details" | null>(null);
  const label = (key: string) => t(`accountSync.${key}`);
  const muted = { color: c.muted },
    text = { color: c.text };
  const card = [s.card, { backgroundColor: c.card, borderColor: c.border }];
  const line = [s.line, { backgroundColor: c.border }];
  const percent = Math.round(p.progress * 100);
  const steps = p.uploading
    ? ["prepare", "upload", "finish"]
    : ["download", "validate", "save"];
  const step = p.uploading
    ? p.phase === "complete"
      ? 2
      : p.phase === "upload"
        ? 1
        : 0
    : p.phase === "download"
      ? 0
      : ["validate", "safety", "activate"].includes(p.phase)
        ? 1
        : 2;
  const link = (title: string, action: () => void, disabled = p.disabled) => (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={action}
      style={({ pressed }) => [
        s.link,
        { opacity: disabled ? 0.45 : pressed ? 0.65 : 1 },
      ]}
    >
      <Text style={[s.linkText, { color: c.primary }]}>{title}</Text>
    </Pressable>
  );
  const primary = (
    title: string,
    action: () => void,
    icon: ReactNode,
    disabled = p.disabled,
  ) => (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      accessibilityState={{ disabled }}
      onPress={action}
      style={({ pressed }) => [
        s.primary,
        {
          backgroundColor: c.primary,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        },
      ]}
    >
      {icon}
      <Text style={[s.primaryText, { color: c.onPrimary }]}>{title}</Text>
    </Pressable>
  );
  const smallRow = (icon: ReactNode, title: string) => (
    <View style={s.row}>
      {icon}
      <Text style={[s.body, muted, s.flex]}>{title}</Text>
    </View>
  );
  const shopName = p.done
    ? (p.localName ?? p.selected?.name)
    : p.selected?.name;
  const shopCard = shopName && (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label("choose")}
      accessibilityState={{
        disabled: p.disabled || p.done,
        expanded: sheet === "shops",
      }}
      disabled={p.disabled || p.done}
      onPress={() => setSheet("shops")}
      style={[card, s.row]}
    >
      {p.photo ? (
        <Image source={{ uri: p.photo }} style={s.shopPhoto} />
      ) : (
        <View
          style={[s.shopPhoto, s.center, { backgroundColor: c.primarySoft }]}
        >
          <Store color={c.primary} size={24} />
        </View>
      )}
      <View style={s.flex}>
        <Text style={[s.heading, text]}>{shopName}</Text>
        <Text style={[s.caption, muted]}>
          {label(p.done ? "onPhone" : "choose")}
        </Text>
      </View>
      {p.done ? (
        <View style={[s.pill, { backgroundColor: c.successSoft }]}>
          <Text style={[s.caption, { color: c.success }]}>
            {label(p.latest ? "synced" : "ready")}
          </Text>
        </View>
      ) : (
        <ChevronRight size={20} color={c.muted} />
      )}
    </Pressable>
  );
  return (
    <Screen
      back
      title={label("title")}
      fallbackHref="/account"
      onBack={p.onBack}
      rightSection={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label("options")}
          disabled={p.busy}
          onPress={() => setSheet("menu")}
          style={s.iconButton}
        >
          <EllipsisVertical color={c.text} size={22} />
        </Pressable>
      }
    >
      <View style={s.content}>
        <View style={[s.row, s.account, { borderBottomColor: c.border }]}>
          <View style={[s.avatar, s.center, { backgroundColor: c.primary }]}>
            {p.name?.trim() ? (
              <Text style={[s.avatarText, { color: c.onPrimary }]}>
                {p.name.trim().charAt(0).toUpperCase()}
              </Text>
            ) : (
              <Smartphone size={21} color={c.onPrimary} />
            )}
          </View>
          <View style={s.flex}>
            <Text style={[s.heading, text]}>{p.name || label("account")}</Text>
            <Text style={[s.caption, muted]}>{p.phone}</Text>
          </View>
        </View>
        {p.done ? (
          <>
            <View accessibilityLiveRegion="polite" style={s.success}>
              <View
                style={[
                  s.successIcon,
                  s.center,
                  { backgroundColor: c.successSoft },
                ]}
              >
                <Check size={34} color={c.success} strokeWidth={3} />
              </View>
              <Text style={[s.title, text]}>{label("readyShop")}</Text>
              <Text style={[s.body, muted, s.centerText]}>
                {label("success")}
              </Text>
            </View>
            {shopCard}
            <View style={s.features}>
              {smallRow(
                <ShieldCheck size={20} color={c.success} />,
                label("worksOffline"),
              )}
              {smallRow(
                <Clock3 size={20} color={c.primary} />,
                label("autoShort"),
              )}
            </View>
            {primary(
              label("home"),
              p.onHome,
              <ArrowRight size={19} color={c.onPrimary} />,
              p.busy,
            )}
            {link(label("details"), () => setSheet("details"), false)}
          </>
        ) : (
          <>
            {!p.loading && !p.busy && p.offlineShop && (
              <View style={[card, { borderColor: c.primary }]}>
                <Text
                  style={[s.caption, { color: c.primary, fontWeight: "600" }]}
                >
                  {label("transferLocalTitle")}
                </Text>
                <View style={s.row}>
                  {p.offlineShop.shopPhotoUri ? (
                    <Image
                      source={{ uri: p.offlineShop.shopPhotoUri }}
                      style={[s.shopPhoto, { width: 56, height: 56 }]}
                    />
                  ) : (
                    <View
                      style={[
                        s.shopPhoto,
                        s.center,
                        { backgroundColor: c.primarySoft },
                      ]}
                    >
                      <Store size={24} color={c.primary} />
                    </View>
                  )}
                  <View style={s.flex}>
                    <Text style={[s.heading, text]}>
                      {p.offlineShop.shopName}
                    </Text>
                    {!!p.offlineShop.ownerName && (
                      <Text style={[s.caption, muted]}>
                        {p.offlineShop.ownerName}
                      </Text>
                    )}
                    {!!p.offlineShop.shopAddress && (
                      <Text numberOfLines={2} style={[s.caption, muted]}>
                        {p.offlineShop.shopAddress}
                      </Text>
                    )}
                  </View>
                </View>
                <Text style={[s.caption, muted]}>
                  {
                    p.offlineShop.products.filter(
                      (product) => !product.deletedAt,
                    ).length
                  }{" "}
                  {label("products")} ·{" "}
                  {p.offlineShop.invoices?.length ?? p.offlineShop.sales.length}{" "}
                  {label("sales")}
                </Text>
                <Text style={[s.body, muted]}>
                  {label("transferLocalHint")}
                </Text>
                {primary(
                  label("transferLocalButton"),
                  () => p.onStart(true),
                  <CloudUpload size={19} color={c.onPrimary} />,
                )}
                <Text style={[s.caption, muted]}>
                  {label("transferLocalSafe")}
                </Text>
              </View>
            )}
            {shopCard}
            {p.loading ? (
              <View style={s.row}>
                <ActivityIndicator color={c.primary} />
                <Text style={[s.body, muted]}>{label("loading")}</Text>
              </View>
            ) : null}
            {p.busy ? (
              <>
                <View style={card}>
                  <View style={[s.row, s.transfer]}>
                    {p.uploading ? (
                      <>
                        <Smartphone size={30} color={c.primary} />
                        <ArrowRight size={20} color={c.muted} />
                        <CloudUpload size={32} color={c.primary} />
                      </>
                    ) : (
                      <>
                        <CloudDownload size={32} color={c.primary} />
                        <ArrowRight size={20} color={c.muted} />
                        <Smartphone size={30} color={c.primary} />
                      </>
                    )}
                  </View>
                  <View style={[s.row, s.spread]}>
                    <Text
                      accessibilityLiveRegion="polite"
                      style={[s.heading, text, s.flex]}
                    >
                      {label(`stages.${p.phase}`)}
                    </Text>
                    <Text style={[s.heading, text]}>{percent}%</Text>
                  </View>
                  <View
                    accessibilityRole="progressbar"
                    accessibilityLabel={label("working")}
                    accessibilityValue={{ min: 0, max: 100, now: percent }}
                    style={[s.track, { backgroundColor: c.elevated }]}
                  >
                    <View
                      style={[
                        s.fill,
                        { width: `${percent}%`, backgroundColor: c.primary },
                      ]}
                    />
                  </View>
                  {p.bytes.total > 0 && (
                    <Text style={[s.caption, muted]}>
                      {t("accountSync.downloadSize", {
                        received: (p.bytes.received / 1_000_000).toFixed(1),
                        total: (p.bytes.total / 1_000_000).toFixed(1),
                      })}
                    </Text>
                  )}
                  <View style={line} />
                  {steps.map((stage, index) => (
                    <View key={stage} style={s.row}>
                      {index < step ? (
                        <Check size={19} color={c.success} />
                      ) : index === step ? (
                        <ActivityIndicator size="small" color={c.primary} />
                      ) : (
                        <Circle size={19} color={c.border} />
                      )}
                      <Text style={[s.body, index === step ? text : muted]}>
                        {label(`steps.${stage}`)}
                      </Text>
                    </View>
                  ))}
                </View>
                <Text style={[s.caption, muted, s.centerText]}>
                  {label("keepOpen")}
                </Text>
              </>
            ) : (
              <>
                <View style={[s.row, s.spread]}>
                  <Text style={[s.heading, text]}>{label("cloud")}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={label("refresh")}
                    disabled={p.disabled}
                    onPress={p.onRefresh}
                    style={[s.iconButton, { opacity: p.disabled ? 0.45 : 1 }]}
                  >
                    <RefreshCw size={19} color={c.primary} />
                  </Pressable>
                </View>
                {p.latest ? (
                  <>
                    <View style={card}>
                      <View style={s.row}>
                        <CloudDownload size={30} color={c.primary} />
                        <View style={s.flex}>
                          <Text style={[s.heading, text]}>
                            {label("readyDownload")}
                          </Text>
                          <Text style={[s.caption, muted]}>
                            {formatBusinessDate(
                              p.latest.completedAt ?? p.latest.createdAt,
                              i18n.language,
                            )}
                          </Text>
                        </View>
                      </View>
                      <View style={[s.row, s.wrap]}>
                        {[
                          [p.latest.products, "products"],
                          [p.latest.invoices, "sales"],
                        ].map(([count, key]) => (
                          <View
                            key={key}
                            style={[s.pill, { backgroundColor: c.elevated }]}
                          >
                            <Text style={[s.caption, text]}>
                              {count ?? 0} {label(String(key))}
                            </Text>
                          </View>
                        ))}
                      </View>
                      <View style={line} />
                      {smallRow(
                        <ShieldCheck size={16} color={c.muted} />,
                        label("included"),
                      )}
                    </View>
                    <View style={s.row}>
                      <Info color={c.muted} size={18} />
                      <View style={s.flex}>
                        <Text style={[s.caption, muted]}>
                          {label("safeShort")}
                        </Text>
                        {link(
                          label("details"),
                          () => setSheet("details"),
                          false,
                        )}
                      </View>
                    </View>
                    {primary(
                      label("button"),
                      p.onSync,
                      <ArrowDownToLine size={19} color={c.onPrimary} />,
                    )}
                  </>
                ) : (
                  !p.loading && (
                    <View style={card}>
                      <CloudDownload size={28} color={c.primary} />
                      <Text style={[s.heading, text]}>
                        {label("noBackupTitle")}
                      </Text>
                      <Text style={[s.body, muted]}>{label("empty")}</Text>
                      {p.localName
                        ? p.offlineName
                          ? link(label("useAccountLocal"), () =>
                              p.onStart(false),
                            )
                          : primary(
                              label("useLocal"),
                              () => p.onStart(false),
                              <ArrowRight size={18} color={c.onPrimary} />,
                            )
                        : !p.offlineName
                          ? primary(
                              label("setup"),
                              p.onSetup,
                              <ArrowRight size={18} color={c.onPrimary} />,
                            )
                          : link(label("setup"), p.onSetup)}
                    </View>
                  )
                )}
                {link(label("restoreFile"), p.onRestore, p.busy)}
                {p.canContinue && link(label("continueShort"), p.onHome, false)}
              </>
            )}
          </>
        )}
        {!!p.issue && (
          <View
            accessibilityLiveRegion="polite"
            style={[
              s.card,
              { backgroundColor: c.dangerSoft, borderColor: c.danger },
            ]}
          >
            <Text style={[s.body, { color: c.danger }]}>{p.issue}</Text>
          </View>
        )}
        {!p.done && (
          <View style={[s.footer, { borderTopColor: c.border }]}>
            {smallRow(
              <Clock3 size={18} color={c.muted} />,
              label("autoPending"),
            )}
          </View>
        )}
        {sheet && (
          <InventorySheet
            title={label(
              sheet === "shops"
                ? "choose"
                : sheet === "menu"
                  ? "options"
                  : "details",
            )}
            onClose={() => setSheet(null)}
          >
            {sheet === "shops" &&
              p.shops.map((shop) => (
                <Pressable
                  key={shop.id}
                  disabled={p.disabled}
                  accessibilityRole="button"
                  accessibilityState={{
                    selected: shop.id === p.selected?.id,
                    disabled: p.disabled,
                  }}
                  onPress={() => {
                    setSheet(null);
                    p.onChoose(shop);
                  }}
                  style={[card, s.row]}
                >
                  <Store color={c.primary} size={23} />
                  <Text style={[s.heading, text, s.flex]}>{shop.name}</Text>
                  {shop.id === p.selected?.id && (
                    <Check size={20} color={c.primary} />
                  )}
                </Pressable>
              ))}
            {sheet === "menu" && (
              <>
                {link(label("details"), () => setSheet("details"), false)}
                {p.hasSafety &&
                  link(
                    label("safety"),
                    () => {
                      setSheet(null);
                      p.onSafety();
                    },
                    p.busy,
                  )}
                <Pressable
                  accessibilityRole="button"
                  disabled={p.busy}
                  accessibilityState={{ disabled: p.busy }}
                  onPress={() => {
                    setSheet(null);
                    p.onLogout();
                  }}
                  style={[s.row, s.menuRow]}
                >
                  <LogOut size={19} color={c.muted} />
                  <Text style={[s.body, text, s.flex]}>{label("offline")}</Text>
                </Pressable>
              </>
            )}
            {sheet === "details" && (
              <>
                <Text style={[s.body, muted]}>{label("review")}</Text>
                <Text style={[s.body, muted]}>{label("transfer")}</Text>
                <Text style={[s.body, muted]}>{label("auto")}</Text>
                {p.hasSafety && link(label("safety"), p.onSafety, p.busy)}
              </>
            )}
          </InventorySheet>
        )}
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  content: { gap: 12 },
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  wrap: { flexWrap: "wrap" },
  spread: { justifyContent: "space-between" },
  center: { alignItems: "center", justifyContent: "center" },
  centerText: { textAlign: "center" },
  account: { paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarText: { fontSize: 18, fontWeight: "700" },
  heading: { fontSize: 15, lineHeight: 22, fontWeight: "600" },
  body: { fontSize: 14, lineHeight: 21 },
  caption: { fontSize: 12, lineHeight: 19 },
  title: {
    fontSize: 23,
    lineHeight: 31,
    fontWeight: "700",
    textAlign: "center",
  },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 12 },
  shopPhoto: { width: 42, height: 42, borderRadius: 10 },
  pill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  line: { height: StyleSheet.hairlineWidth },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: {
    minHeight: 46,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryText: {
    fontSize: 15,
    lineHeight: 23,
    fontWeight: "600",
    flexShrink: 1,
    textAlign: "center",
  },
  link: { minHeight: 44, justifyContent: "center", paddingVertical: 8 },
  linkText: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    fontWeight: "500",
  },
  success: { alignItems: "center", gap: 10, paddingVertical: 12 },
  successIcon: { width: 64, height: 64, borderRadius: 32, marginBottom: 4 },
  features: { gap: 14, paddingVertical: 10 },
  transfer: { justifyContent: "center", paddingVertical: 14, gap: 22 },
  track: { height: 8, borderRadius: 5, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 5 },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 16,
    marginTop: 4,
  },
  menuRow: { minHeight: 48, paddingVertical: 8 },
});
