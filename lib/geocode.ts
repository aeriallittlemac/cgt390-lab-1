// Client-side helpers that call our internal /api/geocode proxy (which in turn
// talks to Nominatim). Keeping Nominatim behind our own route lets us cache,
// set a proper User-Agent, and stay within the usage policy. See PLAN.md s.8.

export interface GeocodeResult {
  label: string;
  lat: number;
  lng: number;
}

export async function searchAddress(query: string): Promise<GeocodeResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
  if (!res.ok) return [];
  return (await res.json()) as GeocodeResult[];
}

export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<GeocodeResult | null> {
  const res = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`);
  if (!res.ok) return null;
  const data = (await res.json()) as GeocodeResult[];
  return data[0] ?? null;
}
