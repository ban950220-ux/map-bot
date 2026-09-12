import { geocode, MapsError } from "@/lib/naver";
import type { Point } from "@/lib/types";
import { TtlCache } from "./cache";
import { searchOriginPlace } from "./placeSearch";
const cache = new TtlCache<Point>(300000, 64);
export async function geocodeAddress(address: string, signal?: AbortSignal) {
  const normalized = address.trim();
  const cached = cache.get(normalized);
  if (cached) return cached;
  let result: Point;
  try { result = await geocode(normalized, signal); }
  catch (error) {
    if (!(error instanceof MapsError) || error.status !== 422) throw error;
    result = await searchOriginPlace(normalized, signal);
  }
  cache.set(normalized, result); return result;
}
