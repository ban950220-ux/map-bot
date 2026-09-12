import { geocode, MapsError } from "@/lib/naver";
import type { OriginSelection, Point } from "@/lib/types";
import { TtlCache } from "./cache";
import { searchOriginPlaces } from "./placeSearch";
const cache = new TtlCache<Point | OriginSelection>(300000, 64);
export async function geocodeAddress(address: string, signal?: AbortSignal) {
  const normalized = address.trim();
  const cached = cache.get(normalized);
  if (cached) return cached;
  let result: Point | OriginSelection;
  try { result = await geocode(normalized, signal); }
  catch (error) {
    if (!(error instanceof MapsError) || error.status !== 422) throw error;
    const candidates = await searchOriginPlaces(normalized, signal);
    result = candidates.length === 1 ? { x: candidates[0].x, y: candidates[0].y, address: `${candidates[0].name} · ${candidates[0].address}` } : { needsSelection: true, query: normalized, candidates };
  }
  cache.set(normalized, result); return result;
}
