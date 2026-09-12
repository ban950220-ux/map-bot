export type Point = { x: number; y: number; address: string };
export type OriginCandidate = Point & { id: string; name: string };
export type OriginSelection = { needsSelection: true; query: string; candidates: OriginCandidate[] };
export function isOriginSelection(value: Point | OriginSelection): value is OriginSelection {
  return "needsSelection" in value && value.needsSelection === true;
}
export type Store = { id: number; brand: string; name: string; address: string; x: number; y: number };
export type RouteResult = { id: number; brand: string; name: string; address: string; durationMs: number; distanceM: number; toll: number; fuel: number; checkedAt: string; destination: Point; path?: [number, number][] };
export type RouteFailure = { id: number; name: string; message: string };
export type CompareResponse = { results: RouteResult[]; failures: RouteFailure[] };
export function formatDuration(ms: number) {
  const minutes = Math.max(1, Math.round(ms / 60000));
  return minutes >= 60 ? `${Math.floor(minutes / 60)}시간 ${minutes % 60}분` : `${minutes}분`;
}
