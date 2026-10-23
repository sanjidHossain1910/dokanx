import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";

/** Refresh local-day views on focus, foreground and while a screen stays open. */
export function useDeviceTime() {
  const [now, setNow] = useState(() => new Date());
  useFocusEffect(useCallback(() => { setNow(new Date()); }, []));
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    const sub = AppState.addEventListener("change", (state) => { if (state === "active") setNow(new Date()); });
    return () => { clearInterval(timer); sub.remove(); };
  }, []);
  return now;
}
