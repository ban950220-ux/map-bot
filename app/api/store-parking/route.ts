import { authorize, readBody, json, errorResponse } from "@/lib/api";
import { parkingEnrichmentSchema } from "@/services/maps/schema";
import { enrichGoogleStoreParking } from "@/services/maps/googlePlaces";

export async function POST(request: Request) {
  try {
    await authorize(request);
    const input = parkingEnrichmentSchema.parse(await readBody(request));
    return json(await enrichGoogleStoreParking(input.candidates, request.signal));
  } catch (error) { return errorResponse(error); }
}
