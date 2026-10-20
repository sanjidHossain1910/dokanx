import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

/** Reveals are temporary and never persisted across screens or app sessions. */
export function useAmountVisibility() {
  const [visible, setVisible] = useState(false);
  const revealed = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hide = useCallback(() => {
    if (timer.current !== undefined) clearTimeout(timer.current);
    timer.current = undefined;
    revealed.current = false;
    setVisible(false);
  }, []);
  const toggle = useCallback(() => {
    if (revealed.current) { hide(); return; }
    revealed.current = true;
    setVisible(true);
    timer.current = setTimeout(hide, 20_000);
  }, [hide]);
  useFocusEffect(useCallback(() => { hide(); return hide; }, [hide]));
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => { if (state !== "active") hide(); });
    return () => {
      subscription.remove();
      if (timer.current !== undefined) clearTimeout(timer.current);
    };
  }, [hide]);
  return { visible, toggle };
}
