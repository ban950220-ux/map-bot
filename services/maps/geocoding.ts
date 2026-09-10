import { geocode } from "@/lib/naver";
import type { Point } from "@/lib/types";
import { TtlCache } from "./cache";
const cache = new TtlCache<Point>(300000, 64);
export async function geocodeAddress(address: string, signal?: AbortSignal) {
  const normalized = address.trim();
  const cached = cache.get(normalized);
  if (cached) return cached;
  const result = await geocode(normalized, signal);
  cache.set(normalized, result); return result;
}
