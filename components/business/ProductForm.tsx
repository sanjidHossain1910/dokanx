import { Button, Field, Screen, useUi } from "@/components/business/Screen";
import SelectField from "@/components/ui/SelectField";
import SquareFrame from "@/components/ui/SquareFrame";
import ProductCamera from "@/components/business/ProductCamera";
import ProductPhotoCrop from "@/components/business/ProductPhotoCrop";
import { useScanFeedback } from "@/src/scanner/ScanFeedbackProvider";
import { addProduct, type Product } from "@/src/store/business";
import { setPurchaseItem } from "@/src/store/purchasing";
import { addProductBatch, validExpiryDate } from "@/src/store/expiry";
import { editProduct } from "@/src/store/inventory";
import { useBusiness } from "@/src/store/BusinessProvider";
import { PRODUCT_UNITS, UNIT_GROUPS, getUnit, unitLabel, allowsFraction, parseMoneyInput, parseQuantityInput, type UnitGroupId, type UnitId } from "@/src/store/productUnits";
import { saveProductPhoto, removeUnsavedProductPhoto, removeDraftPhoto, type ProductPhotoDraft, type PreparedProductPhoto } from "@/src/store/productPhotos";
import { useTheme } from "@/src/theme/ThemeProvider";
import * as Crypto from "expo-crypto";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { Camera, ImagePlus, Images, ScanBarcode, Tag, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Keyboard, Modal, Pressable, Switch, Text, View } from "react-native";

const DEFAULT_UNITS: Record<UnitGroupId, UnitId> = { count: "piece", weight: "kg", volume: "litre", length: "metre", area: "square-foot", package: "packet", time: "hour" };

export default function ProductForm({ product, purchase = false }: { product?: Product; purchase?: boolean }) {
  const ui = useUi();
  const { colors } = useTheme();
  const scanFeedback = useScanFeedback();
  const params = useLocalSearchParams<{ barcode?: string }>();
  const { data, update } = useBusiness();
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? "en";
  const localeKey = language.startsWith("bn") ? "bn" : "en";
  const [productId] = useState(() => product?.id ?? `DX-${Crypto.randomUUID().toUpperCase()}`);
  const [name, setName] = useState(product?.name ?? "");
  const [barcode, setBarcode] = useState(product?.barcode ?? (typeof params.barcode === "string" ? params.barcode : ""));
  const [category, setCategory] = useState(product?.category ?? "");
  const [unit, setUnit] = useState<UnitId>(product?.unit ?? "piece");
  const [price, setPrice] = useState(product ? (product.price / 100).toFixed(2) : "");
  const [cost, setCost] = useState(product ? (product.cost / 100).toFixed(2) : "");
  const [stock, setStock] = useState(product ? String(product.stock) : purchase ? "1" : "");
  const [addToPurchase, setAddToPurchase] = useState(true);
  const [batchNumber, setBatchNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [threshold, setThreshold] = useState(product ? String(product.lowStockThreshold ?? 5) : String(data.businessSettings?.lowStockDefault ?? 5));
  const [description, setDescription] = useState(product?.description ?? "");
  const [existingPhotoUri, setExistingPhotoUri] = useState(product?.photoUri);
  const [newCategory, setNewCategory] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [categoryBusy, setCategoryBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [photo, setPhoto] = useState<PreparedProductPhoto>();
  const displayPhotoUri = photo?.uri ?? existingPhotoUri;
  const [cropSource, setCropSource] = useState<ProductPhotoDraft>();
  const [cameraMode, setCameraMode] = useState<"photo" | "barcode">();
  const [mediaBusy, setMediaBusy] = useState(false);
  const [barcodeFeedbackId, setBarcodeFeedbackId] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const picking = useRef(false);
  const mounted = useRef(true);
  const photoRef = useRef(photo);
  const cropRef = useRef(cropSource);
  useEffect(() => { photoRef.current = photo; cropRef.current = cropSource; }, [photo, cropSource]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => () => { removeDraftPhoto(photoRef.current?.uri); removeDraftPhoto(cropRef.current?.uri); }, []);
  useEffect(() => { if (!cameraMode && barcodeFeedbackId) scanFeedback(barcodeFeedbackId); }, [cameraMode, barcodeFeedbackId, scanFeedback]);
  const group = getUnit(unit)!.group;
  const unitName = unitLabel(unit, language);
  const fractional = allowsFraction(unit);
  const changeUnit = (value: UnitId) => {
    if (value === unit) return;
    if (product && product.stock > 0) { setError("unitHasStock"); return; }
    setUnit(value); setStock(product ? "0" : ""); setPrice(""); setCost(""); setThreshold(""); setError(""); setFieldErrors({});
  };
  const createCategory = async () => {
    if (saving.current || picking.current) return;
    saving.current = true; setCategoryBusy(true); setError("");
    try {
      const clean = newCategory.trim();
      await update((current) => {
        if (!clean || current.categories.some((item) => item.toLocaleLowerCase() === clean.toLocaleLowerCase())) throw new Error("invalidCategory");
        return { ...current, categories: [...current.categories, clean] };
      });
      setCategory(clean); setNewCategory(""); setCreatingCategory(false);
    } catch (cause) { setError(cause instanceof Error && cause.message === "invalidCategory" ? "invalidCategory" : "saveFailed"); }
    finally { saving.current = false; setCategoryBusy(false); }
  };
  const choosePhoto = async (camera: boolean) => {
    if (picking.current || saving.current) return;
    Keyboard.dismiss();
    if (camera) { setCameraMode("photo"); return; }
    picking.current = true; setPhotoBusy(true); setError("");
    try {
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], allowsEditing: false, quality: 1 };
      const result = await ImagePicker.launchImageLibraryAsync(options);
      if (!result.canceled && mounted.current) {
        const asset = result.assets[0];
        if (!asset || asset.width < 1 || asset.height < 1) throw new Error("invalidImage");
        setCropSource(asset);
      }
    } catch (cause) { console.info("[product-photo] gallery failed", { message: cause instanceof Error ? cause.message : String(cause) }); if (mounted.current) setError("photoPickFailed"); }
    finally { picking.current = false; if (mounted.current) setPhotoBusy(false); }
  };
  const save = async () => {
    if (saving.current || picking.current) return;
    if (!product && (batchNumber.trim() || expiryDate.trim()) && (!batchNumber.trim() || !validExpiryDate(expiryDate.trim()))) { setError("invalidBatch"); return; }
    const priceCents = parseMoneyInput(price), costCents = parseMoneyInput(cost), quantity = product ? product.stock : parseQuantityInput(stock, unit);
    const lowStockThreshold = threshold.trim() ? parseQuantityInput(threshold, unit) : data.businessSettings?.lowStockDefault ?? 5;
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = "requiredName";
    if (!category.trim()) errors.category = "requiredCategory";
    if (priceCents === null) errors.price = "invalidPrice";
    if (costCents === null) errors.cost = "invalidPrice";
    if (quantity === null || purchase && addToPurchase && quantity <= 0) errors.stock = "invalidStock";
    if (lowStockThreshold === null) errors.threshold = "invalidThreshold";
    setFieldErrors(errors);
    if (Object.keys(errors).length || priceCents === null || costCents === null || quantity === null || lowStockThreshold === null) return;
    saving.current = true; setBusy(true); setError("");
    let photoUri = existingPhotoUri;
    let newPhotoUri: string | undefined;
    let committed = false;
    try {
      if (!product && data.products.some((item) => item.id === productId)) throw new Error("duplicateProductId");
      if (photo) {
        try { photoUri = newPhotoUri = await saveProductPhoto(photo, product ? `${productId}-${Crypto.randomUUID()}` : productId); }
        catch { throw new Error("photoSaveFailed"); }
      }
      const stamp = new Date().toISOString();
      const next: Product = { id: productId, name: name.trim(), barcode: barcode.trim(), category, price: priceCents, cost: costCents, stock: quantity, unit, unitGroup: group, photoUri, lowStockThreshold, description: description.trim(), createdAt: product?.createdAt ?? stamp, updatedAt: stamp };
      await update((current) => {
        if (purchase) {
          if (!current.purchaseDraft) throw new Error("saveFailed");
          const added = addProduct(current, { ...next, stock: 0 });
          return addToPurchase ? setPurchaseItem(added, productId, quantity, costCents, { batchNumber: batchNumber.trim() || undefined, expiryDate: expiryDate.trim() || undefined }) : added;
        }
        const added = product ? editProduct(current, next, stamp) : addProduct(current, next);
        return !product && expiryDate.trim() ? addProductBatch(added, { id: `BATCH-${productId}`, productId, batchNumber: batchNumber.trim(), expiryDate: expiryDate.trim(), quantity, createdAt: stamp }) : added;
      });
      committed = true;
      if (product?.photoUri && product.photoUri !== photoUri && !data.purchaseDraft?.lines.some((l) => l.photoUri === product.photoUri) && !data.purchaseInvoices?.some((i) => i.items.some((l) => l.photoUri === product.photoUri)) && !data.saleDraft?.lines.some((l) => l.photoUri === product.photoUri) && !data.invoices?.some((i) => i.items.some((l) => l.photoUri === product.photoUri))) removeUnsavedProductPhoto(product.photoUri);
      if (mounted.current && purchase) router.dismissTo("/business/purchases/items");
      else if (mounted.current) router.dismissTo(product ? { pathname: "/inventory/product", params: { productId, saved: "1" } } : { pathname: "/(tabs)/packege", params: { saved: "1" } });
    } catch (cause) {
      if (newPhotoUri && !committed) removeUnsavedProductPhoto(newPhotoUri);
      if (mounted.current) setError(cause instanceof Error && ["invalidBatch", "invalidProduct", "duplicateBarcode", "duplicateProductId", "photoSaveFailed", "unitHasStock", "productMissing"].includes(cause.message) ? cause.message : "saveFailed");
    } finally { saving.current = false; if (mounted.current) setBusy(false); }
  };
  const inlineError = (field: string) => fieldErrors[field] ? <Text accessibilityRole="alert" style={ui.error}>{t(`inventory.${fieldErrors[field]}`)}</Text> : null;
  return <Screen title={t(product ? "inventory.edit" : "business.addProduct")} description={t(purchase ? "purchase.addHint" : "business.addProductHint")} back>
    <View style={{ ...ui.card, gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Tag size={18} color={colors.primary} /><Text style={ui.subtitle}>{t("business.productId")}</Text><Text style={{ marginLeft: "auto", color: colors.muted, fontSize: 12 }}>{t("business.autoGenerated")}</Text></View>
      <Text selectable style={{ color: colors.text, fontSize: 12, lineHeight: 22 }}>{productId}</Text>
    </View>
    <View style={ui.card}>
      <Text style={ui.subtitle}>{t("business.productPhoto")}</Text>
      <Text style={ui.text}>{t("business.photoLimitHint")}</Text>
      <SquareFrame maxSize={purchase ? 160 : 300} style={{ backgroundColor: colors.elevated, borderRadius: 12, borderWidth: 1, borderStyle: displayPhotoUri ? "solid" : "dashed", borderColor: colors.border, alignItems: "center", justifyContent: "center", gap: 10 }}>
        {displayPhotoUri ? <Image source={{ uri: displayPhotoUri }} contentFit="cover" accessibilityLabel={t("business.photoPreview")} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} /> : <><ImagePlus size={36} color={colors.muted} /><Text style={ui.text}>{t("business.photoOptional")}</Text></>}
        {displayPhotoUri && <Pressable disabled={busy || photoBusy} accessibilityRole="button" accessibilityLabel={t("business.removePhoto")} onPress={() => { removeDraftPhoto(photo?.uri); setPhoto(undefined); setExistingPhotoUri(undefined); }} style={{ position: "absolute", right: 8, top: 8, width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, justifyContent: "center", alignItems: "center" }}><X size={20} color={colors.text} /></Pressable>}
        {photoBusy && <ActivityIndicator color={colors.primary} style={{ position: "absolute" }} accessibilityLabel={t("common.loading")} />}
      </SquareFrame>
      {photo && <Text style={ui.text}>{t("business.photoPreview")} · {Math.ceil(photo.bytes / 1000)} KB · 1:1</Text>}
      <View style={{ flexDirection: "row", gap: 10 }}>{[{ camera: true, label: t("business.camera"), Icon: Camera }, { camera: false, label: t("business.gallery"), Icon: Images }].map(({ camera, label, Icon }) => <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} disabled={busy || photoBusy} onPress={() => void choosePhoto(camera)} style={{ flex: 1, minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.elevated, justifyContent: "center", alignItems: "center", flexDirection: "row", gap: 8, opacity: busy || photoBusy ? 0.5 : 1 }}><Icon size={20} color={colors.primary} /><Text style={{ color: colors.text, fontWeight: "600" }}>{label}</Text></Pressable>)}</View>
    </View>
    <View style={{ ...ui.card, gap: 16 }}>
      <Text style={ui.subtitle}>{t("business.productInfo")}</Text>
      <Field label={`${t("business.name")} *`} value={name} onChangeText={setName} editable={!busy} />{inlineError("name")}
      <Field label={t("business.barcodeOptional")} value={barcode} onChangeText={setBarcode} autoCapitalize="none" autoCorrect={false} editable={!busy} />
      <Pressable accessibilityRole="button" accessibilityLabel={t("business.scanBarcodeField")} disabled={busy || photoBusy} onPress={() => { Keyboard.dismiss(); setCameraMode("barcode"); }} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}><ScanBarcode size={22} color={colors.primary} /><Text style={{ color: colors.text }}>{t("business.scanBarcodeField")}</Text></Pressable>
      <SelectField label={`${t("business.category")} *`} value={category} options={[{ id: "", label: t("business.none") }, ...Array.from(new Set([...data.categories, ...(category ? [category] : [])])).map((label) => ({ id: label, label }))]} onChange={setCategory} disabled={busy || categoryBusy} />{inlineError("category")}
      <Button secondary title={t("inventory.addCategory")} disabled={busy || categoryBusy} onPress={() => setCreatingCategory((value) => !value)} />
      {creatingCategory && <><Text style={ui.text}>{t("inventory.addCategoryHint")}</Text><Field label={t("inventory.categoryName")} value={newCategory} onChangeText={setNewCategory} editable={!categoryBusy} /><Button title={t("business.save")} disabled={categoryBusy || !newCategory.trim()} onPress={() => void createCategory()} /></>}
    </View>
    <View style={{ ...ui.card, gap: 16 }}>
      <Text style={ui.subtitle}>{t("business.unitsAndStock")}</Text>
      <SelectField label={t("business.measurementType")} value={group} options={UNIT_GROUPS.map((item) => ({ id: item.id, label: item[localeKey] }))} onChange={(value) => { if (UNIT_GROUPS.some((item) => item.id === value)) changeUnit(DEFAULT_UNITS[value as UnitGroupId]); }} disabled={busy} />
      <SelectField label={t("business.measurementUnit")} value={unit} options={PRODUCT_UNITS.filter((item) => item.group === group).map((item) => ({ id: item.id, label: item[localeKey] }))} onChange={(value) => { const selected = getUnit(value); if (selected) changeUnit(selected.id); }} disabled={busy} />
      <Text style={ui.text}>{t("business.unitPriceHint", { unit: unitName })}</Text>
      <Field label={`${t("business.pricePerUnit", { unit: unitName })} *`} value={price} onChangeText={setPrice} keyboardType="decimal-pad" editable={!busy} />{inlineError("price")}
      <Field label={`${t("business.costPerUnit", { unit: unitName })} *`} value={cost} onChangeText={setCost} keyboardType="decimal-pad" editable={!busy} />{inlineError("cost")}
      {product ? <><Text style={ui.subtitle}>{t("inventory.stock")}: {product.stock.toLocaleString(language)} {unitName}</Text><Text style={ui.text}>{t("inventory.editStockHint")}</Text></> : <><Field label={`${t(purchase ? "purchase.initialQuantity" : "business.openingStock", { unit: unitName })} *`} value={stock} onChangeText={setStock} keyboardType={fractional ? "decimal-pad" : "number-pad"} placeholder={fractional ? "0.000" : "0"} editable={!busy} />{inlineError("stock")}</>}
      <Text style={ui.text}>{t(fractional ? "business.fractionalQuantityHint" : "business.wholeQuantityHint", { unit: unitName })}</Text>
      <Field label={`${t("inventory.threshold")} (${unitName})`} value={threshold} onChangeText={setThreshold} keyboardType={fractional ? "decimal-pad" : "number-pad"} placeholder="5" editable={!busy} />{inlineError("threshold")}
      <Field label={`${t("inventory.description")} (${t("inventory.optional")})`} value={description} onChangeText={setDescription} multiline editable={!busy} />
    </View>
    {!product && <View style={ui.card}><Text style={ui.subtitle}>{t("flows.optionalBatch")}</Text><Field label={t("flows.batch")} value={batchNumber} onChangeText={setBatchNumber} editable={!busy} /><Field label={t("flows.expiryDate")} value={expiryDate} onChangeText={setExpiryDate} placeholder="2027-12-31" editable={!busy} /></View>}
    {!!error && <Text accessibilityRole="alert" style={ui.error}>{t(`${error === "invalidBatch" ? "flows" : ["unitHasStock", "productMissing"].includes(error) ? "inventory" : "business"}.${error}`)}</Text>}
    {purchase && <View style={ui.card}><View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}><Text style={[ui.subtitle, { flex: 1 }]}>{t("purchase.addToPurchase")}</Text><Switch accessibilityLabel={t("purchase.addToPurchase")} value={addToPurchase} onValueChange={setAddToPurchase} disabled={busy} trackColor={{ true: colors.primary }} /></View><Text style={ui.text}>{t("purchase.addHint")}</Text></View>}
    <Button title={t(busy ? "business.savingProduct" : purchase ? addToPurchase ? "purchase.saveAdd" : "purchase.saveProduct" : product ? "inventory.saveChanges" : "business.saveProduct")} disabled={busy || photoBusy || categoryBusy} onPress={() => void save()} />
    <Modal visible={!!cameraMode || !!cropSource} animationType="slide" onRequestClose={() => { if (!mediaBusy) { setCameraMode(undefined); removeDraftPhoto(cropSource?.uri); setCropSource(undefined); } }}>
      {cameraMode && <ProductCamera mode={cameraMode} onBusyChange={setMediaBusy} onClose={() => setCameraMode(undefined)} onBarcode={(value) => { setBarcode(value); setBarcodeFeedbackId(`product-${Date.now()}`); setCameraMode(undefined); }} onPhoto={(value) => { setCameraMode(undefined); setCropSource(value); }} />}
      {cropSource && <ProductPhotoCrop source={cropSource} onBusyChange={setMediaBusy} onCancel={() => { removeDraftPhoto(cropSource.uri); setCropSource(undefined); }} onDone={(value) => { removeDraftPhoto(photo?.uri); removeDraftPhoto(cropSource.uri); setPhoto(value); setCropSource(undefined); }} />}
    </Modal>
  </Screen>;
}


