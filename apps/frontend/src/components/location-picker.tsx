"use client";

import { useEffect, useRef, useState } from "react";
import { LocateFixed, MapPin, Search } from "lucide-react";
import type { LocationPin } from "@everafter/shared-types";
import type { Map as LeafletMap, Marker, LatLng } from "leaflet";
import { mapsUrl } from "@/lib/maps";
import { Button } from "./ui/button";

export function LocationLink({
  location,
  pin,
}: {
  location?: string;
  pin?: LocationPin | null;
}) {
  const href = mapsUrl(location, pin);
  return href ? (
    <a
      className="text-link location-link"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      <MapPin size={15} aria-hidden="true" /> {location || "Pinned location"} ·
      Open Google Maps
    </a>
  ) : null;
}

export function LocationPicker({
  location,
  pin,
  onChange,
}: {
  location: string;
  pin?: LocationPin | null;
  onChange: (location: string, pin: LocationPin | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mapError, setMapError] = useState("");
  const [error, setError] = useState("");
  const [locating, setLocating] = useState(false);
  const [coords, setCoords] = useState({
    lat: pin?.lat.toString() || "",
    lng: pin?.lng.toString() || "",
  });
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const latest = useRef({ location, pin, onChange });
  latest.current = { location, pin, onChange };
  const updateMarker = useRef<((pin?: LocationPin | null) => void) | null>(
    null,
  );

  useEffect(() => {
    setCoords({
      lat: pin?.lat.toString() || "",
      lng: pin?.lng.toString() || "",
    });
    updateMarker.current?.(pin);
    if (pin && map.current) {
      map.current.setView(pin, Math.max(map.current.getZoom(), 16), {
        animate: false,
      });
    }
  }, [pin?.lat, pin?.lng]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let instance: LeafletMap | undefined;
    let resize: ResizeObserver | undefined;
    setLoading(true);
    setMapError("");
    void (async () => {
      try {
        // Leaflet accesses window; load it only after mounting in the browser.
        const L = await import("leaflet");
        if (cancelled || !host.current) return;
        const initial = latest.current.pin;
        instance = L.map(host.current, { scrollWheelZoom: false }).setView(
          initial || { lat: 22.9734, lng: 78.6569 },
          initial ? 16 : 5,
        );
        map.current = instance;
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          keepBuffer: 0,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        })
          .on("tileerror", () => {
            if (!cancelled)
              setMapError(
                "Map tiles could not load. Check your connection, or use your current location or coordinates.",
              );
          })
          .addTo(instance);
        const icon = L.divIcon({
          className: "location-pin-marker",
          html: '<svg width="32" height="40" viewBox="0 0 32 40" aria-hidden="true"><path d="M16 38S2 23 2 16a14 14 0 1 1 28 0c0 7-14 22-14 22Z" fill="#557565" stroke="white" stroke-width="2"/><circle cx="16" cy="16" r="5" fill="white"/></svg>',
          iconSize: [32, 40],
          iconAnchor: [16, 38],
        });
        const select = (point: LatLng) => {
          const wrapped = point.wrap();
          latest.current.onChange(latest.current.location, {
            lat: Math.max(-90, Math.min(90, wrapped.lat)),
            lng: wrapped.lng,
          });
        };
        updateMarker.current = (value) => {
          if (!instance) return;
          if (!value) {
            marker.current?.remove();
            marker.current = null;
          } else if (marker.current) {
            marker.current.setLatLng(value);
          } else {
            const selected = L.marker(value, {
              icon,
              draggable: true,
              title: "Selected location; drag to move the pin",
              alt: "Selected location",
            }).addTo(instance);
            selected.on("dragend", () => select(selected.getLatLng()));
            marker.current = selected;
          }
        };
        updateMarker.current(latest.current.pin);
        instance.on("click", (event) => select(event.latlng));
        resize = new ResizeObserver(() =>
          instance?.invalidateSize({ pan: false }),
        );
        resize.observe(host.current);
      } catch {
        if (!cancelled)
          setMapError(
            "Map selection is unavailable. You can still enter coordinates or use your current location.",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      resize?.disconnect();
      instance?.remove();
      updateMarker.current = null;
      marker.current = null;
      map.current = null;
    };
  }, [open]);

  function currentLocation() {
    if (!navigator.geolocation) {
      setError("Your browser does not support location access.");
      return;
    }
    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        latest.current.onChange(latest.current.location, {
          lat: coords.latitude,
          lng: coords.longitude,
        });
        setLocating(false);
      },
      () => {
        setLocating(false);
        setError(
          "Could not access your location. Allow location access or select a pin manually.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function coordinate(field: "lat" | "lng", value: string) {
    const next = { ...coords, [field]: value };
    setCoords(next);
    if (!next.lat && !next.lng) onChange(location, null);
    else if (
      next.lat &&
      next.lng &&
      Number.isFinite(Number(next.lat)) &&
      Number.isFinite(Number(next.lng)) &&
      Math.abs(Number(next.lat)) <= 90 &&
      Math.abs(Number(next.lng)) <= 180
    )
      onChange(location, { lat: Number(next.lat), lng: Number(next.lng) });
  }

  return (
    <fieldset className="location-picker">
      <legend>Location (optional)</legend>
      <input
        aria-label="Location (optional)"
        placeholder="Address or place name"
        maxLength={300}
        value={location}
        onChange={(e) => {
          onChange(e.target.value, pin || null);
        }}
      />
      <div className="location-tools">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(!open)}
        >
          <MapPin size={15} /> {open ? "Hide map" : "Choose on map"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={locating}
          onClick={currentLocation}
        >
          <LocateFixed size={15} /> {locating ? "Locating…" : "Use my location"}
        </Button>
        {pin && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(location, null)}
          >
            Remove pin
          </Button>
        )}
      </div>
      {open && (
        <div className="map-picker-content">
          <p className="muted text-sm">
            Zoom to your venue and click the map to drop a pin. Drag the pin to
            adjust it.
          </p>
          {location.trim() && (
            <a
              className="text-link"
              href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(location.trim())}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Search size={15} /> Search on OpenStreetMap (opens a new tab)
            </a>
          )}
          {loading && <p role="status">Loading map…</p>}
          {mapError && (
            <p role="alert" className="field-error">
              {mapError}
            </p>
          )}
          <div
            ref={host}
            className="location-map"
            aria-label="Choose a location on OpenStreetMap"
          />
        </div>
      )}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <details
        className="coordinate-details"
        onInvalid={(event) => {
          event.currentTarget.open = true;
        }}
      >
        <summary>Enter coordinates</summary>
        <div className="form-row">
          <label className="field">
            <span>Latitude</span>
            <input
              type="number"
              min={-90}
              max={90}
              step="any"
              required={!!coords.lng}
              value={coords.lat}
              onChange={(e) => coordinate("lat", e.target.value)}
            />
          </label>
          <label className="field">
            <span>Longitude</span>
            <input
              type="number"
              min={-180}
              max={180}
              step="any"
              required={!!coords.lat}
              value={coords.lng}
              onChange={(e) => coordinate("lng", e.target.value)}
            />
          </label>
        </div>
      </details>
      {pin && (
        <p className="muted text-sm">
          Pin: {pin.lat.toFixed(6)}, {pin.lng.toFixed(6)}
        </p>
      )}
      <LocationLink location={location} pin={pin} />
    </fieldset>
  );
}
