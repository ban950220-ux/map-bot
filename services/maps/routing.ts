import { driving } from "@/lib/naver";
import { TtlCache } from "./cache";
import type { DestinationCandidate, RoutingProvider } from "./types";
const cache = new TtlCache<DestinationCandidate>(45000, 48);
export const naverRouting: RoutingProvider = {
  capabilities: { matrix: false, trafficAware: true, modes: ["driving"] },
  async getRoute(origin, candidate, signal) {
    const key = JSON.stringify([origin.x, origin.y, candidate.longitude, candidate.latitude, "trafast", 1]);
    const cached = cache.get(key);
    if (cached) return { ...candidate, drivingDistance: cached.drivingDistance, drivingDuration: cached.drivingDuration, trafficDuration: cached.trafficDuration, route: cached.route };
    const result = await driving(origin, { x: candidate.longitude, y: candidate.latitude, address: candidate.address }, { id: 0, brand: "", name: candidate.name, address: candidate.address }, signal, { option: "trafast", includePath: true });
    const routed: DestinationCandidate = { ...candidate, drivingDistance: result.distanceM, drivingDuration: result.durationMs, trafficDuration: result.durationMs, route: { path: result.path || [], checkedAt: result.checkedAt, trafficAware: true, toll: result.toll } };
    cache.set(key, routed); return routed;
  },
};
