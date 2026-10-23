import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import type { BusinessData } from "../store/business";
import { desiredDueNotifications, selectDuePlans, DUE_NOTIFICATION_PREFIX } from "../store/dueReminders";
import { reconcileReminders } from "./reconcile";
import { loadLocalNotifications } from "./loadLocalNotifications";
import { logReminderFailure } from "./diagnostics";

const RECEIPTS_KEY = "dokanx.due-notifications.receipts.v1";
const CHANNEL = "dokanx-collections";
export const notificationModule = loadLocalNotifications;
export async function reminderPermission(request = false) {
  let stage = "load local notifications";
  try {
  const n = await notificationModule();
  stage = "create Android channel";
  if (Platform.OS === "android") await n.setNotificationChannelAsync(CHANNEL, { name: "Payment reminders", importance: n.AndroidImportance.DEFAULT, lockscreenVisibility: n.AndroidNotificationVisibility.PRIVATE });
  stage = "read notification permission";
  let permission = await n.getPermissionsAsync();
  stage = "request notification permission";
  if (!permission.granted && request && permission.canAskAgain) permission = await n.requestPermissionsAsync();
  return permission.granted || permission.ios?.status === n.IosAuthorizationStatus.PROVISIONAL;
  } catch (error) { logReminderFailure(stage, error); throw error; }
}
export async function syncDueReminders(data: BusinessData, title: string, body: string) {
  const n = await notificationModule();
  n.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });
  const allowed = await reminderPermission();
  const now = Date.now();
  const active = selectDuePlans(data).filter((r) => r.remind && r.notifyAt).map((r) => `${DUE_NOTIFICATION_PREFIX}${encodeURIComponent(r.invoiceId)}-${Date.parse(r.notifyAt!)}`);
  const desired = allowed ? desiredDueNotifications(data, now) : [];
  const result = await reconcileReminders({
    pending: async () => (await n.getAllScheduledNotificationsAsync()).map((r) => r.identifier),
    delivered: async () => (await n.getPresentedNotificationsAsync()).map((r) => r.request.identifier),
    cancel: (id) => n.cancelScheduledNotificationAsync(id),
    dismiss: (id) => n.dismissNotificationAsync(id),
    schedule: async ({ id, at }) => { await n.scheduleNotificationAsync({ identifier: id, content: { title, body, sound: "default", data: { dokanxDue: true } }, trigger: { type: n.SchedulableTriggerInputTypes.DATE, date: new Date(at), channelId: CHANNEL } }); },
    readReceipts: async () => {
      const raw = await AsyncStorage.getItem(RECEIPTS_KEY);
      if (!raw) return [];
      const value: unknown = JSON.parse(raw);
      if (!Array.isArray(value) || value.some((id) => typeof id !== "string")) throw new Error("invalidReminderReceipts");
      return value;
    },
    writeReceipts: (ids) => AsyncStorage.setItem(RECEIPTS_KEY, JSON.stringify(ids)),
  }, desired, allowed ? active : [], now);
  return !allowed && active.length ? "denied" as const : result;
}
