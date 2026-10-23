import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { useTranslation } from "react-i18next";
import { router } from "expo-router";
import { useBusiness } from "../store/BusinessProvider";
import { notificationModule, syncDueReminders } from "./native";
import { logReminderFailure, reminderFailureStatus } from "./diagnostics";

type Status = "ok" | "denied" | "failed" | "limited" | "unavailable";
const Context = createContext<{ status: Status; retry: () => void }>({ status: "ok", retry: () => {} });
export const useReminders = () => useContext(Context);
export default function ReminderProvider({ children }: { children: ReactNode }) {
  const { data, ready } = useBusiness();
  const { t } = useTranslation();
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState<Status>("ok");
  const retry = useCallback(() => setRevision((r) => r + 1), []);
  const queue = useRef(Promise.resolve());
  const generation = useRef(0);
  useEffect(() => {
    if (!ready) return;
    const current = ++generation.current;
    queue.current = queue.current.catch(() => {}).then(async () => {
      if (current !== generation.current) return;
      try { const next = await syncDueReminders(data, t("due.notificationTitle"), t("due.notificationBody")); if (current === generation.current) setStatus(next); }
      catch (error) {
        if (current === generation.current) {
          // Date-only follow-ups do not use notifications and should not show a
          // scheduling error simply because the current client lacks support.
          const requested = data.dueReminders?.some((r) => r.remind);
          setStatus(requested ? reminderFailureStatus(error) : "ok");
          logReminderFailure("synchronize reminders", error);
        }
      }
    });
  }, [data, ready, t, revision]);
  useEffect(() => { const sub = AppState.addEventListener("change", (s) => { if (s === "active") retry(); }); return () => sub.remove(); }, [retry]);
  useEffect(() => {
    if (!ready || !data.shopActive) return;
    let active = true;
    let remove: (() => void) | undefined;
    void notificationModule().then(async (n) => {
      if (!active) return;
      const open = (response: import("./localNotifications").NotificationResponse) => {
        if (!active || !response.notification.request.content.data?.dokanxDue) return;
        router.push("/business/collections");
        void n.clearLastNotificationResponseAsync().catch(() => {});
      };
      const sub = n.addNotificationResponseReceivedListener(open); remove = () => sub.remove();
      const response = await n.getLastNotificationResponseAsync(); if (response) open(response);
    }).catch(() => {});
    return () => { active = false; remove?.(); };
  }, [ready, data.shopActive]);
  return <Context.Provider value={{ status, retry }}>{children}</Context.Provider>;
}
