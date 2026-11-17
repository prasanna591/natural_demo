import { Platform } from "react-native";
import { demoRequest } from "./demo/router";

function normalise(value: string | undefined): string {
  return (value ?? "").trim().replace(/\/$/, "");
}

const sharedUrl = normalise(process.env.EXPO_PUBLIC_API_URL);
const androidUrl = normalise(process.env.EXPO_PUBLIC_API_URL_ANDROID);

// Android builds must not fall back to the development machine's localhost:
// on a device/emulator that address is the device itself. Emulator builds can
// reach the host through 10.0.2.2. Production builds should set
// EXPO_PUBLIC_API_URL_ANDROID to the public HTTPS API before bundling.
const localUrlPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i;
const androidConfigured = androidUrl || (sharedUrl && !localUrlPattern.test(sharedUrl) ? sharedUrl : "");
const fallbackUrl = Platform.OS === "android" ? "http://10.0.2.2:8000" : "http://localhost:8000";

export const API_URL = (Platform.OS === "android" ? androidConfigured : sharedUrl) || fallbackUrl;

/** When set to "online" the real fetch transport is used. Anything else (default)
 * routes every request through the in-app offline demo layer. */
export const DEMO_MODE = process.env.EXPO_PUBLIC_DEMO_MODE !== "online";

/** Error thrown for non-2xx API responses. Carries the HTTP status so callers
 * can distinguish an invalid/expired session (401/403) from a network outage. */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function request<T>(path: string, token: string | null, init: RequestInit = {}): Promise<T> {
  if (DEMO_MODE) {
    const method = (init.method || "GET").toUpperCase();
    try {
      return Promise.resolve(demoRequest(method, path, token, init) as unknown as T);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  if (init.headers) {
    const extra = init.headers as Record<string, string>;
    Object.entries(extra).forEach(([key, value]) => {
      if (isFormData && key.toLowerCase() === "content-type") return;
      headers[key] = value;
    });
  }
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  })
    .then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = (data as { detail?: unknown }).detail;
        throw new ApiError(
          typeof detail === "string" ? detail : `Request failed (${response.status}).`,
          response.status,
        );
      }
      return data as T;
    })
    .catch((error: unknown) => {
      if (error instanceof ApiError) throw error;
      // fetch() rejects with a TypeError when the device is offline, DNS fails,
      // or the API is unreachable. Status 0 marks a transport failure.
      throw new ApiError(
        "Cannot reach Naturals right now. Check your internet connection and try again.",
        0,
      );
    });
}
