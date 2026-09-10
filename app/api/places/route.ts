import { authorize, readBody, json, errorResponse } from "@/lib/api";
import { nearbySchema } from "@/services/maps/schema";
import { searchNearby } from "@/services/maps/placeSearch";
export async function POST(request: Request) {
  try { await authorize(request); const input = nearbySchema.parse(await readBody(request)); return json(await searchNearby(input.query, input.origin, input.radius, input.count, input.expand, request.signal)); }
  catch (error) { return errorResponse(error); }
}
