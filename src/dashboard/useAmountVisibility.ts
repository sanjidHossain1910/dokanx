import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useSecurity } from "../security/SecurityProvider";
import { useBusiness } from "../store/BusinessProvider";
import { amountVisibilitySettings } from "../store/businessSettings";

/** Masking is optional; report authentication always remains independent. */
export function useAmountVisibility() {
  const { state: security, requestReports } = useSecurity();
  const { data, workspace, restoreEpoch } = useBusiness();
  const { enabled, seconds } = amountVisibilitySettings(data.businessSettings);
  const key = `${workspace}:${restoreEpoch}:${enabled}:${seconds}`;
  const [shownFor, setShownFor] = useState<string | null>(null);
  const revealed = useRef<string | null>(null);
  const request = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const clearReveal = useCallback((invalidateRequest = true) => {
    if (invalidateRequest) request.current++;
    if (timer.current !== undefined) clearTimeout(timer.current);
    timer.current = undefined;
    revealed.current = null;
  }, []);
  const hide = useCallback((invalidateRequest = true) => {
    clearReveal(invalidateRequest);
    setShownFor(null);
  }, [clearReveal]);
  const toggle = useCallback(async () => {
    if (revealed.current === key && security.reportsUnlocked) { hide(); return; }
    hide();
    const ticket = ++request.current;
    if (!await requestReports() || ticket !== request.current) return;
    revealed.current = key;
    setShownFor(key);
    if (enabled) timer.current = setTimeout(hide, seconds * 1000);
  }, [hide, requestReports, key, enabled, seconds, security.reportsUnlocked]);
  useFocusEffect(useCallback(() => { if (revealed.current !== key) hide(); return hide; }, [hide, key]));
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      // A system biometric prompt may briefly make iOS inactive.
      if (state !== "active") hide(state !== "inactive");
    });
    return () => {
      subscription.remove();
      clearReveal();
    };
  }, [hide, clearReveal]);
  return { visible: (!enabled || shownFor === key) && security.reportsUnlocked, toggle };
}
