"use client";
import { z } from "zod";
import type { NearbyQuery } from "./nearby-client";
import type { SortMode } from "@/services/maps/types";
const schema = z.object({ address: z.string().trim().min(3).max(200), query: z.string().trim().min(1).max(100), radius: z.union([z.literal(1000), z.literal(3000), z.literal(5000), z.literal(10000), z.literal(20000)]).default(5000), count: z.number().int().min(1).max(15).default(5), expand: z.boolean().default(true), sort: z.enum(["time", "distance", "recommended"]).default("time") }).strict();
export function registerNearbyTool(run: (input: NearbyQuery & { sort: SortMode }) => Promise<unknown>) {
  const context = (document as Document & { modelContext?: { registerTool: (tool: object, options: { signal: AbortSignal }) => void | Promise<void> } }).modelContext;
  if (!context?.registerTool) return;
  const lifetime = new AbortController();
  try { void Promise.resolve(context.registerTool({ name: "compare_nearby_places", title: "주변 장소 자동차 경로 비교", description: "출발지 주소와 업종·장소 검색어로 후보를 찾고 자동차 경로를 병렬 비교하여 화면에 순위를 표시합니다. Kakao와 NAVER API 이용량이 발생합니다. 완료 후 상위 결과를 반환합니다. 위치 권한은 브라우저에서 사용자가 직접 허용합니다.", inputSchema: { type: "object", properties: { address: { type: "string", minLength: 3, maxLength: 200 }, query: { type: "string", minLength: 1, maxLength: 100 }, radius: { type: "integer", enum: [1000, 3000, 5000, 10000, 20000] }, count: { type: "integer", minimum: 1, maximum: 15 }, expand: { type: "boolean" }, sort: { type: "string", enum: ["time", "distance", "recommended"] } }, required: ["address", "query"], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: true }, execute: (input: unknown) => run(schema.parse(input)) }, { signal: lifetime.signal })).catch(() => {}); } catch { /* The normal form remains available. */ }
  return () => lifetime.abort();
}
