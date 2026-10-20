import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from "react";
import { Vibration } from "react-native";

const FeedbackContext = createContext<((scanId: string) => void) | null>(null);

/** Keep playback alive when the scanner is replaced by the product route. */
export function ScanFeedbackProvider({ children }: { children: ReactNode }) {
  const player = useAudioPlayer(require("../../assets/sounds/barcode-beep.wav"));
  const lastScan = useRef<string | null>(null);
  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: true, interruptionMode: "mixWithOthers" }).catch(() => {});
  }, []);
  const feedback = useCallback((scanId: string) => {
    if (!scanId || lastScan.current === scanId) return;
    lastScan.current = scanId;
    // Called on the product route, after the scanner's camera has been removed.
    Vibration.vibrate(100);
    try {
      if (player.currentTime > 0) {
        void player.seekTo(0).then(() => player.play()).catch((error) => console.info("[barcode] sound unavailable", error));
      } else player.play();
    } catch (error) { console.info("[barcode] sound unavailable", error); }
  }, [player]);
  return <FeedbackContext.Provider value={feedback}>{children}</FeedbackContext.Provider>;
}

export function useScanFeedback() {
  const feedback = useContext(FeedbackContext);
  if (!feedback) throw new Error("ScanFeedbackProvider is required");
  return feedback;
}
