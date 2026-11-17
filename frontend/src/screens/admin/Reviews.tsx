import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { useNaturals } from "../../context";
import { PageShell } from "../../layout";
import { Badge, Body, Button, Card, Display, EmptyState, Eyebrow } from "../../ui";
import { formatReviewDate, ratingStars, type Review, type Salon } from "../../api";

export function ReviewsScreen() {
  const {
    t,
    bp,
    adminReviews,
    adminReviewsLoading,
    loadAdminReviews,
    setReviewActive,
    removeAdminReview,
    salons,
    ask,
  } = useNaturals();

  const [confirmDelete, setConfirmDelete] = useState<{ id: number; name: string } | null>(null);

  const salonById = useMemo<Record<number, Salon>>(() => {
    const map: Record<number, Salon> = {};
    salons.forEach((salon) => {
      map[salon.id] = salon;
    });
    return map;
  }, [salons]);

  useEffect(() => {
    void loadAdminReviews();
  }, [loadAdminReviews]);

  const toggleActive = useCallback(
    async (review: Review) => {
      try {
        await setReviewActive(review.id, !review.is_active);
      } catch {
        /* setReviewActive reports errors through the shared error state. */
      }
    },
    [setReviewActive],
  );

  const requestDelete = useCallback((review: Review) => {
    setConfirmDelete({ id: review.id, name: review.customer_name ?? "this review" });
  }, []);

  const confirmDeleteReview = useCallback(async () => {
    if (!confirmDelete) return;
    try {
      await removeAdminReview(confirmDelete.id);
      setConfirmDelete(null);
    } catch {
      /* removeAdminReview reports errors through the shared error state. */
    } finally {
      setConfirmDelete(null);
    }
  }, [confirmDelete, removeAdminReview]);

  return (
    <PageShell>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: bp.isMobile ? 24 : 0 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingTop: bp.isMobile ? 20 : 40 }}>
          <Eyebrow>Customer reviews</Eyebrow>
          <Display size={bp.isMobile ? 30 : 40} style={{ marginTop: 2 }}>
            Review management
          </Display>
          <Body size={12.5} color={t.muted} style={{ marginTop: 6, maxWidth: 620 }}>
            Approve, hide or remove customer reviews across branches. Hidden reviews no longer appear on the branch
            rating summary or in the customer app.
          </Body>

          {adminReviewsLoading ? (
            <View style={{ padding: 26, alignItems: "center" }}>
              <Body size={12} color={t.muted}>Loading reviews…</Body>
            </View>
          ) : adminReviews.length === 0 ? (
            <EmptyState
              icon="chatbubbles-outline"
              title="No reviews"
              message="There are no customer reviews to moderate yet."
            />
          ) : (
            adminReviews.map((review) => (
              <AdminReviewRow
                key={review.id}
                review={review}
                salon={salonById[review.salon_id]}
                onToggleActive={() => void toggleActive(review)}
                onRequestDelete={() => void requestDelete(review)}
              />
            ))
          )}
        </View>
      </ScrollView>
    </PageShell>
  );
}

function AdminReviewRow({
  review,
  salon,
  onToggleActive,
  onRequestDelete,
}: {
  review: Review;
  salon: Salon | undefined;
  onToggleActive: () => void;
  onRequestDelete: () => void;
}) {
  const { t } = useNaturals();
  const stars = ratingStars(review.rating);
  return (
    <Card style={{ marginBottom: 10 }}>
      <View style={{ padding: 14, gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Body size={12.5} weight="700" color={t.ink} numberOfLines={1}>
              {review.customer_name ?? "A customer"}
            </Body>
            <Body size={11} color={t.muted} style={{ marginTop: 1 }}>
              {salon ? `${salon.name} · ${salon.city}` : "Branch unavailable"}
              {review.service_id ? ` · service #${review.service_id}` : null}
            </Body>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            <Badge
              label={review.is_active ? "Approved" : "Hidden"}
              tone={review.is_active ? "success" : "muted"}
              icon={review.is_active ? "checkmark-circle" : "eye-off-outline"}
            />
            <Badge label={ratingLabelShort(review.rating)} tone="primary" icon="star-outline" />
          </View>
        </View>
        {stars ? (
          <View style={{ flexDirection: "row", gap: 3 }}>
            {[...Array(stars.filled)].map((_, index) => (
              <Body key={index} size={16} color="#F5A623">
                ★
              </Body>
            ))}
            {[...Array(stars.empty)].map((_, index) => (
              <Body key={index} size={16} color={t.border}>
                ☆
              </Body>
            ))}
          </View>
        ) : null}
        {review.title ? (
          <Body size={12} weight="600" color={t.inkSoft} style={{ marginTop: 5 }}>
            {review.title}
          </Body>
        ) : null}
        {review.comment ? (
          <Body size={12.5} color={t.ink} style={{ marginTop: 4, lineHeight: 20 }}>
            {review.comment}
          </Body>
        ) : null}
        <Body size={11} color={t.muted} style={{ marginTop: 6 }}>
          {formatReviewDate(review.created_at)}
        </Body>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
          <Button
            title={review.is_active ? "Hide review" : "Approve review"}
            small
            kind={review.is_active ? "danger" : "primary"}
            onPress={onToggleActive}
          />
          <Button title="Delete" small kind="ghost" onPress={onRequestDelete} icon="trash-outline" />
        </View>
      </View>
    </Card>
  );
}

function ratingLabelShort(rating: number) {
  return rating.toFixed(1);
}
