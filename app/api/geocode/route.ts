import { z } from "zod";
import { addressSchema, authorize, readBody, json, errorResponse } from "@/lib/api";
import { geocodeAddress as geocode } from "@/services/maps/geocoding";
export async function POST(request: Request) {
  try {
    await authorize(request);
    const { address } = z.object({ address: addressSchema }).strict().parse(await readBody(request));
    return json(await geocode(address, request.signal));
  } catch (error) { return errorResponse(error); }
}
