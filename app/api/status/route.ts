import { authorize, json, errorResponse } from "@/lib/api";
import { configured, mapClientId } from "@/lib/naver";
import { placesConfigured } from "@/services/maps/placeSearch";
import { googlePlacesConfigured } from "@/services/maps/googlePlaces";
export async function GET(request: Request) {
  try { await authorize(request); return json({ connected: configured(), placesConnected: placesConfigured(), parkingConnected: googlePlacesConfigured(), mapClientId: mapClientId() }); }
  catch (error) { return errorResponse(error); }
}
