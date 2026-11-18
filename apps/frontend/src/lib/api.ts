import type {
  User,
  WeddingEvent,
  WishlistItem,
  Participant,
  Page,
} from "@everafter/shared-types";
export type { User, WeddingEvent, WishlistItem, Participant, Page };
export const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";
let refreshing: Promise<Response> | null = null;
export async function api<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      credentials: "include",
    });
  } catch {
    throw new Error("Cannot reach the server. Check that the API is running.");
  }
  if (
    res.status === 401 &&
    retry &&
    ![
      "/auth/login",
      "/auth/register",
      "/auth/refresh",
      "/auth/logout",
    ].includes(path)
  ) {
    refreshing ||= fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    }).finally(() => {
      refreshing = null;
    });
    const refresh = await refreshing;
    if (refresh.ok) return api<T>(path, options, false);
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const error = new Error(
      Array.isArray(data.message)
        ? data.message.join(". ")
        : data.message || "Something went wrong",
    ) as Error & { status: number };
    error.status = res.status;
    throw error;
  }
  return res.json();
}
export function json(method: string, data?: unknown): RequestInit {
  return { method, ...(data ? { body: JSON.stringify(data) } : {}) };
}
export function date(
  value: string,
  timezone = "Asia/Kolkata",
  options?: Intl.DateTimeFormatOptions,
) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    ...options,
    timeZone: timezone,
  }).format(new Date(value));
}
export function progress(e: WeddingEvent) {
  return e.wishlist.length
    ? Math.round(
        (e.wishlist.filter((t) => t.isCompleted).length / e.wishlist.length) *
          100,
      )
    : 0;
}
