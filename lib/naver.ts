import { env } from "cloudflare:workers";
import type { Point, RouteResult } from "./types";

export class MapsError extends Error {
  constructor(message: string, public status = 502, public fatal = false) { super(message); }
}
export function configured() {
  const vars = env as unknown as Record<string, string | undefined>;
  return !!(vars.NAVER_MAPS_CLIENT_ID && vars.NAVER_MAPS_CLIENT_SECRET);
}
async function naver(path: string, params: Record<string, string>, signal?: AbortSignal) {
  const vars = env as unknown as Record<string, string | undefined>;
  if (!configured()) throw new MapsError("NAVER Maps 연결이 아직 준비되지 않았습니다. 이 사이트를 만든 대화에서 인증정보 연결을 요청해 주세요.", 503, true);
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(cancel, 18000);
  try {
    const url = new URL(path, "https://maps.apigw.ntruss.com");
    url.search = new URLSearchParams(params).toString();
    const response = await fetch(url, {
      headers: { "x-ncp-apigw-api-key-id": vars.NAVER_MAPS_CLIENT_ID!, "x-ncp-apigw-api-key": vars.NAVER_MAPS_CLIENT_SECRET!, Accept: "application/json" },
      redirect: "error", signal: controller.signal,
    });
    if (response.status === 401 || response.status === 403) throw new MapsError("NAVER 인증정보를 확인해야 합니다. 같은 Maps Application의 Client ID와 Secret인지 확인해 주세요.", 502, true);
    if (response.status === 429) throw new MapsError("NAVER Maps 이용 한도에 도달했거나 Geocoding·Directions 5가 활성화되지 않았습니다. 잠시 뒤 다시 시도하거나 이용 설정을 확인해 주세요.", 429, true);
    if (!response.ok) throw new MapsError(`NAVER Maps 요청을 처리하지 못했습니다 (HTTP ${response.status}). 잠시 후 다시 시도해 주세요.`);
    return await response.json() as Record<string, any>;
  } catch (error) {
    if (error instanceof MapsError) throw error;
    if (controller.signal.aborted) throw new MapsError("응답이 늦어 조회가 중단됐습니다. 잠시 후 다시 시도해 주세요.", 504);
    throw new MapsError("NAVER Maps에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  } finally { clearTimeout(timer); signal?.removeEventListener("abort", cancel); }
}
export async function geocode(address: string, signal?: AbortSignal): Promise<Point> {
  const data = await naver("/map-geocode/v2/geocode", { query: address, count: "1" }, signal);
  const item = data.addresses?.[0];
  if (!item) throw new MapsError("주소를 찾지 못했습니다. 장소 이름 대신 도로명 또는 지번 주소를 입력해 주세요.", 422);
  const x = Number(item.x), y = Number(item.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new MapsError("주소 좌표를 확인하지 못했습니다.");
  return { x, y, address: item.roadAddress || item.jibunAddress || address };
}
export async function driving(origin: Point, destination: Point, details: { id: number; brand: string; name: string; address: string }, signal?: AbortSignal): Promise<RouteResult> {
  const data = await naver("/map-direction/v1/driving", { start: `${origin.x},${origin.y}`, goal: `${destination.x},${destination.y}`, option: "traoptimal", cartype: "1", lang: "ko" }, signal);
  const summary = data.route?.traoptimal?.[0]?.summary;
  if (!summary || data.code !== 0) throw new MapsError("자동차 경로를 찾지 못했습니다. 출발지와 도착지가 같거나 도로로 연결되지 않았을 수 있습니다.", 422);
  if (!Number.isFinite(summary.duration) || !Number.isFinite(summary.distance)) throw new MapsError("경로 응답에 소요시간이 없습니다.");
  return { ...details, durationMs: summary.duration, distanceM: summary.distance, toll: summary.tollFare || 0, fuel: summary.fuelPrice || 0, checkedAt: new Date().toISOString(), destination };
}
