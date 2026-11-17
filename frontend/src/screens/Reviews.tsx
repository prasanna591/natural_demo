import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useNaturals } from "../context";
import { PageShell } from "../layout";
import { Badge, Body, Button, Card, Display, EmptyState, Eyebrow, Field } from "../ui";
import { formatReviewDate, ratingLabel, ratingStars, type Review } from "../api";

export function ReviewsScreen() {
  const {
    t,
    bp,
    user,
    token,
    salonId,
    selectedSalon,
    reviews,
    reviewSummary,
    userReview,
    reviewsLoading,
    loadReviews,
    addReview,
    updateReview,
    deleteReview,
    ask,
  } = useNaturals();

  const [draftRating, setDraftRating] = useState<number | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftComment, setDraftComment] = useState("");
  const [reviewError, setReviewLocalError] = useState("");

  useEffect(() => {
    if (salonId) void loadReviews(salonId);
  }, [salonId, loadReviews]);

  const stars = useMemo(() => ratingStars(reviewSummary?.average_rating ?? null), [
    reviewSummary?.average_rating,
  ]);

  const canReview = Boolean(user && token && salonId);
  const alreadyReviewed = Boolean(userReview);

  const submitReview = useCallback(async () => {
    if (!canReview) return;
    if (!draftRating) {
      setReviewLocalError("Choose a rating between 1 and 5 stars.");
      return;
    }
    setReviewLocalError("");
    try {
      await addReview({
        salon_id: salonId!,
        rating: draftRating,
        title: draftTitle.trim() || null,
        comment: draftComment.trim() || null,
      });
      setDraftRating(null);
      setDraftTitle("");
      setDraftComment("");
    } catch {
      /* addReview reports errors through the shared error state. */
    }
  }, [canReview, salonId, draftRating, draftTitle, draftComment, addReview]);

  const updateMyReview = useCallback(async () => {
    if (!userReview || !draftRating) return;
    setReviewLocalError("");
    try {
      await updateReview(userReview.id, {
        rating: draftRating,
        title: draftTitle.trim() || null,
        comment: draftComment.trim() || null,
      });
      setDraftRating(null);
      setDraftTitle("");
      setDraftComment("");
    } catch {
      /* updateReview reports errors through the shared error state. */
    }
  }, [userReview, draftRating, draftTitle, draftComment, updateReview]);

  const removeMyReview = useCallback(async () => {
    if (!userReview) return;
    ask({
      title: "Remove your review?",
      message: "Your rating and comment for this branch will be deleted. This cannot be undone.",
      confirmLabel: "Remove review",
      cancelLabel: "Keep it",
      destructive: true,
      onConfirm: () => {
        void (async () => {
          try {
            await deleteReview(userReview.id);
            setDraftRating(null);
            setDraftTitle("");
            setDraftComment("");
          } catch {
            /* deleteReview reports errors through the shared error state. */
          }
        })();
      },
    });
  }, [userReview, deleteReview, ask]);

  return (
    <PageShell>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: bp.isMobile ? 24 : 0 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingTop: bp.isMobile ? 20 : 40 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
            <View>
              <Eyebrow>Reviews &amp; ratings</Eyebrow>
              <Display size={bp.isMobile ? 30 : 40} style={{ marginTop: 2 }}>
                {selectedSalon ? selectedSalon.name : "Reviews"}
              </Display>
              <Body size={12} color={t.muted} style={{ marginTop: 6, maxWidth: 620 }}>
                Share your experience after a visit. Each customer can leave one review per branch, and ratings help
                others choose the right salon.
              </Body>
            </View>
            {canReview ? (
              <Button
                title={alreadyReviewed ? "Update your review" : "Add your review"}
                small
                onPress={() => {
                  if (alreadyReviewed && userReview) {
                    setDraftRating(userReview.rating);
                    setDraftTitle(userReview.title ?? "");
                    setDraftComment(userReview.comment ?? "");
                  } else {
                    setDraftRating(null);
                    setDraftTitle("");
                    setDraftComment("");
                  }
                }}
                icon="create-outline"
              />
            ) : null}
          </View>

          {/* Rating summary for the selected branch */}
          <Card style={{ marginTop: 16 }}>
            <View style={{ padding: 18, flexDirection: "row", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <View>
                {stars ? (
                  <View style={{ flexDirection: "row", gap: 4, marginBottom: 4 }}>
                    {[...Array(stars.filled)].map((_, index) => (
                      <Body key={index} size={32} color="#F5A623">
                        ★
                      </Body>
                    ))}
                    {[...Array(stars.empty)].map((_, index) => (
                      <Body key={index} size={32} color={t.border}>
                        ☆
                      </Body>
                    ))}
                  </View>
                ) : (
                  <Body size={32} color={t.muted}>☆☆☆☆☆</Body>
                )}
                <Body size={15} weight="700" color={t.ink} style={{ marginTop: 4 }}>
                  {reviewSummary?.average_rating == null ? "No reviews yet" : reviewSummary.average_rating.toFixed(1)}
                </Body>
              </View>
              <View>
                <Badge
                  label={ratingLabel(reviewSummary?.average_rating ?? null, reviewSummary?.review_count ?? 0)}
                  tone="primary"
                  icon="star-outline"
                />
                {reviewSummary?.review_count ? (
                  <Body size={11.5} color={t.muted} style={{ marginTop: 4 }}>
                    Based on {reviewSummary.review_count} customer review
                    {reviewSummary.review_count === 1 ? "" : "s"}
                  </Body>
                ) : null}
              </View>
            </View>
          </Card>

          {/* Add / edit review form */}
          {canReview && (
            <Card style={{ marginTop: 16 }}>
              <View style={{ padding: 18, gap: 14 }}>
                <Eyebrow>{alreadyReviewed ? "Update your review" : "Leave a review"}</Eyebrow>
                <Body size={12.5} color={t.muted} style={{ marginBottom: 6 }}>
                  How would you rate your visit to {selectedSalon?.name ?? "this branch"}?
                </Body>
                <View style={{ flexDirection: "row", gap: 8, justifyContent: "center", marginBottom: 10 }}>
                  {[1, 2, 3, 4, 5].map((index) => (
                    <PressableStar
                      key={index}
                      index={index}
                      active={draftRating != null && index <= draftRating}
                      onPress={() => setDraftRating(index)}
                      color={t.primary}
                    />
                  ))}
                </View>
                <Field
                  label="Title (optional)"
                  icon="create-outline"
                  value={draftTitle}
                  onChangeText={setDraftTitle}
                  placeholder="What stood out most?"
                  style={{ flex: 1 }}
                />
                <Field
                  label="Comment"
                  icon="chatbubbles-outline"
                  value={draftComment}
                  onChangeText={setDraftComment}
                  placeholder="Share what you liked and how it can improve."
                  multiline
                  style={{ flex: 1 }}
                />
                {reviewError ? <Body size={10.5} color={t.danger} style={{ marginTop: -4 }}>{reviewError}</Body> : null}
                <Button
                  title={alreadyReviewed ? "Save changes" : "Post review"}
                  full
                  onPress={alreadyReviewed ? updateMyReview : submitReview}
                  disabled={!draftRating}
                  icon="send-outline"
                />
                {alreadyReviewed ? (
                  <Button title="Remove your review" small kind="danger" onPress={removeMyReview} icon="trash-outline" />
                ) : null}
              </View>
            </Card>
          )}

          {/* Existing reviews */}
          <View style={{ marginTop: 18 }}>
            <Eyebrow>Customer reviews</Eyebrow>
            {reviewsLoading ? (
              <View style={{ padding: 26, alignItems: "center" }}>
                <Body size={12} color={t.muted}>Loading reviews…</Body>
              </View>
            ) : reviews.length === 0 ? (
              <EmptyState
                icon="chatbubbles-outline"
                title="No reviews yet"
                message={canReview ? "Be the first to review this branch." : "Sign in to leave a review."}
              />
            ) : (
              reviews.map((review) => (
                <ReviewRow key={review.id} review={review} />
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </PageShell>
  );
}

function PressableStar({
  index,
  active,
  onPress,
  color,
}: {
  index: number;
  active: boolean;
  onPress: () => void;
  color: string;
}) {
  const { t } = useNaturals();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Rate ${index} stars`}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{ minHeight: 44, justifyContent: "center" }}
    >
      <Body size={26} color={active ? color : t.muted}>
        ★
      </Body>
    </Pressable>
  );
}

function ReviewRow({ review }: { review: Review }) {
  const { t } = useNaturals();
  const stars = ratingStars(review.rating);
  return (
    <Card style={{ marginBottom: 10, overflow: "hidden" }}>
      <View style={{ padding: 14, gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Body size={12.5} weight="700" color={t.ink} numberOfLines={1}>
              {review.customer_name ?? "A customer"}
            </Body>
            <Body size={11} color={t.muted} style={{ marginTop: 1 }}>
              {formatReviewDate(review.created_at)}
            </Body>
          </View>
          <Badge
            label={ratingLabel(review.rating, 1)}
            tone="primary"
            icon="star-outline"
          />
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
      </View>
    </Card>
  );
}
