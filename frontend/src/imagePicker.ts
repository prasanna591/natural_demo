import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";
import type { NativeUploadFile } from "./adminApi";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

function extensionFor(type: string, uri: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  const match = uri.match(/\.([a-z0-9]+)(?:\?|$)/i);
  return match?.[1]?.toLowerCase() || "jpg";
}

async function ensurePermission(source: "camera" | "library") {
  const result =
    source === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!result.granted) {
    throw new Error(
      source === "camera"
        ? "Camera access is required to take a photo. Enable it in Android Settings > Apps > Naturals Salon > Permissions."
        : "Photo access is required to choose an image. Enable it in Android Settings > Apps > Naturals Salon > Permissions.",
    );
  }
}

/**
 * Opens the Android gallery or camera and returns an upload descriptor that the
 * backend's multipart endpoint understands. Web keeps using its file input.
 */
export async function pickImage(source: "camera" | "library"): Promise<NativeUploadFile | null> {
  await ensurePermission(source);

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ["images"],
    allowsEditing: false,
    quality: 0.85,
    exif: false,
  };

  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

  if (result.canceled || !result.assets?.length) return null;

  const asset = result.assets[0];
  const type = (asset.mimeType || "image/jpeg").toLowerCase();
  if (!ALLOWED_TYPES.has(type)) {
    throw new Error("Only JPG, JPEG, PNG and WebP images are supported.");
  }
  if (asset.fileSize && asset.fileSize > MAX_IMAGE_BYTES) {
    throw new Error("This image is larger than 10 MB. Choose a smaller image.");
  }

  const name = asset.fileName || `naturals-${Date.now()}.${extensionFor(type, asset.uri)}`;
  return { uri: asset.uri, name, type: type === "image/jpg" ? "image/jpeg" : type, size: asset.fileSize };
}

/** Shows the gallery/camera choice used by the admin media pickers. */
export function pickImageWithPrompt(): Promise<NativeUploadFile | null> {
  return new Promise((resolve, reject) => {
    Alert.alert(
      "Add an image",
      "Choose where the image comes from.",
      [
        {
          text: "Take a photo",
          onPress: () => {
            pickImage("camera").then(resolve, reject);
          },
        },
        {
          text: "Choose from gallery",
          onPress: () => {
            pickImage("library").then(resolve, reject);
          },
        },
        { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
      ],
      { cancelable: true, onDismiss: () => resolve(null) },
    );
  });
}
