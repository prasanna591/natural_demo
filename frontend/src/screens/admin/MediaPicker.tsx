import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { buildImageUrl } from "../../api";
import { useNaturals } from "../../context";
import { pickImageWithPrompt } from "../../imagePicker";
import { Body, Button, Field, Img } from "../../ui";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const ALLOWED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

function validateImageFile(file: File): string {
  const name = (file.name || "").toLowerCase();
  const hasAllowedExtension = ALLOWED_IMAGE_EXTENSIONS.some((extension) => name.endsWith(extension));
  if (file.type && !ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return "Only JPG, JPEG, PNG and WebP images are supported.";
  }
  if (!file.type && !hasAllowedExtension) {
    return "Only JPG, JPEG, PNG and WebP images are supported.";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return "This image is larger than 10 MB. Choose a smaller file.";
  }
  return "";
}

/**
 * Image field used across the admin dashboard.
 * On web it opens a real file picker and uploads to /admin/media/upload.
 * On native (or when an image already lives elsewhere) a URL can be typed directly.
 */
export function MediaPicker({
  value,
  onChange,
  category = "general",
  label = "Image",
  height = 150,
}: {
  value: string;
  onChange: (value: string) => void;
  category?: string;
  label?: string;
  height?: number;
}) {
  const { t, uploadMediaFile, notify } = useNaturals();
  const [url, setUrl] = useState(value);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setUrl(value);
  }, [value]);

  const upload = async (file: File | Awaited<ReturnType<typeof pickImageWithPrompt>>) => {
    if (!file) return;
    if (Platform.OS === "web") {
      const validation = validateImageFile(file as File);
      if (validation) {
        setError(validation);
        notify(validation, "error");
        return;
      }
    }
    setError("");
    setUploading(true);
    try {
      const media = await uploadMediaFile(file, category);
      if (media) {
        setUrl(media.url);
        onChange(media.url);
      } else {
        setError("The upload did not finish. Check the file and try again.");
      }
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "The image could not be uploaded.";
      setError(message);
      notify(message, "error");
    } finally {
      setUploading(false);
    }
  };

  const chooseFile = async () => {
    if (Platform.OS !== "web") {
      try {
        await upload(await pickImageWithPrompt());
      } catch (reason) {
        const message = reason instanceof Error ? reason.message : "The image picker could not be opened.";
        setError(message);
        notify(message, "error");
      }
      return;
    }
    const doc = (globalThis as unknown as { document?: any }).document;
    if (!doc) return;
    const input = doc.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/jpg,image/png,image/webp";
    input.onchange = () => {
      const file: File | undefined = input.files?.[0];
      if (file) void upload(file);
    };
    input.click();
  };

  const preview = buildImageUrl(url);

  return (
    <View style={{ marginBottom: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
        <Body size={11} weight="700" color={t.inkSoft} style={{ letterSpacing: 0.8, textTransform: "uppercase" }}>
          {label}
        </Body>
        <Body size={10} color={t.muted}>
          JPG, PNG or WebP · max 10 MB
        </Body>
      </View>

      {preview ? (
        <Img uri={preview} height={height} label={label} style={{ marginBottom: 10 }} />
      ) : (
        <View
          style={{
            height,
            borderRadius: 16,
            borderWidth: 1,
            borderStyle: "dashed",
            borderColor: error ? t.danger : t.borderStrong,
            backgroundColor: t.surfaceAlt,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 10,
          }}
        >
          <Body size={11} color={t.muted}>
            {uploading ? "Uploading image…" : "No image selected"}
          </Body>
        </View>
      )}

      {error ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <Ionicons name="alert-circle-outline" size={13} color={t.danger} />
          <Body size={10.5} color={t.danger}>
            {error}
          </Body>
        </View>
      ) : null}

      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Button
          title={uploading ? "Uploading…" : url ? "Replace image" : "Upload image"}
          small
          kind="outline"
          onPress={chooseFile}
          disabled={uploading}
          icon="cloud-upload-outline"
        />
        {url ? (
          <Button
            title="Remove"
            small
            kind="ghost"
            onPress={() => {
              setUrl("");
              setError("");
              onChange("");
            }}
            icon="trash-outline"
          />
        ) : null}
      </View>

      <Field
        label="Or paste an image URL"
        value={url}
        onChangeText={(text) => {
          setUrl(text);
          onChange(text);
        }}
        placeholder="/media/uploads/example.jpg or https://…"
        autoCapitalize="none"
        style={{ marginTop: 12, marginBottom: 0 }}
      />
    </View>
  );
}
