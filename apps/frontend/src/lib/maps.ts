import type { LocationPin } from "@everafter/shared-types";

export function mapsUrl(location?: string, pin?: LocationPin | null) {
  const query = pin ? `${pin.lat},${pin.lng}` : location?.trim();
  return query
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
    : undefined;
}

declare global {
  interface Window {
    __everAfterMapsReady?: () => void;
    gm_authFailure?: () => void;
  }
}

let mapsPromise: Promise<void> | undefined;
export function loadGoogleMaps() {
  if (typeof window !== "undefined" && typeof (window as any).google?.maps?.importLibrary === "function")
    return Promise.resolve();
  if (mapsPromise) return mapsPromise;
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) return Promise.reject(new Error("Map selection is unavailable. Enter coordinates or use your current location."));
  mapsPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    const timer = window.setTimeout(() => fail(), 20000);
    function fail() {
      window.clearTimeout(timer);
      script.remove();
      mapsPromise = undefined;
      reject(new Error("Google Maps could not load. Try again or enter coordinates."));
    }
    window.__everAfterMapsReady = () => {
      window.clearTimeout(timer);
      resolve();
    };
    window.gm_authFailure = () => {
      window.dispatchEvent(new Event("everafter-maps-error"));
      fail();
    };
    script.src = `https://maps.googleapis.com/maps/api/js?${new URLSearchParams({
      key, v: "weekly", loading: "async", callback: "__everAfterMapsReady",
    })}`;
    script.async = true;
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return mapsPromise;
}
