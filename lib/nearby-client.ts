import type { Point } from "./types";
import type { DestinationCandidate, PlaceSearchResult } from "@/services/maps/types";
export type NearbyQuery = { address: string; location?: Point; query: string; radius: number; count: number; expand: boolean };
export type NearbySnapshot = { origin: Point; search: PlaceSearchResult; query: string; candidates: DestinationCandidate[]; completed: boolean };
export type NearbyProgress = { phase: string; done: number; total: number; snapshot?: NearbySnapshot };
export async function postJson<T>(path: string, data: unknown, signal: AbortSignal): Promise<T> {
  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), signal });
  const body = await response.json().catch(() => ({ error: "로그인 상태를 확인한 뒤 사이트를 새로고침해 주세요." })) as { error?: string };
  if (!response.ok) throw new Error(body.error || "요청을 처리하지 못했습니다.");
  return body as T;
}
export async function runNearbyComparison(input: NearbyQuery, signal: AbortSignal, update: (progress: NearbyProgress) => void, post: typeof postJson = postJson) {
  signal.throwIfAborted();
  update({ phase: "출발지 좌표 확인 중", done: 0, total: 0 });
  const origin = input.location ? { x: input.location.x, y: input.location.y, address: input.location.address }
    : await post<Point>("/api/geocode", { address: input.address.trim() }, signal);
  update({ phase: "주변 장소 후보 검색 중", done: 0, total: 0 });
  const search = await post<PlaceSearchResult>("/api/places", { origin, query: input.query.trim(), radius: input.radius, count: input.count, expand: input.expand }, signal);
  const snapshot: NearbySnapshot = { origin, search, query: input.query.trim(), candidates: [], completed: false };
  update({ phase: "후보별 자동차 경로 비교 중", done: 0, total: search.candidates.length, snapshot: { ...snapshot } });
  for (let offset = 0; offset < search.candidates.length; offset += 4) {
    signal.throwIfAborted();
    const batch = search.candidates.slice(offset, offset + 4);
    const response = await post<{ candidates: DestinationCandidate[] }>("/api/nearby-routes", { origin, candidates: batch }, signal);
    signal.throwIfAborted(); snapshot.candidates.push(...response.candidates);
    update({ phase: "후보별 자동차 경로 비교 중", done: snapshot.candidates.length, total: search.candidates.length, snapshot: { ...snapshot, candidates: [...snapshot.candidates] } });
    if (response.candidates.some(p => p.routeErrorFatal)) throw new Error("API 인증 또는 이용 한도로 조회를 중단했습니다. 완료된 결과와 실패 내역을 확인해 주세요.");
  }
  snapshot.completed = true;
  update({ phase: "비교 완료", done: snapshot.candidates.length, total: search.candidates.length, snapshot: { ...snapshot, candidates: [...snapshot.candidates] } });
  return snapshot;
}
export function currentLocation(): Promise<Point & { accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error("현재 위치를 지원하지 않는 브라우저입니다. 주소를 직접 입력해 주세요.")); return; }
    navigator.geolocation.getCurrentPosition(position => resolve({ x: position.coords.longitude, y: position.coords.latitude, address: "현재 위치", accuracy: position.coords.accuracy }), error => reject(new Error(error.code === 1 ? "위치 권한이 거부되었습니다. 브라우저에서 위치 권한을 허용하거나 출발지 주소를 직접 입력해 주세요." : "현재 위치를 확인하지 못했습니다. 주소를 직접 입력해 주세요.")), { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
  });
}
