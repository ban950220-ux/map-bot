import { authorize, json, errorResponse } from "@/lib/api";

export async function POST(request: Request) {
  try {
    await authorize(request);
    return json({ error: "매장 자체 주차정보 연동은 provider 표시 정책 검토가 끝날 때까지 사용할 수 없습니다." }, 410);
  } catch (error) { return errorResponse(error); }
}
