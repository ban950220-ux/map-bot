import { env } from "cloudflare:workers";
import { z } from "zod";
import { MapsError } from "@/lib/naver";
import type { Point } from "@/lib/types";
import { TtlCache } from "./cache";
import { filterCandidates, SEARCH_RADII } from "./ranking";
import type { DestinationCandidate, PlaceProvider, PlaceSearchResult } from "./types";
const cache = new TtlCache<PlaceSearchResult>(300000, 64);
const categories: Record<string, string> = { "카페": "CE7", "약국": "PM9", "주차장": "PK6", "편의점": "CS2", "음식점": "FD6" };
const responseSchema = z.object({ meta: z.object({ is_end: z.boolean(), total_count: z.number(), pageable_count: z.number() }), documents: z.array(z.object({ id: z.string(), place_name: z.string(), x: z.string(), y: z.string(), address_name: z.string(), road_address_name: z.string(), category_name: z.string(), phone: z.string().optional(), place_url: z.string().optional() })) });
export function placesConfigured() { return !!(env as unknown as Record<string, string>).KAKAO_REST_API_KEY; }
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
        url.search = new URLSearchParams({ ...(category ? { category_group_code: category } : { query: normalized }), x: String(origin.x), y: String(origin.y), radius: String(radius), sort: "distance", page: String(page), size: "15" }).toString();
        const response = await fetch(url, { headers: { Authorization: `KakaoAK ${(env as unknown as Record<string, string>).KAKAO_REST_API_KEY}` }, redirect: "manual", signal: controller.signal });
        if ([401, 403].includes(response.status)) throw new MapsError("카카오 장소 검색 권한을 확인해 주세요. REST API 키와 카카오맵 사용 설정(ON)이 필요합니다.", 502, true);
        if (response.status === 429) throw new MapsError("카카오 장소 검색 이용 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.", 429, true);
        if (!response.ok) throw new MapsError(`주변 장소 검색에 실패했습니다 (HTTP ${response.status}).`, 502);
        const result = responseSchema.parse(await response.json());
        // Brand searches can include separately listed car parks. Keep them only
        // when parking is the user's explicit search intent.
        if (!/주차|parking/i.test(normalized)) {
          result.documents = result.documents.filter(p => !/(?:^|>\s*)주차장(?:\s*>|$)/.test(p.category_name) && !/주차장$/.test(p.place_name));
        }
        items.push(...result.documents.map(p => ({ id: `kakao:${p.id}`, name: p.place_name, address: p.road_address_name || p.address_name, latitude: Number(p.y), longitude: Number(p.x), category: p.category_name, phone: p.phone, placeUrl: /^https?:\/\/place\.map\.kakao\.com\/\d+$/.test(p.place_url || "") ? p.place_url!.replace(/^http:/, "https:") : undefined })));
        const filtered = filterCandidates(items, origin, radius, limit);
        limited = result.meta.total_count > filtered.length;
        if (result.meta.is_end || filtered.length >= limit) break;
      } catch (error) {
        if (error instanceof MapsError) throw error;
        if (controller.signal.aborted) throw new MapsError("주변 장소 검색이 취소되었거나 응답 시간이 초과되었습니다.", 504);
        throw new MapsError("주변 장소 검색 응답을 확인하지 못했습니다. 다시 시도해 주세요.");
      } finally { clearTimeout(timer); signal?.removeEventListener("abort", cancel); }
    }
    const output: PlaceSearchResult = { candidates: filterCandidates(items, origin, radius, limit), requestedRadius: radius, searchedRadius: radius, expanded: false, cached: false, limited, checkedAt: new Date().toISOString(), warnings: [] };
    cache.set(key, output); return output;
  },
};
export async function searchNearby(query: string, origin: Point, radius: number, count: number, expand: boolean, signal?: AbortSignal, provider: PlaceProvider = kakaoPlaces) {
  const limit = Math.min(30, Math.max(15, count * 3));
  let result = await provider.searchPlaces(query, origin, radius, limit, signal);
  if (expand && result.candidates.length < count) {
    for (const next of SEARCH_RADII.filter(value => value > radius)) {
      if (signal?.aborted) throw new MapsError("검색을 중단했습니다.", 499);
      try { result = await provider.searchPlaces(query, origin, next, limit, signal); }
      catch (error) {
        if (!result.candidates.length || signal?.aborted) throw error;
        result = { ...result, warnings: [error instanceof MapsError ? error.message : "검색 범위 확대에 실패해 이전 범위의 결과를 사용합니다."] }; break;
      }
      if (result.candidates.length >= count) break;
    }
  }
  return { ...result, requestedRadius: radius, expanded: result.searchedRadius > radius };
}
