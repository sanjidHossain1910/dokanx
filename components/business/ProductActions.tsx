import InventorySheet from "./InventorySheet";
import { Button, useUi } from "./Screen";
import type { Product } from "@/src/store/business";
import { deleteProduct } from "@/src/store/inventory";
import { useBusiness } from "@/src/store/BusinessProvider";
import { useTheme } from "@/src/theme/ThemeProvider";
import { router, usePathname } from "expo-router";
import { Eye, Pencil, PackagePlus, Trash2 } from "lucide-react-native";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text } from "react-native";

export default function ProductActions({ product, onClose, onDeleted }: { product: Product; onClose: () => void; onDeleted?: () => void }) {
  const { colors } = useTheme();
  const ui = useUi();
  const { t } = useTranslation();
  const { update } = useBusiness();
  const pathname = usePathname();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const saving = useRef(false);
  const remove = async () => {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError(false);
    try { await update((current) => deleteProduct(current, product.id, new Date().toISOString())); onClose(); onDeleted?.(); }
    catch { setError(true); }
    finally { saving.current = false; setBusy(false); }
  };
  return <InventorySheet title={t(confirm ? "inventory.deleteTitle" : "inventory.actions")} onClose={onClose} busy={busy}>
    {confirm ? <><Text style={ui.text}>{t("inventory.deleteHint", { name: product.name })}</Text>{error && <Text accessibilityRole="alert" style={ui.error}>{t("business.saveFailed")}</Text>}<Pressable disabled={busy} accessibilityRole="button" onPress={() => void remove()} style={{ minHeight: 52, borderRadius: 12, backgroundColor: colors.danger, alignItems: "center", justifyContent: "center", opacity: busy ? 0.5 : 1 }}><Text style={{ color: colors.onPrimary, fontWeight: "700" }}>{t(busy ? "inventory.deleting" : "inventory.delete")}</Text></Pressable><Button secondary title={t("business.cancel")} disabled={busy} onPress={() => setConfirm(false)} /></> :
      [{ label: "view", Icon: Eye, path: "/inventory/product" }, { label: "edit", Icon: Pencil, path: "/inventory/edit-product" }, { label: "updateStock", Icon: PackagePlus, path: "/inventory/update-stock" }, { label: "delete", Icon: Trash2, path: null }].map(({ label, Icon, path }) => <Pressable key={label} accessibilityRole="button" accessibilityLabel={t(`inventory.${label}`)} onPress={() => { if (!path) setConfirm(true); else { onClose(); if (pathname !== path) router.push({ pathname: path as "/inventory/product", params: { productId: product.id } }); } }} style={{ flexDirection: "row", gap: 14, alignItems: "center", minHeight: 56, borderRadius: 12, paddingHorizontal: 14, backgroundColor: label === "delete" ? colors.dangerSoft : colors.elevated }}><Icon size={22} color={label === "delete" ? colors.danger : colors.primary} /><Text style={{ color: label === "delete" ? colors.danger : colors.text, fontSize: 16, fontWeight: "600" }}>{t(`inventory.${label}`)}</Text></Pressable>)}
  </InventorySheet>;
}
