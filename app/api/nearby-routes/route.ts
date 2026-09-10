import { authorize, readBody, json, errorResponse } from "@/lib/api";
import { routesSchema } from "@/services/maps/schema";
import { calculateRouteMatrix } from "@/services/maps/routeMatrix";
export async function POST(request: Request) {
  try { await authorize(request); const input = routesSchema.parse(await readBody(request)); return json({ candidates: await calculateRouteMatrix(input.origin, input.candidates, request.signal) }); }
  catch (error) { return errorResponse(error); }
}
