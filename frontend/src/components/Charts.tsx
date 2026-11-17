import React, { useMemo } from "react";
import { Dimensions, View, type DimensionValue } from "react-native";
import { useNaturals } from "../context";
import { Body, Display } from "../ui";

const { width } = Dimensions.get("window");

const percentHeight = (value: number) => `${value}%` as DimensionValue;

export function BarChart({
  data,
  valueLabel,
  height = 220,
}: {
  data: Array<{ label: string; value: number }>;
  valueLabel: (value: number) => string;
  height?: number;
}) {
  const { t } = useNaturals();
  const max = useMemo(() => Math.max(1, ...data.map((d) => d.value)), [data]);
  const barWidth = Math.max(24, (width - 64 - data.length * 12) / data.length);
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "space-between",
        height,
        paddingTop: 26,
        paddingBottom: 14,
      }}
    >
      {data.map((item, index) => {
        const percent = Math.round((item.value / max) * 100);
        return (
          <View
            key={item.label}
            style={{
              alignItems: "center",
              width: barWidth + 12,
            }}
          >
            <View
              style={{
                width: barWidth,
                height: percentHeight(percent),
                backgroundColor: t.primary,
                borderRadius: 6,
                marginBottom: 8,
              }}
            />
            <Body size={9} color={t.muted} numberOfLines={1} style={{ width: barWidth + 12 }}>
              {item.label}
            </Body>
            <Body size={9} weight="700" color={t.inkSoft} style={{ width: barWidth + 12, marginTop: 2 }}>
              {valueLabel(item.value)}
            </Body>
          </View>
        );
      })}
    </View>
  );
}

export function TrendChart({
  points,
  height = 200,
}: {
  points: Array<{ date: string; bookings: number; revenue: string }>;
  height?: number;
}) {
  const { t } = useNaturals();
  if (points.length === 0) return null;
  const maxBookings = Math.max(1, ...points.map((p) => p.bookings));
  const pointWidth = Math.max(20, (width - 48) / Math.max(1, points.length - 1));
  return (
    <View style={{ height, paddingHorizontal: 24, paddingTop: 14 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-end",
          height: height - 44,
        }}
      >
        {points.map((point, index) => {
          const percent = Math.round((point.bookings / maxBookings) * 100);
          const x = index * pointWidth;
          return (
            <View key={point.date} style={{ position: "absolute", left: x, width: pointWidth, alignItems: "center" }}>
              <View
                style={{
                  width: Math.max(4, pointWidth - 6),
                  height: percentHeight(percent),
                  backgroundColor: t.primary,
                  borderRadius: 4,
                  marginBottom: 8,
                  opacity: 0.85,
                }}
              />
              <Body size={8} color={t.muted} style={{ width: pointWidth, marginTop: 4, lineHeight: 12 }}>
                {point.date.slice(5)}
              </Body>
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
        <Body size={9} color={t.muted}>{`0`}</Body>
        <Body size={9} color={t.muted}>{String(maxBookings)}</Body>
        <Body size={9} color={t.muted} align="right">{points[points.length - 1].date}</Body>
      </View>
    </View>
  );
}

export function StatGrid({
  stats,
  columns = 2,
}: {
  stats: Array<{ label: string; value: string | number; tone?: "primary" | "success" | "danger" | "muted" }>;
  columns?: number;
}) {
  const { t, bp } = useNaturals();
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 12,
      }}
    >
      {stats.map((stat) => (
        <View
          key={stat.label}
          style={{
            flexGrow: 1,
            flexBasis: bp.isMobile ? "100%" : 0,
            minWidth: bp.isMobile ? "100%" : 160,
            backgroundColor: t.surface,
            borderWidth: 1,
            borderColor: t.border,
            borderRadius: 16,
            padding: 16,
          }}
        >
          <Body size={10} weight="700" color={t.muted} style={{ textTransform: "uppercase", letterSpacing: 1 }}>
            {stat.label}
          </Body>
          <Display size={28} color={stat.tone === "success" ? t.success : stat.tone === "danger" ? t.danger : t.primary} style={{ marginTop: 4 }}>
            {stat.value}
          </Display>
        </View>
      ))}
    </View>
  );
}

export { width };
