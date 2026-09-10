import { authorize, json, errorResponse } from "@/lib/api";
import { configured, mapClientId } from "@/lib/naver";
import { placesConfigured } from "@/services/maps/placeSearch";
export async function GET(request: Request) {
  try { await authorize(request); return json({ connected: configured(), placesConnected: placesConfigured(), mapClientId: mapClientId() }); }
  catch (error) { return errorResponse(error); }
}
