import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

const LOCAL_MODULES = ["ExpoNotificationPermissionsModule", "ExpoNotificationsHandlerModule", "ExpoNotificationsEmitter", "ExpoNotificationScheduler", "ExpoNotificationPresenter"];
let loading: Promise<typeof import("./localNotifications")> | undefined;
export function loadLocalNotifications() {
  // Check without throwing during module evaluation. If the client lacks local
  // support, forms can show an unavailable notice while dates/ledgers keep working.
  // SDK 57's manager may be present in Expo Go while its provider is absent.
  // Calling setNotificationChannelAsync in that client throws a native null cast.
  const required = Platform.OS === "android" ? [...LOCAL_MODULES, "ExpoNotificationChannelManager", "NotificationsChannelsProvider"] : LOCAL_MODULES;
  const missing = required.filter((name) => !requireOptionalNativeModule(name));
  if (missing.length) return Promise.reject(new Error(`localNotificationsUnavailable: ${missing.join(", ")}`));
  loading ??= import("./localNotifications").catch((error) => { loading = undefined; throw error; });
  return loading;
}
