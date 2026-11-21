import type { LocationPin } from "@everafter/shared-types";

export function mapsUrl(location?: string, pin?: LocationPin | null) {
  const query = pin ? `${pin.lat},${pin.lng}` : location?.trim();
  return query
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
    : undefined;
}
