import type { NextRequest } from "next/server";
import type { GeocodeResult } from "@/lib/geocode";

// Proxy to Nominatim (OpenStreetMap). Keeping it server-side lets us set a
// proper User-Agent, add a short-lived cache, and stay within the usage policy:
// https://operations.osmfoundation.org/policies/nominatim/
//
// Set NOMINATIM_CONTACT in the environment to a contact URL or email so the
// operators can reach you if your traffic misbehaves.

const NOMINATIM = "https://nominatim.openstreetmap.org";
const CONTACT = process.env.NOMINATIM_CONTACT ?? "dev@example.com";
const USER_AGENT = `slice-society-scaffold (${CONTACT})`;

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const cache = new Map<string, { at: number; data: GeocodeResult[] }>();

interface NominatimItem {
  display_name: string;
  lat: string;
  lon: string;
}

function toResults(items: NominatimItem[]): GeocodeResult[] {
  return items.map((it) => ({
    label: it.display_name,
    lat: Number(it.lat),
    lng: Number(it.lon),
  }));
}

async function fetchNominatim(path: string): Promise<GeocodeResult[]> {
  const cached = cache.get(path);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data;

  const res = await fetch(`${NOMINATIM}${path}`, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "en" },
  });
  if (!res.ok) return [];

  const json = await res.json();
  const data = toResults(Array.isArray(json) ? json : [json]);
  cache.set(path, { at: Date.now(), data });
  return data;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q");
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  try {
    if (lat && lng) {
      const data = await fetchNominatim(
        `/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`,
      );
      return Response.json(data);
    }
    if (q && q.trim().length >= 3) {
      const data = await fetchNominatim(
        `/search?format=jsonv2&addressdetails=0&limit=5&q=${encodeURIComponent(q)}`,
      );
      return Response.json(data);
    }
    return Response.json([]);
  } catch {
    return Response.json([], { status: 502 });
  }
}
