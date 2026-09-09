"use client";
import { z } from "zod";

const querySchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("stores"), origin: z.string().trim().min(3).max(200) }).strict(),
  z.object({ mode: z.literal("direct"), origin: z.string().trim().min(3).max(200), destination: z.string().trim().min(3).max(200) }).strict(),
]);
type Query = z.infer<typeof querySchema>;
type Context = { registerTool: (tool: { name: string; title: string; description: string; inputSchema: object; annotations: { readOnlyHint: boolean; untrustedContentHint: boolean }; execute: (input: unknown) => Promise<unknown> }, options: { signal: AbortSignal }) => void | Promise<void> };
export function registerRouteTool(run: (input: Query) => Promise<unknown>) {
  const context = (document as Document & { modelContext?: Context }).modelContext;
  if (!context?.registerTool) return;
  const lifetime = new AbortController();
  const tool = {
    name: "compare_live_driving_times", title: "실시간 자동차 소요시간 비교",
    description: "현재 NAVER Maps 교통정보로 저장된 양꼬치 매장 전체 또는 지정한 도착지까지의 소요시간을 조회하고 화면에 결과를 표시합니다. 주소는 도로명 또는 지번 주소를 사용합니다. NAVER API 이용량이 발생하며 조회 완료 후 결과를 반환합니다.",
    inputSchema: { type: "object", properties: { mode: { type: "string", enum: ["stores", "direct"] }, origin: { type: "string", minLength: 3, maxLength: 200 }, destination: { type: "string", minLength: 3, maxLength: 200, description: "direct 모드에서 필수" } }, required: ["mode", "origin"], additionalProperties: false },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute: async (input: unknown) => run(querySchema.parse(input)),
  };
  try { Promise.resolve(context.registerTool(tool, { signal: lifetime.signal })).catch(() => {}); } catch { /* Standard browser UI remains available. */ }
  return () => lifetime.abort();
}
