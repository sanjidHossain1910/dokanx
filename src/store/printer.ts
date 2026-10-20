import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeModules, PermissionsAndroid, Platform } from "react-native";
import { toByteArray } from "base64-js";
import { receiptRaster } from "./receiptRaster";
export type PrinterSettings = { address: string; name: string; paperWidth: 58 | 80 };
const KEY = "@dokanx/printer/v1";
let busy = false;
type NativePrinter = { init(options: Record<string, unknown>): Promise<void>; getDeviceList(): Promise<{ address: string; name?: string }[]>; connectPrinter(address: string, type: string): Promise<void>; disconnectPrinter(): Promise<void>; isConnected(): Promise<boolean>; sendRawCommand(bytes: number[]): Promise<void> };
let initialized: Promise<NativePrinter> | undefined;
let connectedAddress: string | undefined;
export async function readPrinter(): Promise<PrinterSettings | undefined> {
  const raw = await AsyncStorage.getItem(KEY); if (!raw) return;
  const value = JSON.parse(raw);
  if (!value || typeof value.address !== "string" || !value.address || typeof value.name !== "string" || ![58, 80].includes(value.paperWidth)) throw new Error("printerFailed");
  return value;
}
export const savePrinter = (value?: PrinterSettings) => value ? AsyncStorage.setItem(KEY, JSON.stringify(value)) : AsyncStorage.removeItem(KEY);
async function driver() {
  if (Platform.OS !== "android") throw new Error("printerPlatform");
  if (!NativeModules.PosPrinter) throw new Error("printerBuildRequired");
  if (Platform.OS === "android") {
    const permissions = Number(Platform.Version) >= 31 ? [PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT, PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
    const result = await PermissionsAndroid.requestMultiple(permissions);
    if (permissions.some((p) => result[p] !== PermissionsAndroid.RESULTS.GRANTED)) throw new Error("printerPermission");
  }
  if (!initialized) {
    const native = NativeModules.PosPrinter as NativePrinter;
    initialized = native.init({ cut: false, beep: false }).then(() => native).catch((e) => { initialized = undefined; throw e; });
  }
  return initialized;
}
export async function findPrinters() { const d = await driver(); return (await d.getDeviceList()).map((p) => ({ address: p.address, name: p.name || p.address })); }
async function ensureConnection(d: NativePrinter, address: string) {
  if (connectedAddress === address && await d.isConnected()) return;
  await d.disconnectPrinter(); connectedAddress = undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([d.connectPrinter(address, "BLUETOOTH"), new Promise<never>((_resolve, reject) => { timeout = setTimeout(() => reject(new Error("printerFailed")), 10000); })]);
    if (!await d.isConnected()) throw new Error("printerFailed");
  } catch (e) { await d.disconnectPrinter().catch(() => {}); throw e; }
  finally { clearTimeout(timeout); }
  connectedAddress = address;
}
export async function connectPrinter(settings: PrinterSettings) {
  const d = await driver(); await ensureConnection(d, settings.address);
  await savePrinter(settings);
}
export async function clearPrinter() {
  await savePrinter();
  connectedAddress = undefined;
  if (NativeModules.PosPrinter) { try { await (NativeModules.PosPrinter as NativePrinter).disconnectPrinter(); } catch {} }
}
export async function printBitmap(settings: PrinterSettings, base64: string) {
  if (busy) throw new Error("printerBusy"); busy = true;
  try { const commands = receiptRaster(toByteArray(base64), settings.paperWidth === 58 ? 384 : 576); const d = await driver(); await ensureConnection(d, settings.address); for (const command of commands) await d.sendRawCommand(command); }
  catch (e) { if (e instanceof Error && ["printerBuildRequired", "printerPermission", "printerPlatform"].includes(e.message)) throw e; throw new Error("printerFailed"); }
  finally { busy = false; }
}
