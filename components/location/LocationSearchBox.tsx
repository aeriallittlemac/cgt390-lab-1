"use client";

import { useEffect, useRef, useState } from "react";
import { searchAddress, reverseGeocode, type GeocodeResult } from "@/lib/geocode";

interface Props {
  onPick: (result: GeocodeResult) => void;
}

export function LocationSearchBox({ onPick }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (query.trim().length < 3) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      setLoading(true);
      try {
        setResults(await searchAddress(query));
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query]);

  function handleQueryChange(value: string) {
    setQuery(value);
    if (value.trim().length < 3) setResults([]);
  }

  function useMyLocation() {
    setGeoError(null);
    if (!("geolocation" in navigator)) {
      setGeoError("Geolocation isn't available in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const rev = await reverseGeocode(latitude, longitude);
        onPick(
          rev ?? {
            label: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
            lat: latitude,
            lng: longitude,
          },
        );
      },
      () => setGeoError("Couldn't get your location. Try searching instead."),
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }

  return (
    <div className="space-y-2">
      <label htmlFor="loc-search" className="sr-only">
        Search for an address
      </label>
      <input
        id="loc-search"
        type="text"
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
        placeholder="Enter your address or area"
        autoComplete="off"
        className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/30 dark:border-zinc-700 dark:bg-zinc-950"
      />

      <button
        type="button"
        onClick={useMyLocation}
        className="flex items-center gap-2 text-sm font-medium text-red-600 hover:underline"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path
            d="M8 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-3v2m0 10v2m7-7h-2M3 8H1"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
        Use my current location
      </button>

      {geoError && <p className="text-sm text-amber-600">{geoError}</p>}
      {loading && <p className="text-sm text-zinc-500">Searching…</p>}

      {results.length > 0 && (
        <ul className="divide-y divide-zinc-100 overflow-hidden rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {results.map((r, i) => (
            <li key={`${r.lat}-${r.lng}-${i}`}>
              <button
                type="button"
                onClick={() => {
                  onPick(r);
                  setQuery(r.label);
                  setResults([]);
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
