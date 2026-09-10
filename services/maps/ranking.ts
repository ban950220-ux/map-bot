import type { Point } from "@/lib/types";
import type { DestinationCandidate, SortMode } from "./types";
export const SEARCH_RADII = [1000, 3000, 5000, 10000, 20000, 50000, 100000, 150000, 200000] as const;
export function haversine(origin: Point, place: DestinationCandidate) {
  const rad = Math.PI / 180;
  const a = Math.sin((place.latitude - origin.y) * rad / 2) ** 2 + Math.cos(origin.y * rad) * Math.cos(place.latitude * rad) * Math.sin((place.longitude - origin.x) * rad / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
}
export function filterCandidates(items: DestinationCandidate[], origin: Point, radius: number, limit: number) {
  const ids = new Set<string>(), identities = new Set<string>();
  return items.filter(p => {
    if (![p.latitude, p.longitude].every(Number.isFinite) || p.isClosed === true) return false;
    const identity = `${p.name.replace(/\s+/g, "").toLowerCase()}:${p.latitude.toFixed(5)}:${p.longitude.toFixed(5)}`;
    if (ids.has(p.id) || identities.has(identity)) return false;
    ids.add(p.id); identities.add(identity); return true;
  }).map(p => ({ ...p, straightDistance: haversine(origin, p) })).filter(p => p.straightDistance <= radius)
    .sort((a, b) => a.straightDistance - b.straightDistance).slice(0, limit);
}
export function eta(candidate: DestinationCandidate) { return candidate.trafficDuration ?? candidate.drivingDuration; }
// Dimensionless weights; rating/reviews/opening flags are deliberately not invented.
// Future attributes can be added to this policy when a provider supplies them.
export const RECOMMEND_WEIGHTS = { time: 0.8, distance: 0.2 };
export function rankCandidates(items: DestinationCandidate[], mode: SortMode): DestinationCandidate[] {
  const valid = items.filter(p => !p.routeError && Number.isFinite(p.drivingDistance) && (mode === "distance" || Number.isFinite(eta(p))));
  const maxTime = Math.max(1, ...valid.map(p => eta(p) ?? 0));
  const maxDistance = Math.max(1, ...valid.map(p => p.drivingDistance!));
  const score = (p: DestinationCandidate) => mode === "time" ? eta(p)! : mode === "distance" ? p.drivingDistance!
    : RECOMMEND_WEIGHTS.time * eta(p)! / maxTime + RECOMMEND_WEIGHTS.distance * p.drivingDistance! / maxDistance;
  return [...valid].sort((a, b) => score(a) - score(b) || (eta(a) ?? Infinity) - (eta(b) ?? Infinity) || a.drivingDistance! - b.drivingDistance! || a.id.localeCompare(b.id));
}
