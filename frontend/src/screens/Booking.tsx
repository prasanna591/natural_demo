import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { dateFromIso, formatDate, longDate, money, timeLabel, todayString } from "../api";
import { SalonSelectCard, ServiceSelectCard } from "../components";
import { useNaturals } from "../context";
import { PageShell } from "../layout";
import { fonts, radius } from "../theme";
import { Badge, Body, Button, Card, Chip, DemoNote, Display, Divider, Eyebrow, IconButton, RowSkeleton, AnimatedPressable, Skeleton, Spinner, Steps } from "../ui";

const STEPS = ["Salon", "Treatment", "Date & time", "Review"];

export function BookingScreen() {
  const app = useNaturals();
  const {
    t,
    bp,
    section,
    bookingStep,
    setBookingStep,
    closeBooking,
    rescheduleId,
    salons,
    salonId,
    setSalonId,
    bookingServices,
    branchServicesLoading,
    serviceId,
    setServiceId,
    bookingSalon,
    bookingService,
    bookingDate,
    setBookingDate,
    slots,
    slotsLoading,
    selectedTime,
    setSelectedTime,
    staffId,
    setStaffId,
    availableStaff,
    offerCode,
    setOfferCode,
    matchedOffer,
    estimatedTotal,
    submitBooking,
    busy,
    user,
    openAuth,
    bookings,
    staffBySalon,
  } = app;

  const [serviceQuery, setServiceQuery] = useState("");
  const [serviceCategory, setServiceCategory] = useState("All");
  const original = bookings.find((booking) => booking.id === rescheduleId);

  const dates = useMemo(
    () =>
      Array.from({ length: 14 }, (_, index) => {
        const value = todayString(index + 1);
        const date = dateFromIso(value);
        return { value, date };
      }),
    [],
  );

  const serviceCategories = useMemo(
    () => Array.from(new Set(bookingServices.map((service) => service.category))).sort((a, b) => a.localeCompare(b)),
    [bookingServices],
  );

  useEffect(() => {
    if (serviceCategory !== "All" && !serviceCategories.includes(serviceCategory)) {
      setServiceCategory("All");
    }
  }, [serviceCategories, serviceCategory]);

  const visibleServices = useMemo(() => {
    const term = serviceQuery.trim().toLowerCase();
    return bookingServices.filter((service) => {
      const inCategory = serviceCategory === "All" || service.category === serviceCategory;
      const inSearch =
        !term || `${service.name} ${service.category} ${service.description}`.toLowerCase().includes(term);
      return inCategory && inSearch;
    });
  }, [bookingServices, serviceQuery, serviceCategory]);

  const filtered = serviceQuery.trim().length > 0 || serviceCategory !== "All";
  const clearFilters = () => {
    setServiceQuery("");
    setServiceCategory("All");
  };

  const selectedSlot = slots.find((slot) => slot.time === selectedTime);
  const selectedStylist = selectedSlot?.staff.find((person) => person.id === staffId);
  const team = bookingSalon ? staffBySalon[bookingSalon.id] ?? [] : [];

  const canAuto = Boolean(
    (bookingStep === 0 && salonId) ||
      (bookingStep === 1 && serviceId) ||
      (bookingStep === 2 && selectedTime) ||
      bookingStep === 3,
  );

  const next = () => {
    if (bookingStep === 3) {
      void submitBooking();
      return;
    }
    if (!canContinueFor(bookingStep, salonId, serviceId, selectedTime)) {
      return;
    }
    setBookingStep(Math.min(3, bookingStep + 1));
  };

  return (
    <PageShell>
      <View style={{ paddingTop: bp.isMobile ? (bookingStep === 1 ? 10 : 16) : 30 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, flex: 1 }}>
            <IconButton name="close" label="Close booking" onPress={closeBooking} />
            <View style={{ flex: 1 }}>
              <Eyebrow>{rescheduleId ? "Reschedule ritual" : "Appointment ritual"}</Eyebrow>
              <Display size={bp.isMobile ? (bookingStep === 1 ? 28 : 34) : 46} style={{ marginTop: 5 }}>
                {rescheduleId ? "Choose a new time." : "Book your visit."}
              </Display>
              <Body size={12.5} color={t.muted} style={{ marginTop: 6, maxWidth: 520 }}>
                {rescheduleId
                  ? "Your salon and treatment are preserved. Choose a new open slot and confirm to update the appointment."
                  : bookingStep === 1 && bp.isMobile
                    ? "Pick a treatment, then review and continue from the pinned bar."
                    : "Four calm steps: studio, treatment, a real open time, then review."}
              </Body>
            </View>
          </View>
          <Badge label={`Naturals ${section === "men" ? "Men" : "Women"}`} tone="primary" />
        </View>

        {original ? (
          <Card style={{ marginTop: 16, backgroundColor: t.primarySoft, borderColor: t.primaryBorder }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Ionicons name="refresh-outline" size={17} color={t.primary} />
              <Body size={11.5} color={t.inkSoft}>
                Rescheduling <Body size={11.5} weight="700" color={t.ink}>{original.reference}</Body> — originally{" "}
                {formatDate(original.date)} at {timeLabel(original.start_time)}.
              </Body>
            </View>
          </Card>
        ) : null}

        <View style={{ marginTop: bp.isMobile && bookingStep === 1 ? 14 : 22 }}>
          <Steps steps={STEPS} current={bookingStep} onStep={(index) => index <= bookingStep && setBookingStep(index)} />
        </View>

        <View style={{ flexDirection: bp.isDesktop ? "row" : "column", gap: 22, alignItems: "flex-start" }}>
          <View style={{ flex: 1, width: "100%" }}>
            {!bp.isDesktop && bookingStep >= 2 ? (
              <View style={{ marginBottom: 14 }}>
                <SummaryPanel compact />
              </View>
            ) : null}
            <Card style={{ padding: bp.isMobile ? (bookingStep === 1 ? 14 : 18) : 28 }}>
              {bookingStep === 0 ? (
                <>
                  <StepTitle index={1} eyebrow="Studio" title="Choose your salon" subtitle="Real Naturals branches, with opening hours from the API." />
                  <View style={{ marginTop: 18 }}>
                    {salons.map((salon, index) => (
                      <SalonSelectCard key={salon.id} salon={salon} index={index} selected={salonId === salon.id} onPress={() => setSalonId(salon.id)} />
                    ))}
                  </View>
                  {bookingSalon ? (
                    <View style={{ marginTop: 8, padding: 14, borderRadius: radius.md, backgroundColor: t.surfaceAlt, borderWidth: 1, borderColor: t.border }}>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                        <SmallInfo icon="time-outline" text={`${bookingSalon.opens_at} – ${bookingSalon.closes_at}`} />
                        <SmallInfo icon="location-outline" text={bookingSalon.city} />
                        <SmallInfo icon="call-outline" text={bookingSalon.phone} />
                      </View>
                      {team.length ? (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 }}>
                          <Body size={10} weight="700" color={t.muted} style={{ letterSpacing: 1 }}>
                            TEAM
                          </Body>
                          <Body size={10.5} color={t.muted}>
                            {team.map((stylist) => stylist.name.split(" ").slice(-1)[0]).join(" · ")} (sample team)
                          </Body>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </>
              ) : null}

              {bookingStep === 1 ? (
                <>
                  <StepTitle
                    index={2}
                    eyebrow="Treatment"
                    title={section === "men" ? "Choose your discipline" : "Choose your ritual"}
                    subtitle={
                      bp.isMobile
                        ? "Tap a treatment to select it. Your choice and total stay pinned above."
                        : "Only services available at this studio are shown. Durations and prices come from the live catalogue."
                    }
                  />

                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 9,
                      borderWidth: 1,
                      borderColor: t.border,
                      backgroundColor: t.surfaceAlt,
                      borderRadius: radius.md,
                      paddingHorizontal: 13,
                      minHeight: 44,
                      marginTop: 14,
                      marginBottom: 10,
                    }}
                  >
                    <Ionicons name="search-outline" size={16} color={t.muted} />
                    <TextInput
                      value={serviceQuery}
                      onChangeText={setServiceQuery}
                      placeholder="Search treatments…"
                      placeholderTextColor={t.muted}
                      style={{ flex: 1, fontFamily: fonts.body, fontSize: 12.5, color: t.ink, paddingVertical: 9 }}
                    />
                    {serviceQuery ? (
                      <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setServiceQuery("")}>
                        <Ionicons name="close-circle" size={17} color={t.muted} />
                      </Pressable>
                    ) : null}
                  </View>

                  {serviceCategories.length > 1 ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 8, paddingBottom: 10, paddingRight: 12 }}
                    >
                      <Chip
                        label={`All (${bookingServices.length})`}
                        selected={serviceCategory === "All"}
                        onPress={() => setServiceCategory("All")}
                        icon="grid-outline"
                      />
                      {serviceCategories.map((category) => {
                        const count = bookingServices.filter((service) => service.category === category).length;
                        return (
                          <Chip
                            key={category}
                            label={`${category} (${count})`}
                            selected={serviceCategory === category}
                            onPress={() => setServiceCategory(category)}
                          />
                        );
                      })}
                    </ScrollView>
                  ) : null}

                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      marginBottom: 9,
                    }}
                  >
                    <Body size={10.5} color={t.muted} numberOfLines={1} style={{ flex: 1 }}>
                      Showing <Body size={10.5} weight="700" color={t.ink}>{visibleServices.length}</Body> of{" "}
                      {bookingServices.length} {bookingServices.length === 1 ? "treatment" : "treatments"}
                      {serviceCategory !== "All" ? ` · ${serviceCategory}` : ""}
                      {serviceQuery.trim() ? ` · “${serviceQuery.trim()}”` : ""}
                    </Body>
                    {filtered ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Clear treatment filters"
                        onPress={clearFilters}
                        style={{ minHeight: 32, justifyContent: "center" }}
                      >
                        <Body size={10.5} weight="700" color={t.primary}>
                          Clear
                        </Body>
                      </Pressable>
                    ) : (
                      <Badge label="Live prices" tone="outline" />
                    )}
                  </View>

                  <View>
                    {branchServicesLoading ? (
                      <View style={{ gap: 2 }}>
                        <RowSkeleton height={72} />
                        <RowSkeleton height={72} />
                        <RowSkeleton height={72} />
                      </View>
                    ) : null}
                    <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 8 }}>
                      {visibleServices.map((service) => (
                        <View key={service.id} style={{ width: bp.width >= 560 ? "48.8%" : "100%" }}>
                          <ServiceSelectCard
                            service={service}
                            selected={serviceId === service.id}
                            onPress={() => setServiceId(service.id)}
                          />
                        </View>
                      ))}
                    </View>
                    {!branchServicesLoading && !visibleServices.length ? (
                      <View
                        style={{
                          paddingVertical: 22,
                          paddingHorizontal: 16,
                          borderRadius: radius.lg,
                          borderWidth: 1,
                          borderColor: t.border,
                          backgroundColor: t.surfaceAlt,
                          alignItems: "center",
                          gap: 9,
                        }}
                      >
                        <Ionicons name="sparkles-outline" size={22} color={t.muted} />
                        <Body size={11.5} color={t.muted} align="center">
                          {filtered
                            ? "No treatments match these filters. Try another category or clear the search."
                            : "No treatments are available at this branch right now. Choose another salon."}
                        </Body>
                        {filtered ? <Button title="Clear filters" small kind="outline" onPress={clearFilters} /> : null}
                      </View>
                    ) : null}
                  </View>
                </>
              ) : null}

              {bookingStep === 2 ? (
                <>
                  <StepTitle
                    index={3}
                    eyebrow="Date & specialist"
                    title="Pick a real open time"
                    subtitle="These slots are returned by the salon server for your chosen treatment, studio and date. Nothing here is mocked."
                  />
                  <Body size={10} weight="700" color={t.muted} style={{ letterSpacing: 1.3, marginTop: 18, marginBottom: 8 }}>
                    CHOOSE A DAY
                  </Body>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                    {dates.map(({ value, date }) => {
                      const active = bookingDate === value;
                      return (
                        <AnimatedPressable
                          key={value}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          accessibilityLabel={`Choose ${longDate(value)}`}
                          onPress={() => setBookingDate(value)}
                          style={{
                            width: 62,
                            minHeight: 78,
                            borderRadius: radius.md,
                            borderWidth: 1,
                            borderColor: active ? t.primary : t.border,
                            backgroundColor: active ? t.primary : t.surface,
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 2,
                          }}
                        >
                          <Body size={9.5} weight="600" color={active ? t.primaryText : t.muted} style={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
                            {date.toLocaleDateString("en-IN", { weekday: "short" })}
                          </Body>
                          <Body size={19} weight="700" color={active ? t.primaryText : t.ink}>
                            {date.getDate()}
                          </Body>
                          <Body size={9} color={active ? t.primaryText : t.muted}>
                            {date.toLocaleDateString("en-IN", { month: "short" })}
                          </Body>
                        </AnimatedPressable>
                      );
                    })}
                  </ScrollView>

                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 22, marginBottom: 10 }}>
                    <Body size={10} weight="700" color={t.muted} style={{ letterSpacing: 1.3 }}>
                      AVAILABLE TIMES · {longDate(bookingDate).toUpperCase()}
                    </Body>
                    {slotsLoading ? <Spinner size={16} /> : <Badge label={`${slots.length} open`} tone={slots.length ? "success" : "muted"} />}
                  </View>

                  {slotsLoading ? (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      {Array.from({ length: 9 }).map((_, index) => (
                        <Skeleton key={index} width={84} height={42} radius={radius.md} />
                      ))}
                    </View>
                  ) : slots.length ? (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      {slots.map((slot) => {
                        const active = selectedTime === slot.time;
                        return (
                          <AnimatedPressable
                            key={slot.time}
                            accessibilityRole="button"
                            accessibilityLabel={`Book ${timeLabel(slot.time)}${active ? ", selected" : ""}`}
                            onPress={() => {
                              setSelectedTime(slot.time);
                              setStaffId(null);
                            }}
                            style={{
                              minWidth: 84,
                              minHeight: 42,
                              paddingHorizontal: 13,
                              borderRadius: radius.md,
                              borderWidth: 1,
                              borderColor: active ? t.primary : t.border,
                              backgroundColor: active ? t.primary : t.surfaceAlt,
                              alignItems: "center",
                              justifyContent: "center",
                              flexDirection: "row",
                              gap: 6,
                            }}
                          >
                            {active ? <Ionicons name="checkmark" size={13} color={t.primaryText} /> : null}
                            <Body size={12} weight="600" color={active ? t.primaryText : t.inkSoft}>
                              {timeLabel(slot.time)}
                            </Body>
                          </AnimatedPressable>
                        );
                      })}
                    </View>
                  ) : (
                    <View
                      style={{
                        padding: 18,
                        borderRadius: radius.md,
                        backgroundColor: t.surfaceAlt,
                        borderWidth: 1,
                        borderColor: t.border,
                        alignItems: "flex-start",
                        gap: 8,
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Ionicons name="calendar-clear-outline" size={18} color={t.muted} />
                        <Body size={12} weight="700" color={t.ink}>
                          No open times on this day
                        </Body>
                      </View>
                      <Body size={11} color={t.muted}>
                        Try the next day, choose another studio, or pick a shorter treatment.
                      </Body>
                      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                        <Button title="Try next day" small kind="outline" onPress={() => setBookingDate(todayStringFrom(bookingDate, 1))} />
                        <Button title="Change treatment" small kind="ghost" onPress={() => setBookingStep(1)} />
                      </View>
                    </View>
                  )}

                  {selectedTime ? (
                    <View style={{ marginTop: 22 }}>
                      <Body size={10} weight="700" color={t.muted} style={{ letterSpacing: 1.3, marginBottom: 9 }}>
                        SPECIALIST (OPTIONAL)
                      </Body>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{ selected: staffId === null }}
                          onPress={() => setStaffId(null)}
                          style={{
                            minHeight: 44,
                            paddingHorizontal: 15,
                            borderRadius: radius.md,
                            borderWidth: 1,
                            borderColor: staffId === null ? t.primary : t.border,
                            backgroundColor: staffId === null ? t.primarySoft : t.surface,
                          }}
                        >
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                            <Ionicons name="people-outline" size={14} color={staffId === null ? t.primary : t.muted} />
                            <Body size={11.5} weight="600" color={staffId === null ? t.primary : t.inkSoft}>
                              Any available
                            </Body>
                          </View>
                        </Pressable>
                        {availableStaff.map((stylist) => {
                          const active = staffId === stylist.id;
                          return (
                            <Pressable
                              key={stylist.id}
                              accessibilityRole="button"
                              accessibilityState={{ selected: active }}
                              onPress={() => setStaffId(stylist.id)}
                              style={{
                                minHeight: 44,
                                paddingHorizontal: 14,
                                paddingVertical: 8,
                                borderRadius: radius.md,
                                borderWidth: 1,
                                borderColor: active ? t.primary : t.border,
                                backgroundColor: active ? t.primarySoft : t.surface,
                              }}
                            >
                              <Body size={11.5} weight="600" color={active ? t.primary : t.inkSoft}>
                                {stylist.name}
                              </Body>
                              <Body size={8.5} color={t.muted}>
                                {stylist.title}
                              </Body>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ) : null}
                </>
              ) : null}

              {bookingStep === 3 ? (
                <>
                  <StepTitle
                    index={4}
                    eyebrow="Review"
                    title="One last look"
                    subtitle="Check the details below. Final availability, offer eligibility and pricing are validated again when you confirm."
                  />
                  <View style={{ marginTop: 18 }}>
                    <ReviewRow label="Studio" value={bookingSalon?.name ?? "—"} onEdit={() => setBookingStep(0)} />
                    <ReviewRow label="Treatment" value={bookingService ? `${bookingService.name} · ${bookingService.duration_minutes} min` : "—"} onEdit={() => setBookingStep(1)} />
                    <ReviewRow label="Date" value={longDate(bookingDate)} onEdit={() => setBookingStep(2)} />
                    <ReviewRow label="Time" value={selectedTime ? timeLabel(selectedTime) : "Choose a time"} onEdit={() => setBookingStep(2)} />
                    <ReviewRow label="Specialist" value={staffId ? selectedStylist?.name ?? "Selected specialist" : "Any available specialist"} onEdit={() => setBookingStep(2)} />
                  </View>

                  {rescheduleId ? (
                    <View style={{ marginTop: 18 }}>
                      <Body size={10} weight="700" color={t.muted} style={{ letterSpacing: 1.3, marginBottom: 8 }}>
                        RESCHEDULES
                      </Body>
                      <View
                        style={{
                          padding: 13,
                          borderRadius: radius.md,
                          backgroundColor: t.surfaceAlt,
                          borderWidth: 1,
                          borderColor: t.border,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <Ionicons name="information-circle-outline" size={18} color={t.primary} />
                        <Body size={11} color={t.inkSoft} style={{ flex: 1 }}>
                          Rescheduling releases any offer applied to the original appointment. The updated total uses the current
                          service price and is recalculated by the salon server.
                        </Body>
                      </View>
                    </View>
                  ) : (
                    <View style={{ marginTop: 18 }}>
                      <Body size={10} weight="700" color={t.muted} style={{ letterSpacing: 1.3, marginBottom: 8 }}>
                        OFFER CODE (OPTIONAL)
                      </Body>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <View style={{ flex: 1, borderWidth: 1, borderColor: matchedOffer ? t.success : t.border, borderRadius: radius.md, backgroundColor: t.inputBg, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 9 }}>
                          <Ionicons name="pricetag-outline" size={15} color={matchedOffer ? t.success : t.muted} />
                          <TextInput
                            value={offerCode}
                            onChangeText={setOfferCode}
                            placeholder="Enter a code"
                            placeholderTextColor={t.muted}
                            autoCapitalize="characters"
                            autoCorrect={false}
                            style={{ flex: 1, fontFamily: fonts.body, fontSize: 12.5, color: t.ink, paddingVertical: 12, letterSpacing: 0.6 }}
                          />
                          {matchedOffer ? <Ionicons name="checkmark-circle" size={17} color={t.success} /> : null}
                        </View>
                      </View>
                      {offerCode.trim() ? (
                        matchedOffer ? (
                          <Body size={10.5} color={t.success} style={{ marginTop: 6 }}>
                            {matchedOffer.title} · estimated {matchedOffer.discount_percent}% off. The server confirms eligibility.
                          </Body>
                        ) : (
                          <Body size={10.5} color={t.muted} style={{ marginTop: 6 }}>
                            This code is not in the active offer list. The server will validate it at confirmation.
                          </Body>
                        )
                      ) : null}
                    </View>
                  )}

                  {!user ? (
                    <View style={{ marginTop: 18, padding: 14, borderRadius: radius.md, backgroundColor: t.primarySoft, borderWidth: 1, borderColor: t.primaryBorder, flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <Ionicons name="person-circle-outline" size={20} color={t.primary} />
                      <Body size={11.5} color={t.inkSoft} style={{ flex: 1 }}>
                        Sign in to confirm this appointment and keep it in your diary.
                      </Body>
                      <Button title="Sign in" small kind="outline" onPress={() => openAuth("login")} />
                    </View>
                  ) : null}

                  <DemoNote>
                    No payment is collected. Appointment availability is rechecked atomically by the server before the booking is
                    saved. Offer codes and discounts are validated server-side.
                  </DemoNote>
                </>
              ) : null}

              <Divider style={{ marginTop: 22, marginBottom: 16 }} />
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <View>
                  {bookingStep > 0 ? (
                    <Button title="Back" kind="ghost" small onPress={() => setBookingStep(bookingStep - 1)} icon="arrow-back" />
                  ) : (
                    <Button title="Cancel" kind="ghost" small onPress={closeBooking} />
                  )}
                </View>
                {bookingStep === 1 ? (
                  <Body size={10.5} color={t.muted}>
                    Selection and Continue stay pinned at the top.
                  </Body>
                ) : (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    {bookingService ? (
                      <View style={{ alignItems: "flex-end" }}>
                        <Body size={9} color={t.muted}>
                          Estimated total
                        </Body>
                        <Body size={14} weight="700" color={t.ink}>
                          {money(estimatedTotal)}
                        </Body>
                      </View>
                    ) : null}
                    <Button
                      title={
                        bookingStep === 3
                          ? busy
                            ? "Confirming…"
                            : rescheduleId
                              ? "Confirm new time"
                              : user
                                ? "Confirm appointment"
                                : "Sign in to confirm"
                          : "Continue"
                      }
                      onPress={next}
                      disabled={busy || !canAuto || (bookingStep === 3 && !selectedTime)}
                      loading={busy}
                      icon={bookingStep === 3 ? "checkmark" : "arrow-forward"}
                    />
                  </View>
                )}
              </View>
            </Card>

            {!bp.isDesktop && bookingStep < 2 ? <View style={{ marginTop: 16 }}><SummaryPanel /></View> : null}
          </View>

          {bp.isDesktop ? (
            <View style={{ width: 340 }}>
              <View style={stickySummary}>
                <SummaryPanel />
              </View>
              <Card style={{ marginTop: 14, padding: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="shield-checkmark-outline" size={16} color={t.primary} />
                  <Body size={11.5} weight="700" color={t.ink}>
                    What the server checks
                  </Body>
                </View>
                <Body size={10.5} color={t.muted} style={{ marginTop: 7 }}>
                  Complete service duration, stylist eligibility, conflicting appointments, offer usage and ownership are all
                  validated before a booking is saved.
                </Body>
              </Card>
            </View>
          ) : null}
        </View>

        <DemoNote center>
          Need to change something? Use the steps above or close the flow — your selections are kept while it stays open.
        </DemoNote>
      </View>
    </PageShell>
  );
}

/**
 * Persistent action bar for the treatment step. It lives outside the page
 * ScrollView (mounted by the app shell) so the selected treatment, duration,
 * total and Continue action remain visible no matter how far the customer
 * scrolls through the catalogue.
 */
export function BookingSelectionBar() {
  const { t, bp, bookingService, setServiceId, setBookingStep, estimatedTotal } = useNaturals();
  const selected = Boolean(bookingService);
  const duration = bookingService?.duration_minutes ?? 0;
  const remove = () => setServiceId(null);
  const proceed = () => {
    if (selected) setBookingStep(2);
  };

  const icon = (
    <View
      style={{
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: selected ? t.primary : t.surfaceAlt,
        borderWidth: 1,
        borderColor: selected ? t.primary : t.border,
      }}
    >
      <Ionicons name={selected ? "checkmark" : "sparkles-outline"} size={16} color={selected ? t.primaryText : t.muted} />
    </View>
  );

  const removeButton = selected ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Remove ${bookingService?.name ?? "selected treatment"}`}
      onPress={remove}
      hitSlop={8}
      style={{
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: t.surfaceAlt,
        borderWidth: 1,
        borderColor: t.border,
      }}
    >
      <Ionicons name="close" size={15} color={t.muted} />
    </Pressable>
  ) : null;

  return (
    <View
      style={{
        backgroundColor: t.surface,
        borderBottomWidth: 1,
        borderBottomColor: selected ? t.primaryBorder : t.border,
        ...(Platform.OS === "web" ? ({ position: "sticky", top: 0, zIndex: 58 } as unknown as object) : null),
      }}
    >
      <PageShell>
        <View style={{ paddingVertical: bp.isMobile ? 9 : 11 }}>
          {bp.isMobile ? (
            <>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                {icon}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Body size={8.5} weight="700" color={selected ? t.primary : t.muted} numberOfLines={1} style={{ letterSpacing: 1.15 }}>
                    {selected ? "1 TREATMENT SELECTED" : "SELECT A TREATMENT"}
                  </Body>
                  <Body size={12.5} weight="700" color={t.ink} numberOfLines={1} style={{ marginTop: 1 }}>
                    {bookingService?.name ?? "Choose a service or ritual to continue"}
                  </Body>
                </View>
                {removeButton}
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 7, paddingLeft: 44 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Body size={9} color={t.muted} numberOfLines={1}>
                    {selected ? `${duration} min · estimated total` : "Nothing selected yet"}
                  </Body>
                  <Body size={15} weight="700" color={selected ? t.primary : t.muted} numberOfLines={1}>
                    {selected ? money(estimatedTotal) : "—"}
                  </Body>
                </View>
                <Button
                  title="Continue"
                  small
                  onPress={proceed}
                  disabled={!selected}
                  icon="arrow-forward"
                  accessibilityLabel="Continue to choose a date and time"
                />
              </View>
            </>
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              {icon}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Body size={9} weight="700" color={selected ? t.primary : t.muted} numberOfLines={1} style={{ letterSpacing: 1.15 }}>
                  {selected ? "1 TREATMENT SELECTED" : "SELECT A TREATMENT"}
                </Body>
                <Body size={13.5} weight="700" color={t.ink} numberOfLines={1} style={{ marginTop: 1 }}>
                  {bookingService?.name ?? "Choose a service or ritual to continue"}
                </Body>
              </View>
              {removeButton}
              <View style={{ alignItems: "flex-end", minWidth: 118 }}>
                <Body size={9} color={t.muted} numberOfLines={1}>
                  {selected ? `${duration} min · estimated total` : "No treatment yet"}
                </Body>
                <Body size={17} weight="700" color={selected ? t.primary : t.muted}>
                  {selected ? money(estimatedTotal) : "—"}
                </Body>
              </View>
              <Button
                title="Continue"
                small
                onPress={proceed}
                disabled={!selected}
                icon="arrow-forward"
                accessibilityLabel="Continue to choose a date and time"
              />
            </View>
          )}
        </View>
      </PageShell>
    </View>
  );
}

function StepTitle({ index, eyebrow, title, subtitle }: { index: number; eyebrow: string; title: string; subtitle: string }) {
  const { t, bp } = useNaturals();
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: t.primary, alignItems: "center", justifyContent: "center" }}>
          <Body size={10} weight="700" color={t.primaryText}>
            {index}
          </Body>
        </View>
        <Eyebrow>{eyebrow}</Eyebrow>
      </View>
      <Display size={bp.isMobile ? 27 : 32} style={{ marginTop: 10 }}>
        {title}
      </Display>
      <Body size={11.5} color={t.muted} style={{ marginTop: 6, maxWidth: 520 }}>
        {subtitle}
      </Body>
    </View>
  );
}

function SummaryPanel({ compact = false }: { compact?: boolean }) {
  const app = useNaturals();
  const {
    t,
    bookingSalon,
    bookingService,
    bookingDate,
    selectedTime,
    staffId,
    slots,
    matchedOffer,
    estimatedDiscount,
    estimatedTotal,
    setBookingStep,
  } = app;
  const stylist = (slots.find((slot) => slot.time === selectedTime)?.staff ?? []).find((person) => person.id === staffId);
  return (
    <Card style={{ padding: compact ? 16 : 20, backgroundColor: t.bgAlt }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <Eyebrow>Your selection</Eyebrow>
        {bookingService ? <Badge label="1 treatment" tone="primary" /> : null}
      </View>
      <Display size={compact ? 22 : 25} style={{ marginTop: 6 }}>
        {bookingService?.name ?? "Choose a treatment"}
      </Display>
      {bookingService ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 7, marginTop: 4 }}>
          <Body size={10.5} color={t.muted}>
            {bookingService.category}
          </Body>
          <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: t.borderStrong }} />
          <Body size={10.5} color={t.muted}>
            {bookingService.duration_minutes} min
          </Body>
          <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: t.borderStrong }} />
          <Body size={10.5} weight="700" color={t.primary}>
            {money(bookingService.price)}
          </Body>
        </View>
      ) : (
        <Body size={10.5} color={t.muted} style={{ marginTop: 3 }}>
          Your summary will build as you choose.
        </Body>
      )}
      {bookingService ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Change selected treatment"
          onPress={() => setBookingStep(1)}
          style={{ alignSelf: "flex-start", minHeight: 32, justifyContent: "center", marginTop: 4 }}
        >
          <Body size={10.5} weight="700" color={t.primary}>
            Change treatment
          </Body>
        </Pressable>
      ) : null}
      <Divider style={{ marginVertical: 12 }} />
      <MiniRow label="Studio" value={bookingSalon?.name ?? "Not selected"} />
      <MiniRow label="Date" value={bookingDate ? formatDate(bookingDate) : "Not selected"} />
      <MiniRow label="Time" value={selectedTime ? timeLabel(selectedTime) : "Not selected"} />
      <MiniRow label="Specialist" value={staffId ? stylist?.name ?? "Selected" : "Any available"} />
      <Divider style={{ marginVertical: 12 }} />
      <MiniRow label="Treatment price" value={bookingService ? money(bookingService.price) : "—"} />
      <MiniRow label="Duration" value={bookingService ? `${bookingService.duration_minutes} min` : "—"} />
      {matchedOffer ? <MiniRow label={`Offer · ${matchedOffer.code}`} value={`−${money(estimatedDiscount)}`} success /> : null}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 8 }}>
        <Body size={11.5} weight="700" color={t.ink}>
          Estimated total
        </Body>
        <Display size={compact ? 23 : 26} color={t.primary}>
          {bookingService ? money(estimatedTotal) : "—"}
        </Display>
      </View>
      <DemoNote>Final price is confirmed by the server at booking.</DemoNote>
    </Card>
  );
}

function MiniRow({ label, value, success }: { label: string; value: string; success?: boolean }) {
  const { t } = useNaturals();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
      <Body size={10.5} color={t.muted}>
        {label}
      </Body>
      <Body size={10.5} weight="600" color={success ? t.success : t.inkSoft} style={{ flex: 1, textAlign: "right" }}>
        {value}
      </Body>
    </View>
  );
}

function ReviewRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  const { t } = useNaturals();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: t.border }}>
      <Body size={10.5} color={t.muted} style={{ width: 84 }}>
        {label}
      </Body>
      <Body size={12} weight="600" color={t.ink} style={{ flex: 1 }}>
        {value}
      </Body>
      <Pressable accessibilityRole="button" accessibilityLabel={`Change ${label}`} onPress={onEdit} style={{ minHeight: 32, justifyContent: "center" }}>
        <Body size={10.5} weight="700" color={t.primary}>
          Change
        </Body>
      </Pressable>
    </View>
  );
}

function SmallInfo({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  const { t } = useNaturals();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <Ionicons name={icon} size={13} color={t.primary} />
      <Body size={10.5} color={t.inkSoft}>
        {text}
      </Body>
    </View>
  );
}

function canContinueFor(step: number, salonId: number | null, serviceId: number | null, selectedTime: string) {
  if (step === 0) return Boolean(salonId);
  if (step === 1) return Boolean(serviceId);
  if (step === 2) return Boolean(selectedTime);
  return true;
}

function todayStringFrom(value: string, offset: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + offset);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

const stickySummary =
  Platform.OS === "web"
    ? ({ position: "sticky", top: 150, zIndex: 10 } as unknown as object)
    : null;
