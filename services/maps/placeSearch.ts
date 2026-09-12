import { env } from "cloudflare:workers";
import { z } from "zod";
import { MapsError } from "@/lib/naver";
import type { Point } from "@/lib/types";
import { TtlCache } from "./cache";
import { filterCandidates, SEARCH_RADII } from "./ranking";
import type { DestinationCandidate, PlaceProvider, PlaceSearchResult } from "./types";
import { parseSearchIntent } from "./searchIntent";
const cache = new TtlCache<PlaceSearchResult>(300000, 64);
const categories: Record<string, string> = { "대형마트": "MT1", "카페": "CE7", "약국": "PM9", "주차장": "PK6", "주유소": "OL7", "편의점": "CS2", "음식점": "FD6" };
const responseSchema = z.object({ meta: z.object({ is_end: z.boolean(), total_count: z.number(), pageable_count: z.number() }), documents: z.array(z.object({ id: z.string(), place_name: z.string(), x: z.string(), y: z.string(), address_name: z.string(), road_address_name: z.string(), category_name: z.string(), phone: z.string().optional(), place_url: z.string().optional() })) });
// A spherical bounding rectangle covers the requested circle beyond Kakao's
// 20km radius parameter limit. Exact Haversine filtering is still applied below.
export function searchArea(origin: Point, radius: number): Record<string, string> {
  if (radius <= 20000) return { radius: String(radius) };
  const angular = radius / 6371000;
  const latitudeDelta = angular * 180 / Math.PI;
  const longitudeDelta = Math.asin(Math.sin(angular) / Math.cos(origin.y * Math.PI / 180)) * 180 / Math.PI;
  return { rect: [origin.x - longitudeDelta, origin.y - latitudeDelta, origin.x + longitudeDelta, origin.y + latitudeDelta].join(",") };
}
export function placesConfigured() { return !!(env as unknown as Record<string, string>).KAKAO_REST_API_KEY; }
export async function searchOriginPlace(query: string, signal?: AbortSignal): Promise<Point> {
  if (!placesConfigured()) throw new MapsError("장소명으로 출발지를 찾으려면 카카오 장소 검색 연결이 필요합니다.", 503, true);
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(cancel, 10000);
  try {
    const url = new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
    url.search = new URLSearchParams({ query: query.trim(), sort: "accuracy", page: "1", size: "5" }).toString();
    const response = await fetch(url, { headers: { Authorization: `KakaoAK ${(env as unknown as Record<string, string>).KAKAO_REST_API_KEY}` }, redirect: "manual", signal: controller.signal });
    if ([401, 403].includes(response.status)) throw new MapsError("카카오 장소 검색 권한을 확인해 주세요.", 502, true);
    if (response.status === 429) throw new MapsError("카카오 장소 검색 이용 한도에 도달했습니다.", 429, true);
    if (!response.ok) throw new MapsError(`출발 장소 검색에 실패했습니다 (HTTP ${response.status}).`);
    const result = responseSchema.parse(await response.json());
    const place = result.documents.find(item => Number.isFinite(Number(item.x)) && Number.isFinite(Number(item.y)));
    if (!place) throw new MapsError("출발 장소를 찾지 못했습니다. 지역명과 장소명을 함께 입력하거나 주소를 입력해 주세요.", 422);
    const address = place.road_address_name || place.address_name;
    return { x: Number(place.x), y: Number(place.y), address: `${place.place_name}${address ? ` · ${address}` : ""}` };
  } catch (error) {
    if (error instanceof MapsError) throw error;
    if (controller.signal.aborted) throw new MapsError("출발 장소 검색이 취소되었거나 응답 시간이 초과되었습니다.", 504);
    throw new MapsError("출발 장소 검색 응답을 확인하지 못했습니다.");
  } finally { clearTimeout(timer); signal?.removeEventListener("abort", cancel); }
}
export const kakaoPlaces: PlaceProvider = {
  async searchPlaces(query, origin, radius, limit, signal) {
    if (!placesConfigured()) throw new MapsError("주변 장소 검색용 카카오 키를 서버에 연결해야 합니다.", 503, true);
    const normalized = query.trim();
    const key = JSON.stringify([normalized, origin.x, origin.y, radius, limit]);
    const cached = cache.get(key);
    if (cached) return { ...cached, cached: true };
    const items: DestinationCandidate[] = [];
    let limited = false;
    // At most 45 visible POIs per query; keep at most 30 unique in-radius candidates.
    for (let page = 1; page <= 3; page++) {
      const controller = new AbortController();
      const cancel = () => controller.abort();
      signal?.addEventListener("abort", cancel, { once: true });
      if (signal?.aborted) controller.abort();
      const timer = setTimeout(cancel, 10000);
      try {
        const category = categories[normalized];
        const url = new URL(`https://dapi.kakao.com/v2/local/search/${category ? "category" : "keyword"}.json`);
        url.search = new URLSearchParams({ ...(category ? { category_group_code: category } : { query: normalized }), x: String(origin.x), y: String(origin.y), ...searchArea(origin, radius), sort: category ? "distance" : "accuracy", page: String(page), size: "15" }).toString();
        const response = await fetch(url, { headers: { Authorization: `KakaoAK ${(env as unknown as Record<string, string>).KAKAO_REST_API_KEY}` }, redirect: "manual", signal: controller.signal });
        if ([401, 403].includes(response.status)) throw new MapsError("카카오 장소 검색 권한을 확인해 주세요. REST API 키와 카카오맵 사용 설정(ON)이 필요합니다.", 502, true);
        if (response.status === 429) throw new MapsError("카카오 장소 검색 이용 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.", 429, true);
        if (!response.ok) throw new MapsError(`주변 장소 검색에 실패했습니다 (HTTP ${response.status}).`, 502);
        const result = responseSchema.parse(await response.json());
        // Brand searches can include separately listed car parks. Keep them only
        // when parking is the user's explicit search intent.
        if (!/^(?:주차장|parking)$/i.test(normalized)) {
          result.documents = result.documents.filter(p => !/(?:^|>\s*)주차장(?:\s*>|$)/.test(p.category_name) && !/주차장$/.test(p.place_name));
        }
        const rankOffset = items.length;
        items.push(...result.documents.map((p, index) => ({ id: `kakao:${p.id}`, name: p.place_name, address: p.road_address_name || p.address_name, latitude: Number(p.y), longitude: Number(p.x), category: p.category_name, phone: p.phone, placeUrl: /^https?:\/\/place\.map\.kakao\.com\/\d+$/.test(p.place_url || "") ? p.place_url!.replace(/^http:/, "https:") : undefined, source: "kakao-local" as const, relevanceRank: rankOffset + index, parkingStatus: "unknown" as const, parkingSource: "not-provided" as const, parkingDescription: "매장 주차정보 확인 필요" })));
        const filtered = filterCandidates(items, origin, radius, limit, category ? "distance" : "balanced");
        limited = result.meta.total_count > filtered.length;
        if (result.meta.is_end || filtered.length >= limit) break;
      } catch (error) {
        if (error instanceof MapsError) throw error;
        if (controller.signal.aborted) throw new MapsError("주변 장소 검색이 취소되었거나 응답 시간이 초과되었습니다.", 504);
        throw new MapsError("주변 장소 검색 응답을 확인하지 못했습니다. 다시 시도해 주세요.");
      } finally { clearTimeout(timer); signal?.removeEventListener("abort", cancel); }
    }
    const output: PlaceSearchResult = { candidates: filterCandidates(items, origin, radius, limit, categories[normalized] ? "distance" : "balanced"), requestedRadius: radius, searchedRadius: radius, expanded: false, cached: false, limited, checkedAt: new Date().toISOString(), warnings: [] };
    cache.set(key, output); return output;
  },
};
export async function searchNearby(query: string, origin: Point, radius: number, count: number, expand: boolean, signal?: AbortSignal, provider: PlaceProvider = kakaoPlaces) {
  const intent = parseSearchIntent(query);
  const limit = Math.min(30, Math.max(15, count * 3));
  let result = await provider.searchPlaces(intent.poiQuery, origin, radius, limit, signal);
  if (expand && result.candidates.length < count) {
    for (const next of SEARCH_RADII.filter(value => value > radius)) {
      if (signal?.aborted) throw new MapsError("검색을 중단했습니다.", 499);
      try { result = await provider.searchPlaces(intent.poiQuery, origin, next, limit, signal); }
      catch (error) {
        if (!result.candidates.length || signal?.aborted) throw error;
        result = { ...result, warnings: [error instanceof MapsError ? error.message : "검색 범위 확대에 실패해 이전 범위의 결과를 사용합니다."] }; break;
      }
      if (result.candidates.length >= count) break;
    }
  }
  const warnings = [...result.warnings];
  if (intent.parkingPreference === "required") warnings.unshift("‘주차 가능’ 조건을 인식했습니다. 현재 Kakao/NAVER 장소 API는 매장 자체 주차 여부를 제공하지 않아 각 후보를 ‘주차정보 확인 필요’로 표시합니다.");
  return { ...result, requestedRadius: radius, expanded: result.searchedRadius > radius, warnings, intent };
}
