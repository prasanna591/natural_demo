import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { useNaturals } from "../../context";
import { BarChart, StatGrid, TrendChart } from "../../components/Charts";
import { Card, Display, EmptyState, Eyebrow, Field, SegmentedControl } from "../../ui";
import { PageShell } from "../../layout";
import { Body, Button } from "../../ui";
import { money, todayString, type Analytics } from "../../api";

export function Overview({
  analytics,
  analyticsLoading,
  loadAnalytics,
}: {
  analytics: Analytics | null;
  analyticsLoading: boolean;
  loadAnalytics: (range?: string, start?: string, end?: string) => Promise<void>;
}) {
  const { t, bp } = useNaturals();
  const [range, setRange] = useState("month");
  const [customStart, setCustomStart] = useState(todayString(-29));
  const [customEnd, setCustomEnd] = useState(todayString(0));
  const [customError, setCustomError] = useState("");

  useEffect(() => {
    if (range === "custom") return;
    void loadAnalytics(range);
  }, [loadAnalytics, range]);

  const applyCustomRange = () => {
    const isoDate = /^\d{4}-\d{2}-\d{2}$/;
    if (!isoDate.test(customStart) || !isoDate.test(customEnd)) {
      setCustomError("Enter both dates as YYYY-MM-DD.");
      return;
    }
    if (customStart > customEnd) {
      setCustomError("The start date must be on or before the end date.");
      return;
    }
    const days = (new Date(`${customEnd}T00:00:00`).getTime() - new Date(`${customStart}T00:00:00`).getTime()) / 86400000;
    if (days > 366) {
      setCustomError("Choose a range of 366 days or fewer.");
      return;
    }
    setCustomError("");
    void loadAnalytics("custom", customStart, customEnd);
  };

  if (analyticsLoading && !analytics) {
    return (
      <PageShell>
        <View style={{ paddingTop: 24, alignItems: "center", justifyContent: "center", height: 300 }}>
          <Display size={28} color={t.primary}>Loading analytics…</Display>
        </View>
      </PageShell>
    );
  }

  if (!analytics) {
    return (
      <PageShell>
        <View style={{ paddingTop: 24 }}>
          <Eyebrow>Real-time booking analytics</Eyebrow>
          <Display size={bp.isMobile ? 30 : 40}>Analytics</Display>
          <Body size={12.5} color={t.muted} style={{ marginTop: 8 }}>
            Pull live booking metrics from the database.
          </Body>
          <Button title="Load analytics" onPress={() => void loadAnalytics(range)} style={{ marginTop: 16 }} />
        </View>
      </PageShell>
    );
  }

  const trend = analytics.trend ?? [];
  const statusBreakdown = analytics.status_breakdown ?? [];
  const branchBreakdown = analytics.branch_breakdown ?? [];

  return (
    <PageShell>
      <View style={{ paddingTop: 24 }}>
        <View style={{ flexDirection: bp.isDesktop ? "row" : "column", justifyContent: "space-between", alignItems: bp.isDesktop ? "flex-end" : "flex-start", gap: 12, marginBottom: 20 }}>
          <View>
            <Eyebrow>Real-time booking analytics</Eyebrow>
            <Display size={bp.isMobile ? 30 : 40}>Dashboard overview</Display>
            <Body size={12.5} color={t.muted} style={{ marginTop: 8 }}>
              Metrics are calculated from actual booking records in the database.
            </Body>
          </View>
          <SegmentedControl
            options={["today", "week", "month", "custom"]}
            values={["Today", "This week", "This month", "Custom"]}
            value={range}
            onChange={(next) => setRange(next)}
          />
        </View>

        {range === "custom" ? (
          <Card style={{ marginBottom: 20 }}>
            <View style={{ padding: 16, gap: 12 }}>
              <View style={{ flexDirection: bp.isDesktop ? "row" : "column", gap: 12 }}>
                <Field
                  label="Start date"
                  value={customStart}
                  onChangeText={setCustomStart}
                  placeholder="YYYY-MM-DD"
                  style={{ flex: 1, marginBottom: 0 }}
                />
                <Field
                  label="End date"
                  value={customEnd}
                  onChangeText={setCustomEnd}
                  placeholder="YYYY-MM-DD"
                  style={{ flex: 1, marginBottom: 0 }}
                />
                <Button title="Apply range" small onPress={applyCustomRange} icon="calendar-outline" />
              </View>
              {customError ? (
                <Body size={11} color={t.danger}>
                  {customError}
                </Body>
              ) : null}
            </View>
          </Card>
        ) : null}

        <StatGrid
          stats={[
            { label: "Total bookings", value: analytics.total_bookings },
            { label: "Today", value: analytics.today },
            { label: "Upcoming", value: analytics.upcoming },
            { label: "Pending", value: analytics.pending },
            { label: "Completed", value: analytics.completed },
            { label: "Cancelled", value: analytics.cancelled },
            { label: "Revenue", value: money(analytics.revenue), tone: "success" },
          ]}
          columns={bp.isMobile ? 1 : 3}
        />

        <View style={{ marginTop: 22, flexDirection: bp.isDesktop ? "row" : "column", gap: 16 }}>
          <Card style={{ flex: 1, minWidth: bp.isMobile ? undefined : 420 }}>
            <View style={{ padding: 18, borderBottomWidth: 1, borderBottomColor: t.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View>
                <Eyebrow>Booking trend</Eyebrow>
                <Display size={22} style={{ marginTop: 4 }}>Bookings over time</Display>
              </View>
              <Body size={10} color={t.muted}>{trend.length} days</Body>
            </View>
            <View style={{ padding: 16 }}>
              {trend.length ? <TrendChart points={trend} /> : <EmptyState icon="analytics-outline" title="No trend data" message="No bookings recorded in the selected range." />}
            </View>
          </Card>

          <Card style={{ flex: 1, minWidth: bp.isMobile ? undefined : 420 }}>
            <View style={{ padding: 18, borderBottomWidth: 1, borderBottomColor: t.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View>
                <Eyebrow>Status breakdown</Eyebrow>
                <Display size={22} style={{ marginTop: 4 }}>By booking status</Display>
              </View>
            </View>
            <View style={{ padding: 16 }}>
              {statusBreakdown.length ? (
                <BarChart
                  data={statusBreakdown.map((s) => ({ label: s.status, value: Number(s.count) }))}
                  valueLabel={(v) => String(v)}
                />
              ) : (
                <EmptyState icon="checkmark-outline" title="No status data" message="No booking statuses recorded." />
              )}
            </View>
          </Card>
        </View>

        <View style={{ marginTop: 22 }}>
          <Card style={{ width: "100%" }}>
            <View style={{ padding: 18, borderBottomWidth: 1, borderBottomColor: t.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View>
                <Eyebrow>Branch-wise summary</Eyebrow>
                <Display size={22} style={{ marginTop: 4 }}>Bookings by branch</Display>
              </View>
            </View>
            <View style={{ padding: 16 }}>
              {branchBreakdown.length ? (
                <BarChart
                  data={branchBreakdown.map((b) => ({ label: b.branch, value: Number(b.bookings) }))}
                  valueLabel={(v) => String(v)}
                />
              ) : (
                <EmptyState icon="storefront-outline" title="No branch data" message="No bookings recorded per branch." />
              )}
            </View>
          </Card>
        </View>
      </View>
    </PageShell>
  );
}
