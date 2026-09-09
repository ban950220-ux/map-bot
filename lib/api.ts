import { getChatGPTUser } from "@/app/chatgpt-auth";
import { MapsError } from "./naver";
import { z } from "zod";

export const addressSchema = z.string().trim().min(3, "주소를 3자 이상 입력해 주세요.").max(200);
export const pointSchema = z.object({ x: z.number().min(124).max(132), y: z.number().min(32).max(40), address: z.string().max(250) }).strict();
export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
export async function authorize(request: Request) {
  if (!(await getChatGPTUser())) throw new MapsError("ChatGPT에 로그인한 뒤 사이트를 다시 열어 주세요.", 401, true);
  if (request.headers.get("sec-fetch-site") === "cross-site") throw new MapsError("사이트 화면에서 다시 조회해 주세요.", 403, true);
}
export async function readBody(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new MapsError("잘못된 요청 형식입니다.", 415);
  const text = await request.text();
  if (text.length > 10000) throw new MapsError("요청이 너무 깁니다.", 413);
  try { return JSON.parse(text); } catch { throw new MapsError("입력 내용을 확인해 주세요.", 400); }
}
export function errorResponse(error: unknown) {
  if (error instanceof z.ZodError) return json({ error: "출발지와 도착지 입력 내용을 확인해 주세요." }, 400);
  if (error instanceof MapsError) return json({ error: error.message }, error.status);
  return json({ error: "조회 중 문제가 발생했습니다. 다시 시도해 주세요." }, 500);
}
