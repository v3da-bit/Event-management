"use client";

import { useEffect, useRef, useState } from "react";
import { LocateFixed, MapPin, Search } from "lucide-react";
import type { LocationPin } from "@everafter/shared-types";
import { loadGoogleMaps, mapsUrl } from "@/lib/maps";
import { Button } from "./ui/button";

export function LocationLink({ location, pin }: { location?: string; pin?: LocationPin | null }) {
  const href = mapsUrl(location, pin);
  return href ? (
    <a className="text-link location-link" href={href} target="_blank" rel="noopener noreferrer">
      <MapPin size={15} aria-hidden="true" /> {location || "Pinned location"} · Open Google Maps
    </a>
  ) : null;
}

export function LocationPicker({ location, pin, onChange }: {
  location: string;
  pin?: LocationPin | null;
  onChange: (location: string, pin: LocationPin | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [results, setResults] = useState<google.maps.GeocoderResult[]>([]);
  const [coords, setCoords] = useState({ lat: pin?.lat.toString() || "", lng: pin?.lng.toString() || "" });
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const marker = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const latest = useRef({ location, pin, onChange });
  latest.current = { location, pin, onChange };
  const searchSequence = useRef(0);

  useEffect(() => {
    setCoords({ lat: pin?.lat.toString() || "", lng: pin?.lng.toString() || "" });
    if (marker.current) marker.current.position = pin || null;
    if (pin && map.current) {
      map.current.panTo(pin);
      if ((map.current.getZoom() || 0) < 14) map.current.setZoom(16);
    }
  }, [pin?.lat, pin?.lng]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let click: google.maps.MapsEventListener | undefined;
    let drag: google.maps.MapsEventListener | undefined;
    const failed = () => setError("Google Maps is unavailable. You can still enter coordinates or use your current location.");
    window.addEventListener("everafter-maps-error", failed);
    setLoading(true);
    setError("");
    void (async () => {
      try {
        await loadGoogleMaps();
        const [{ Map }, { AdvancedMarkerElement }] = await Promise.all([
          google.maps.importLibrary("maps") as Promise<google.maps.MapsLibrary>,
          google.maps.importLibrary("marker") as Promise<google.maps.MarkerLibrary>,
        ]);
        if (cancelled || !host.current) return;
        const initial = latest.current.pin;
        map.current = new Map(host.current, {
          center: initial || { lat: 22.9734, lng: 78.6569 },
          zoom: initial ? 16 : 5,
          mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID",
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          gestureHandling: "cooperative",
        });
        marker.current = new AdvancedMarkerElement({
          map: map.current, position: initial || undefined,
          gmpDraggable: true, title: "Selected location; drag to move the pin",
        });
        const select = (latLng: google.maps.LatLng | null | undefined) => {
          if (latLng) latest.current.onChange(latest.current.location, { lat: latLng.lat(), lng: latLng.lng() });
        };
        click = map.current.addListener("click", (event: google.maps.MapMouseEvent) => select(event.latLng));
        drag = marker.current.addListener("dragend", (event: google.maps.MapMouseEvent) => select(event.latLng));
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      click?.remove(); drag?.remove();
      if (marker.current) marker.current.map = null;
      marker.current = null; map.current = null;
      window.removeEventListener("everafter-maps-error", failed);
    };
  }, [open]);

  async function search() {
    const request = ++searchSequence.current;
    setSearching(true); setError(""); setResults([]);
    try {
      await loadGoogleMaps();
      const { Geocoder } = await google.maps.importLibrary("geocoding") as google.maps.GeocodingLibrary;
      const response = await new Geocoder().geocode({ address: location });
      if (request === searchSequence.current) setResults(response.results.slice(0, 5));
    } catch {
      if (request === searchSequence.current) setError("No address found, or search is unavailable. Try another address or place a pin.");
    } finally {
      if (request === searchSequence.current) setSearching(false);
    }
  }

  function currentLocation() {
    if (!navigator.geolocation) { setError("Your browser does not support location access."); return; }
    setLocating(true); setError("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        latest.current.onChange(latest.current.location, { lat: coords.latitude, lng: coords.longitude });
        setLocating(false);
      },
      () => { setLocating(false); setError("Could not access your location. Allow location access or select a pin manually."); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function coordinate(field: "lat" | "lng", value: string) {
    const next = { ...coords, [field]: value };
    setCoords(next);
    if (!next.lat && !next.lng) onChange(location, null);
    else if (next.lat && next.lng && Number.isFinite(Number(next.lat)) && Number.isFinite(Number(next.lng)) &&
      Math.abs(Number(next.lat)) <= 90 && Math.abs(Number(next.lng)) <= 180)
      onChange(location, { lat: Number(next.lat), lng: Number(next.lng) });
  }

  return (
    <fieldset className="location-picker">
      <legend>Location (optional)</legend>
      <input aria-label="Location (optional)" placeholder="Address or place name" maxLength={300}
        value={location} onChange={e => {
          searchSequence.current++; setSearching(false); setResults([]);
          onChange(e.target.value, pin || null);
        }} />
      <div className="location-tools">
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(!open)}>
          <MapPin size={15} /> {open ? "Hide map" : "Choose on map"}
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={locating} onClick={currentLocation}>
          <LocateFixed size={15} /> {locating ? "Locating…" : "Use my location"}
        </Button>
        {pin && <Button type="button" variant="ghost" size="sm" onClick={() => onChange(location, null)}>Remove pin</Button>}
      </div>
      {open && <div className="map-picker-content">
        <p className="muted text-sm">Search an address, click the map, or drag the pin to choose the exact spot.</p>
        <Button type="button" variant="outline" size="sm" disabled={!location.trim() || searching || loading} onClick={search}>
          <Search size={15} /> {searching ? "Searching…" : "Find address"}
        </Button>
        {results.length > 0 && <ul className="map-search-results">{results.map((result, i) => <li key={result.place_id || i}>
          <button type="button" onClick={() => {
            onChange(result.formatted_address.slice(0, 300), result.geometry.location.toJSON()); setResults([]);
          }}>{result.formatted_address}</button>
        </li>)}</ul>}
        {loading && <p role="status">Loading map…</p>}
        <div ref={host} className="location-map" aria-label="Choose a location on Google Maps" />
      </div>}
      {error && <p role="alert" className="field-error">{error}</p>}
      <details className="coordinate-details">
        <summary>Enter coordinates</summary>
        <div className="form-row">
          <label className="field"><span>Latitude</span><input type="number" min={-90} max={90} step="any" required={!!coords.lng}
            value={coords.lat} onChange={e => coordinate("lat", e.target.value)} /></label>
          <label className="field"><span>Longitude</span><input type="number" min={-180} max={180} step="any" required={!!coords.lat}
            value={coords.lng} onChange={e => coordinate("lng", e.target.value)} /></label>
        </div>
      </details>
      {pin && <p className="muted text-sm">Pin: {pin.lat.toFixed(6)}, {pin.lng.toFixed(6)}</p>}
      <LocationLink location={location} pin={pin} />
    </fieldset>
  );
}
