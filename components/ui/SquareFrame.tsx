import { useState, type ReactNode } from "react";
import { View, type ViewProps } from "react-native";

/** Measure the constrained width first; give the frame equal numeric dimensions. */
export default function SquareFrame({ children, maxSize = 300, onSizeChange, style, ...props }: ViewProps & { children: ReactNode; maxSize?: number; onSizeChange?: (size: number) => void }) {
  const [size, setSize] = useState(0);
  return <View style={{ width: "100%", maxWidth: maxSize, alignSelf: "center" }} onLayout={(event) => {
    const width = Math.max(0, event.nativeEvent.layout.width);
    setSize(width); onSizeChange?.(width);
  }}>
    <View {...props} style={[style, { width: size, height: size, flexGrow: 0, flexShrink: 0, overflow: "hidden" }]}>{children}</View>
  </View>;
}
