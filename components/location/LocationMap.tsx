"use client";

/**
 * Placeholder for the interactive map. PLAN.md phase 5 swaps this for
 * react-leaflet + OpenStreetMap tiles with a draggable center pin that
 * reverse-geocodes on drag end. For the scaffold it just visualizes the
 * currently selected coordinates.
 */
export function LocationMap({
  center,
}: {
  center: { lat: number; lng: number } | null;
}) {
  return (
    <div className="relative h-44 w-full overflow-hidden rounded-lg border border-zinc-200 bg-[linear-gradient(45deg,#f4f4f5_25%,transparent_25%),linear-gradient(-45deg,#f4f4f5_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f4f4f5_75%),linear-gradient(-45deg,transparent_75%,#f4f4f5_75%)] bg-[length:20px_20px] bg-[position:0_0,0_10px,10px_-10px,-10px_0] dark:border-zinc-800 dark:bg-zinc-800">
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center">
        <span aria-hidden="true" className="text-2xl">📍</span>
        <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
          {center
            ? `${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}`
            : "Search or use your location"}
        </p>
        <p className="text-[10px] uppercase tracking-wide text-zinc-400">
          Map preview — Leaflet wiring in phase 5
        </p>
      </div>
    </div>
  );
}
