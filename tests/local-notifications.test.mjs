import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
// Evaluate the actual installed Android JS graph against local-only native mocks.
// Remote native modules intentionally do not exist, reproducing the Expo Go client.
function androidClient(missing) {
  const loaded = [], checked = [], calls = [], cache = new Map();
  const native = {
    ExpoNotificationPermissionsModule: { getPermissionsAsync: async () => ({ granted: true, status: "granted" }) },
    ExpoNotificationsHandlerModule: {}, ExpoNotificationsEmitter: {},
    ExpoNotificationScheduler: { scheduleNotificationAsync: async (...args) => { calls.push(args); return args[0]; } },
    ExpoNotificationPresenter: {}, ExpoNotificationChannelManager: {}, NotificationsChannelsProvider: {},
  };
  if (missing) delete native[missing];
  const optional = (name) => { checked.push(name); return native[name] ?? null; };
  class LegacyEventEmitter { addListener() { return { remove() {} }; } }
  class CodedError extends Error {}
  const expo = { requireOptionalNativeModule: optional, PermissionStatus: { GRANTED: "granted", DENIED: "denied", UNDETERMINED: "undetermined" } };
  const core = { ...expo, LegacyEventEmitter, CodedError, UnavailabilityError: Error, Platform: { OS: "android", select: (value) => value.android ?? value.default }, uuid: { v4: () => "id" }, requireNativeModule: (name) => { if (!native[name]) throw new Error(`Cannot find native module '${name}'`); return native[name]; } };
  function resolve(specifier, from) {
    const base = specifier.startsWith(".") ? path.resolve(path.dirname(from), specifier) : path.join(root, "node_modules", specifier);
    return [".android.js", ".native.js", ".js", ".ts"].map((suffix) => base + suffix).find(existsSync) ?? base;
  }
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    loaded.push(path.relative(root, file).replaceAll("\\", "/"));
    const exports = {}; cache.set(file, exports);
    const source = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    runInNewContext(source, { exports, setTimeout, clearTimeout, console: { warn: (message) => { throw new Error(`Unexpected remote warning: ${message}`); } }, require: (specifier) => {
      if (specifier === "expo") return expo;
      if (specifier === "expo-modules-core") return core;
      if (specifier === "react-native") return { Platform: core.Platform };
      if (!specifier.startsWith(".") && !specifier.startsWith("expo-notifications/build/")) throw new Error(`Unexpected dependency ${specifier}`);
      return load(resolve(specifier, file));
    } });
    return exports;
  }
  return { load: (name) => load(path.join(root, "src/reminders", name + ".ts")), loaded, checked, calls };
}
test("installed local notification graph loads and schedules with no topic/push native modules", async () => {
  const client = androidClient();
  const api = await client.load("loadLocalNotifications").loadLocalNotifications();
  assert.equal((await api.getPermissionsAsync()).granted, true);
  const at = new Date("2026-10-22T06:00:00Z");
  assert.equal(await api.scheduleNotificationAsync({ identifier: "local-due", content: { title: "Payment reminder" }, trigger: { type: api.SchedulableTriggerInputTypes.DATE, date: at, channelId: "due" } }), "local-due");
  assert.equal(client.calls.length, 1);
  assert.ok(client.loaded.some((file) => file.endsWith("NotificationScheduler.native.js")));
  assert.ok(client.loaded.every((file) => !/expo-notifications\/build\/(index|TopicSubscriptionModule|topicSubscription|DevicePushToken|TokenEmitter|getExpoPushToken|ServerRegistration)/.test(file)));
});
test("clients missing local support reject normally before evaluating any notification native module", async () => {
  const client = androidClient("ExpoNotificationScheduler");
  await assert.rejects(client.load("loadLocalNotifications").loadLocalNotifications(), /localNotificationsUnavailable/);
  assert.ok(client.loaded.every((file) => !file.startsWith("node_modules/expo-notifications/")));
});
test("an Expo Go client with a channel manager but no channel provider fails before a native null cast", async () => {
  const client = androidClient("NotificationsChannelsProvider");
  await assert.rejects(client.load("loadLocalNotifications").loadLocalNotifications(), /localNotificationsUnavailable: NotificationsChannelsProvider/);
  assert.ok(client.loaded.every((file) => !file.startsWith("node_modules/expo-notifications/")));
});
