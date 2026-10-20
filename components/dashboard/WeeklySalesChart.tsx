import { formatMoney, localeFor } from "@/src/dashboard/format";
import { useTheme } from "@/src/theme/ThemeProvider";
import { useAmountVisibility } from "@/src/dashboard/useAmountVisibility";
import AmountVisibilityButton from "./AmountVisibilityButton";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop, Line } from "react-native-svg";

interface WeeklySalesChartProps { days: { date: Date; total: number }[]; total: number }
export default function WeeklySalesChart({ days, total }: WeeklySalesChartProps) {
  const { visible, toggle } = useAmountVisibility();
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const [width, setWidth] = useState(260);
  const gradientId = `sales${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const top = 16;
  const bottom = 146;
  const max = Math.max(10000, ...days.map((d) => d.total));
  const min = Math.min(0, ...days.map((d) => d.total));
  const yFor = (value: number) => bottom - (value - min) / (max - min) * (bottom - top);
  const zero = yFor(0);
  const points = days.map((day, index) => ({ x: 8 + index * (width - 16) / 6, y: yFor(day.total) }));
  const line = points.reduce((path, point, index) => {
    if (index === 0) return `M${point.x},${point.y}`;
    const prev = points[index - 1];
    const mid = (prev.x + point.x) / 2;
    return `${path} C${mid},${prev.y} ${mid},${point.y} ${point.x},${point.y}`;
  }, "");
  const area = `${line} L${points[6].x},${zero} L${points[0].x},${zero} Z`;
  const weekdays = days.map((d) => d.date.toLocaleDateString(localeFor(i18n.language), { weekday: "short" }));
  const chartLabel = t("dashboard.chartDescription", { values: days.map((d, index) => `${weekdays[index]} ${formatMoney(d.total, i18n.language)}`).join(", "), total: formatMoney(total, i18n.language) });
  return <View className="rounded-[20px] border border-line bg-surface p-4" style={{ gap: 12 }}>
    <View className="flex-row items-center justify-between gap-3">
      <View className="flex-1"><Text className="text-xs text-muted">{t("dashboard.weeklyTotal")}</Text><Text accessibilityLabel={visible ? undefined : t("dashboard.amountHidden")} className="mt-1 text-[28px] font-bold text-ink" style={{ fontVariant: ["tabular-nums"] }}>{visible ? formatMoney(total, i18n.language) : "••••••"}</Text></View>
      <View className="rounded-lg bg-raised px-2 py-1"><Text className="text-xs text-muted">{days[0].date.toLocaleDateString(localeFor(i18n.language), { day: "numeric", month: "short" })} – {days[6].date.toLocaleDateString(localeFor(i18n.language), { day: "numeric", month: "short" })}</Text></View>
      <AmountVisibilityButton visible={visible} toggle={toggle} label={t("dashboard.weeklyTotal")} />
    </View>
    {visible ? <View accessible accessibilityRole="image" accessibilityLabel={chartLabel} className="flex-row" style={{ gap: 6 }}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 46, height: 162, justifyContent: "space-between", paddingVertical: 9 }}>
        {[max, (max + min) / 2, min].map((amount) => <Text key={amount} className="text-muted" style={{ fontSize: 10 }}>{formatMoney(amount, i18n.language, true)}</Text>)}
      </View>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flex: 1, minWidth: 0 }} onLayout={(event) => setWidth(Math.max(100, event.nativeEvent.layout.width))}>
        <Svg width="100%" height={162} viewBox={`0 0 ${width} 162`}>
          <Defs><LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={colors.primary} stopOpacity={0.22} /><Stop offset="1" stopColor={colors.primary} stopOpacity={0.015} /></LinearGradient></Defs>
          {[top, (top + bottom) / 2, bottom].map((y) => <Line key={y} x1={0} x2={width} y1={y} y2={y} stroke={colors.border} strokeWidth={1} strokeDasharray="3 5" />)}
          <Path d={area} fill={`url(#${gradientId})`} /><Path d={line} fill="none" stroke={colors.primary} strokeWidth={2.8} strokeLinecap="round" />
          {points.map((point, index) => <Circle key={index} cx={point.x} cy={point.y} r={3.4} fill={colors.card} stroke={colors.primary} strokeWidth={2} />)}
        </Svg>
        <View className="flex-row justify-between">{weekdays.map((label, index) => <Text key={index} className="text-muted" style={{ fontSize: 10, lineHeight: 20, flex: 1, textAlign: "center" }}>{label}</Text>)}</View>
      </View>
    </View> : <View style={{ height: 182, justifyContent: "center", alignItems: "center" }}><Text className="text-sm text-muted">{t("dashboard.amountHidden")}</Text></View>}
    {visible && total === 0 && <Text className="text-xs text-muted" style={{ lineHeight: 20 }}>{t("dashboard.noSalesBody")}</Text>}
  </View>;
}
