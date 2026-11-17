import React, { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { useNaturals } from "../../context";
import { formatDate, money, timeLabel, todayString, type Booking } from "../../api";
import { Badge, Body, Button, Card, Chip, Display, EmptyState, Eyebrow, Field, LoadingBlock } from "../../ui";

function statusTone(status: string): "primary" | "success" | "danger" | "muted" {
  if (status === "completed") return "success";
  if (status === "cancelled") return "danger";
  if (status === "confirmed") return "primary";
  return "muted";
}

export function Appointments() {
  const {
    t,
    bp,
    adminBookings,
    bookingsLoading,
    bookingsFilters,
    setBookingsFilter,
    loadAdminBookings,
    saveBooking,
    removeBooking,
    ask,
    notify,
    adminSalons,
    loadAdminSalons,
  } = useNaturals();

  const [search, setSearch] = useState(bookingsFilters.search ?? "");
  const [date, setDate] = useState(bookingsFilters.date ?? "");
  const [status, setStatus] = useState(bookingsFilters.status ?? "");
  const [salonId, setSalonId] = useState<number | undefined>(bookingsFilters.salon_id);
  const [rescheduleId, setRescheduleId] = useState<number | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");

  useEffect(() => {
    if (adminSalons.length === 0) void loadAdminSalons();
  }, [adminSalons.length, loadAdminSalons]);

  const applyFilters = () => {
    setBookingsFilter("search", search.trim() || undefined);
    setBookingsFilter("date", date || undefined);
    setBookingsFilter("status", status || undefined);
    setBookingsFilter("salon_id", salonId != null ? String(salonId) : undefined);
  };

  const resetFilters = () => {
    setSearch("");
    setDate("");
    setStatus("");
    setSalonId(undefined);
    setBookingsFilter("search", undefined);
    setBookingsFilter("date", undefined);
    setBookingsFilter("status", undefined);
    setBookingsFilter("salon_id", undefined);
  };

  const branchSummary = useMemo(() => {
    const map = new Map<string, number>();
    adminBookings.forEach((booking) => {
      map.set(booking.salon.name, (map.get(booking.salon.name) ?? 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [adminBookings]);

  const startReschedule = (booking: Booking) => {
    setRescheduleId(booking.id);
    setEditDate(booking.date);
    setEditTime(booking.start_time);
  };

  const submitReschedule = async (booking: Booking) => {
    if (!editDate || !editTime) {
      notify("Choose both a date and a time.", "error");
      return;
    }
    await saveBooking(booking.id, { date: editDate, start_time: editTime });
    setRescheduleId(null);
  };

  const confirmCancel = (booking: Booking) => {
    ask({
      title: "Cancel appointment?",
      message: `Cancel ${booking.reference} for ${booking.customer_name ?? "this customer"}? The slot will be released.`,
      confirmLabel: "Cancel appointment",
      cancelLabel: "Keep it",
      destructive: true,
      onConfirm: () => {
        void saveBooking(booking.id, { status: "cancelled" });
      },
    });
  };

  const confirmDelete = (booking: Booking) => {
    ask({
      title: "Delete appointment?",
      message: `Permanently delete ${booking.reference}? This cannot be undone.`,
      confirmLabel: "Delete",
      cancelLabel: "Keep it",
      destructive: true,
      onConfirm: () => {
        void removeBooking(booking.id);
      },
    });
  };

  return (
    <View style={{ paddingTop: 24 }}>
      <Eyebrow>All branches · live appointments</Eyebrow>
      <Display size={bp.isMobile ? 30 : 40} style={{ marginTop: 4 }}>
        Appointments
      </Display>
      <Body size={12.5} color={t.muted} style={{ marginTop: 8 }}>
        Search, filter, confirm, reschedule or cancel any booking. Changes are written to the database immediately.
      </Body>

      <Card style={{ marginTop: 18 }}>
        <View style={{ padding: 16, gap: 12 }}>
          <View style={{ flexDirection: bp.isDesktop ? "row" : "column", gap: 12 }}>
            <Field
              label="Search"
              value={search}
              onChangeText={setSearch}
              placeholder="Reference, customer, email, service"
              icon="search-outline"
              style={{ flex: 1, marginBottom: 0 }}
            />
            <Field
              label="Date"
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              icon="calendar-outline"
              style={{ flex: 1, marginBottom: 0 }}
            />
            <Field
              label="Salon"
              value={salonId != null ? String(salonId) : ""}
              onChangeText={(text) => setSalonId(text.trim() ? Number(text) : undefined)}
              placeholder="Salon ID (optional)"
              icon="storefront-outline"
              style={{ flex: 1, marginBottom: 0 }}
            />
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <Body size={10} weight="700" color={t.muted} style={{ letterSpacing: 1, textTransform: "uppercase", marginRight: 4 }}>
              Status
            </Body>
            {[
              { key: "", label: "All" },
              { key: "confirmed", label: "Confirmed" },
              { key: "completed", label: "Completed" },
              { key: "cancelled", label: "Cancelled" },
            ].map((option) => (
              <Chip key={option.key || "all"} label={option.label} selected={status === option.key} onPress={() => setStatus(option.key)} />
            ))}
          </View>

          {adminSalons.length ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <Body size={10} weight="700" color={t.muted} style={{ letterSpacing: 1, textTransform: "uppercase", marginRight: 4 }}>
                Branch
              </Body>
              <Chip label="All branches" selected={salonId == null} onPress={() => setSalonId(undefined)} />
              {adminSalons.map((salon) => (
                <Chip key={salon.id} label={salon.city} selected={salonId === salon.id} onPress={() => setSalonId(salon.id)} />
              ))}
            </View>
          ) : null}

          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <Button title="Apply filters" small onPress={applyFilters} icon="funnel-outline" />
            <Button title="Reset" small kind="ghost" onPress={resetFilters} icon="close-outline" />
            <Button title="Refresh" small kind="outline" onPress={() => void loadAdminBookings()} icon="refresh-outline" />
            <Button title="Today" small kind="outline" onPress={() => { setDate(todayString()); setBookingsFilter("date", todayString()); }} icon="today-outline" />
          </View>
        </View>
      </Card>

      {branchSummary.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
          {branchSummary.map(([name, count]) => (
            <View
              key={name}
              style={{
                flexGrow: 1,
                minWidth: 170,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: t.border,
                backgroundColor: t.surface,
                padding: 14,
              }}
            >
              <Body size={10} weight="700" color={t.muted} style={{ textTransform: "uppercase", letterSpacing: 0.8 }} numberOfLines={1}>
                {name}
              </Body>
              <Display size={24} color={t.primary} style={{ marginTop: 4 }}>
                {count}
              </Display>
              <Body size={10} color={t.muted}>appointments</Body>
            </View>
          ))}
        </View>
      ) : null}

      <View style={{ marginTop: 18 }}>
        {bookingsLoading ? (
          <LoadingBlock label="Loading appointments…" />
        ) : adminBookings.length === 0 ? (
          <EmptyState
            icon="calendar-outline"
            title="No appointments found"
            message="Adjust the filters or wait for a customer booking to arrive."
            actionLabel="Refresh"
            onAction={() => void loadAdminBookings()}
          />
        ) : (
          <View style={{ gap: 12 }}>
            {adminBookings.map((booking) => (
              <Card key={booking.id} padded={false}>
                <View style={{ padding: 16, gap: 12 }}>
                  <View style={{ flexDirection: bp.isMobile ? "column" : "row", justifyContent: "space-between", gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <Body size={13} weight="700" color={t.ink}>
                          {booking.service.name}
                        </Body>
                        <Badge label={booking.status} tone={statusTone(booking.status)} />
                      </View>
                      <Body size={11} color={t.muted} style={{ marginTop: 3 }}>
                        {booking.reference} · {booking.customer_name ?? "Customer"} · {booking.customer_email ?? "no email"}
                      </Body>
                    </View>
                    <View style={{ alignItems: bp.isMobile ? "flex-start" : "flex-end" }}>
                      <Body size={13} weight="700" color={t.ink}>
                        {formatDate(booking.date)} · {timeLabel(booking.start_time)}
                      </Body>
                      <Body size={11} color={t.muted}>
                        {booking.salon.name} · {booking.stylist.name}
                      </Body>
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
                    <Body size={11} color={t.muted}>Duration {booking.service.duration_minutes} min</Body>
                    <Body size={11} color={t.muted}>Price {money(booking.price)}</Body>
                    <Body size={11} color={t.muted}>Discount {money(booking.discount)}</Body>
                    <Body size={11} weight="700" color={t.primary}>Total {money(booking.total)}</Body>
                  </View>

                  {rescheduleId === booking.id ? (
                    <View style={{ flexDirection: bp.isMobile ? "column" : "row", gap: 10, alignItems: bp.isMobile ? "stretch" : "flex-end" }}>
                      <Field label="New date" value={editDate} onChangeText={setEditDate} placeholder="YYYY-MM-DD" style={{ flex: 1, marginBottom: 0 }} />
                      <Field label="New time" value={editTime} onChangeText={setEditTime} placeholder="HH:MM" style={{ flex: 1, marginBottom: 0 }} />
                      <Button title="Save" small onPress={() => void submitReschedule(booking)} icon="checkmark-outline" />
                      <Button title="Cancel" small kind="ghost" onPress={() => setRescheduleId(null)} />
                    </View>
                  ) : (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      {booking.status !== "confirmed" ? (
                        <Button title="Confirm" small onPress={() => void saveBooking(booking.id, { status: "confirmed" })} icon="checkmark-outline" />
                      ) : null}
                      {booking.status !== "completed" ? (
                        <Button title="Complete" small kind="outline" onPress={() => void saveBooking(booking.id, { status: "completed" })} icon="checkmark-done-outline" />
                      ) : null}
                      {booking.status !== "cancelled" ? (
                        <Button title="Cancel" small kind="outline" onPress={() => confirmCancel(booking)} icon="close-outline" />
                      ) : null}
                      <Button title="Reschedule" small kind="outline" onPress={() => startReschedule(booking)} icon="time-outline" />
                      <Button title="Delete" small kind="danger" onPress={() => confirmDelete(booking)} icon="trash-outline" />
                    </View>
                  )}
                </View>
              </Card>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}
