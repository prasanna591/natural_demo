import React, { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { useNaturals } from "../../context";
import type { PageContent } from "../../api";
import { Badge, Body, Button, Card, Chip, Display, EmptyState, Eyebrow, Field, LoadingBlock } from "../../ui";
import { MediaPicker } from "./MediaPicker";

const GROUP_LABELS: Record<string, string> = {
  hero: "Hero",
  edit: "The edit",
  categories: "Categories",
  salons: "Branches",
  team: "Team",
  promise: "Promise",
  cta: "Closing call to action",
  footer: "Footer",
};

function groupKey(key: string) {
  const parts = key.split(".");
  return parts[1] ?? "general";
}

function fieldLabel(key: string) {
  const parts = key.split(".");
  const audience = parts[parts.length - 1];
  const field = parts.length > 2 ? parts[parts.length - 2] : parts[parts.length - 1];
  const pretty = field.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  if (audience === "women" || audience === "men") {
    return `${pretty} · ${audience === "women" ? "Women" : "Men"}`;
  }
  return pretty;
}

export function ContentScreen() {
  const {
    t,
    bp,
    content,
    contentLoading,
    loadContent,
    saveContent,
    adminSettings,
    adminSettingsLoading,
    loadAdminSettings,
    saveAdminSettings,
    busy,
  } = useNaturals();

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [settings, setSettings] = useState(adminSettings);

  useEffect(() => {
    const next: Record<string, string> = {};
    content.forEach((item) => {
      next[item.key] = item.value;
    });
    setDrafts(next);
  }, [content]);

  useEffect(() => {
    setSettings(adminSettings);
  }, [adminSettings]);

  const groups = useMemo(() => {
    const map = new Map<string, PageContent[]>();
    content.forEach((item) => {
      const key = item.key.startsWith("site.") ? "footer" : groupKey(item.key);
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    });
    return Array.from(map.entries());
  }, [content]);

  const bannerEnabled = settings.promo_banner_enabled === "true";

  const submitSettings = () => {
    void saveAdminSettings({
      promo_banner_enabled: bannerEnabled ? "true" : "false",
      promo_banner_title: settings.promo_banner_title,
      promo_banner_message: settings.promo_banner_message,
      promo_banner_cta: settings.promo_banner_cta,
    });
  };

  return (
    <View style={{ paddingTop: 24 }}>
      <Eyebrow>Homepage text, images & promotional banner</Eyebrow>
      <Display size={bp.isMobile ? 30 : 40} style={{ marginTop: 4 }}>
        Content
      </Display>
      <Body size={12.5} color={t.muted} style={{ marginTop: 8 }}>
        Edit the copy and imagery customers see on the home page, plus the promotional banner shown across the app.
      </Body>

      <Card style={{ marginTop: 18 }}>
        <View style={{ padding: 16, gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <View>
              <Eyebrow>Promotional banner</Eyebrow>
              <Display size={22} style={{ marginTop: 4 }}>App-wide announcement</Display>
            </View>
            <Badge label={bannerEnabled ? "enabled" : "disabled"} tone={bannerEnabled ? "success" : "muted"} />
          </View>

          <View style={{ flexDirection: "row", gap: 8 }}>
            <Chip label="Enabled" selected={bannerEnabled} onPress={() => setSettings((current) => ({ ...current, promo_banner_enabled: "true" }))} />
            <Chip label="Disabled" selected={!bannerEnabled} onPress={() => setSettings((current) => ({ ...current, promo_banner_enabled: "false" }))} />
          </View>

          <View style={{ flexDirection: bp.isDesktop ? "row" : "column", gap: 12 }}>
            <Field
              label="Banner title"
              value={settings.promo_banner_title}
              onChangeText={(value) => setSettings((current) => ({ ...current, promo_banner_title: value }))}
              placeholder="Limited-time offer"
              style={{ flex: 1 }}
            />
            <Field
              label="Banner CTA"
              value={settings.promo_banner_cta}
              onChangeText={(value) => setSettings((current) => ({ ...current, promo_banner_cta: value }))}
              placeholder="Book now"
              style={{ flex: 1 }}
            />
          </View>
          <Field
            label="Banner message"
            value={settings.promo_banner_message}
            onChangeText={(value) => setSettings((current) => ({ ...current, promo_banner_message: value }))}
            placeholder="Describe the announcement"
            multiline
          />

          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <Button title="Save banner" small onPress={submitSettings} loading={busy} icon="save-outline" />
            <Button title="Reload" small kind="outline" onPress={() => void loadAdminSettings()} loading={adminSettingsLoading} icon="refresh-outline" />
          </View>
        </View>
      </Card>

      <View style={{ flexDirection: "row", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
        <Button title="Refresh content" small kind="outline" onPress={() => void loadContent()} icon="refresh-outline" />
        <Body size={11} color={t.muted} style={{ alignSelf: "center" }}>{content.length} content keys</Body>
      </View>

      <View style={{ marginTop: 14 }}>
        {contentLoading && content.length === 0 ? (
          <LoadingBlock label="Loading content…" />
        ) : content.length === 0 ? (
          <EmptyState icon="document-text-outline" title="No content" message="Content defaults are seeded by the backend." actionLabel="Reload" onAction={() => void loadContent()} />
        ) : (
          <View style={{ gap: 16 }}>
            {groups.map(([group, items]) => (
              <Card key={group}>
                <View style={{ padding: 16, gap: 10 }}>
                  <Eyebrow>{GROUP_LABELS[group] ?? group}</Eyebrow>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
                    {items.map((item) => {
                      const draft = drafts[item.key] ?? item.value;
                      const isImage = item.content_type === "image" || item.key.endsWith(".image.women") || item.key.endsWith(".image.men");
                      const multiline = draft.length > 90;
                      return (
                        <View key={item.key} style={{ flexGrow: 1, flexBasis: bp.isMobile ? "100%" : "46%", minWidth: bp.isMobile ? "100%" : 280 }}>
                          {isImage ? (
                            <MediaPicker
                              label={fieldLabel(item.key)}
                              value={draft}
                              onChange={(value) => setDrafts((current) => ({ ...current, [item.key]: value }))}
                              category="content"
                              height={120}
                            />
                          ) : (
                            <Field
                              label={fieldLabel(item.key)}
                              value={draft}
                              onChangeText={(value) => setDrafts((current) => ({ ...current, [item.key]: value }))}
                              multiline={multiline}
                            />
                          )}
                          <View style={{ flexDirection: "row", gap: 6, alignItems: "center", marginTop: isImage ? -6 : 0, marginBottom: 10 }}>
                            <Button title="Save" small onPress={() => void saveContent(item.key, drafts[item.key] ?? item.value, item.content_type)} icon="save-outline" />
                            <Body size={9} color={t.muted} numberOfLines={1} style={{ flex: 1 }}>{item.key}</Body>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}
