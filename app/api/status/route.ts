import { authorize, json, errorResponse } from "@/lib/api";
import { configured } from "@/lib/naver";
export async function GET(request: Request) {
  try { await authorize(request); return json({ connected: configured() }); }
  catch (error) { return errorResponse(error); }
}
