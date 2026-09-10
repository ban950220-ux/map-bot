import type { Point } from "@/lib/types";
import { MapsError } from "@/lib/naver";
import { naverRouting } from "./routing";
import type { DestinationCandidate, RoutingProvider } from "./types";
// NAVER's multi-goal parameter returns ONE chosen goal, not a 1×N matrix.
// Limit both API batch size and fallback concurrency; never route waypoints as destinations.
export async function calculateRouteMatrix(origin: Point, candidates: DestinationCandidate[], signal?: AbortSignal, provider: RoutingProvider = naverRouting) {
  if (provider.capabilities.matrix && provider.getRouteMatrix) return provider.getRouteMatrix(origin, candidates, signal);
  const results: DestinationCandidate[] = new Array(candidates.length);
  let next = 0, stopReason: string | undefined;
  async function worker() {
    while (next < candidates.length) {
      const index = next++, candidate = candidates[index];
      if (signal?.aborted || stopReason) { results[index] = { ...candidate, routeError: stopReason || "조회가 취소되었습니다." }; continue; }
      try { results[index] = await provider.getRoute(origin, candidate, signal); }
      catch (error) {
        const message = error instanceof MapsError ? error.message : "이 장소의 자동차 경로를 확인하지 못했습니다.";
        results[index] = { ...candidate, routeError: message, routeErrorFatal: error instanceof MapsError && error.fatal };
        if (error instanceof MapsError && error.fatal) stopReason = message;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, candidates.length) }, worker));
  return results;
}
