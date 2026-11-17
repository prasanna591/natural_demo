import React, { useMemo, useState } from "react";
import { Platform, View } from "react-native";
import { useNaturals } from "../../context";
import { buildImageUrl, type MediaFile, type UploadFile } from "../../api";
import { pickImageWithPrompt } from "../../imagePicker";
import { Badge, Body, Button, Card, Chip, Display, EmptyState, Eyebrow, Img, LoadingBlock } from "../../ui";

const CATEGORIES = ["general", "service", "salon", "campaign", "content"];

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaScreen() {
  const {
    t,
    bp,
    media,
    mediaLoading,
    mediaCategory,
    setMediaCategory,
    uploadMediaFile,
    replaceMediaFile,
    removeMedia,
    loadMedia,
    ask,
    notify,
  } = useNaturals();

  const [filter, setFilter] = useState("all");
  const [uploading, setUploading] = useState(false);
  const [replacingId, setReplacingId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    if (filter === "all") return media;
    return media.filter((item) => item.category === filter);
  }, [media, filter]);

  const chooseFile = async (onFile: (file: UploadFile) => void) => {
    try {
      if (Platform.OS === "web") {
        const doc = (globalThis as unknown as { document?: any }).document;
        if (!doc) return;
        const input = doc.createElement("input");
        input.type = "file";
        input.accept = "image/jpeg,image/png,image/webp";
        input.onchange = () => {
          const file: File | undefined = input.files?.[0];
          if (file) onFile(file);
        };
        input.click();
        return;
      }
      const file = await pickImageWithPrompt();
      if (file) onFile(file);
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : "The image picker could not be opened.", "error");
    }
  };

  const startUpload = () => {
    void chooseFile(async (file) => {
      setUploading(true);
      await uploadMediaFile(file, mediaCategory);
      setUploading(false);
    });
  };

  const startReplace = (item: MediaFile) => {
    void chooseFile(async (file) => {
      setReplacingId(item.id);
      await replaceMediaFile(item.id, file, item.category);
      setReplacingId(null);
    });
  };

  const copyUrl = async (item: MediaFile) => {
    const url = buildImageUrl(item.url);
    const clipboard = (globalThis as unknown as { navigator?: { clipboard?: { writeText: (text: string) => Promise<void> } } }).navigator?.clipboard;
    if (!clipboard) {
      notify(url, "success");
      return;
    }
    await clipboard.writeText(url);
    notify("Image URL copied.");
  };

  const confirmDelete = (item: MediaFile) => {
    ask({
      title: "Delete image?",
      message: `Delete "${item.original_name}"? Any service, branch or campaign using it will have the image reference cleared.`,
      confirmLabel: "Delete image",
      cancelLabel: "Keep it",
      destructive: true,
      onConfirm: () => {
        void removeMedia(item.id);
      },
    });
  };

  return (
    <View style={{ paddingTop: 24 }}>
      <Eyebrow>Image library</Eyebrow>
      <Display size={bp.isMobile ? 30 : 40} style={{ marginTop: 4 }}>
        Media
      </Display>
      <Body size={12.5} color={t.muted} style={{ marginTop: 8 }}>
        Upload JPG, PNG or WebP images, replace them in place and reuse the URLs across services, branches, campaigns and CMS.
      </Body>

      <Card style={{ marginTop: 18 }}>
        <View style={{ padding: 16, gap: 12 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <Body size={10} weight="700" color={t.muted} style={{ letterSpacing: 1, textTransform: "uppercase", marginRight: 4 }}>
              Upload category
            </Body>
            {CATEGORIES.map((category) => (
              <Chip key={category} label={category} selected={mediaCategory === category} onPress={() => setMediaCategory(category)} />
            ))}
          </View>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <Button title={uploading ? "Uploading…" : "Upload image"} small onPress={startUpload} loading={uploading} icon="cloud-upload-outline" />
            <Button title="Refresh" small kind="outline" onPress={() => void loadMedia()} icon="refresh-outline" />
          </View>
        </View>
      </Card>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 18 }}>
        <Body size={10} weight="700" color={t.muted} style={{ letterSpacing: 1, textTransform: "uppercase", marginRight: 4 }}>
          Filter
        </Body>
        <Chip label="All" selected={filter === "all"} onPress={() => setFilter("all")} />
        {CATEGORIES.map((category) => (
          <Chip key={category} label={category} selected={filter === category} onPress={() => setFilter(category)} />
        ))}
        <Body size={11} color={t.muted}>{filtered.length} images</Body>
      </View>

      <View style={{ marginTop: 14 }}>
        {mediaLoading && media.length === 0 ? (
          <LoadingBlock label="Loading media…" />
        ) : filtered.length === 0 ? (
          <EmptyState icon="image-outline" title="No images" message="Upload your first image to use it in the customer app." actionLabel="Upload" onAction={startUpload} />
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
            {filtered.map((item) => (
              <Card key={item.id} padded={false} style={{ flexGrow: 1, flexBasis: bp.isMobile ? "100%" : 0, minWidth: bp.isMobile ? "100%" : 260 }}>
                <View style={{ padding: 12, gap: 10 }}>
                  <Img uri={buildImageUrl(item.url)} height={150} label={item.original_name} />
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <Body size={11} weight="700" color={t.ink} numberOfLines={1} style={{ flex: 1 }}>
                      {item.original_name}
                    </Body>
                    <Badge label={item.category} tone="primary" />
                  </View>
                  <Body size={10} color={t.muted}>
                    {item.mime_type} · {formatBytes(item.size)}
                  </Body>
                  <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                    <Button title={replacingId === item.id ? "Replacing…" : "Replace"} small kind="outline" onPress={() => startReplace(item)} disabled={replacingId === item.id} icon="swap-horizontal-outline" />
                    <Button title="Copy URL" small kind="ghost" onPress={() => void copyUrl(item)} icon="link-outline" />
                    <Button title="Delete" small kind="danger" onPress={() => confirmDelete(item)} icon="trash-outline" />
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
