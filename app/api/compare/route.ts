import { z } from "zod";
import { addressSchema, pointSchema, authorize, readBody, json, errorResponse } from "@/lib/api";
import { driving, geocode, MapsError } from "@/lib/naver";
import stores from "@/lib/stores.json";
import type { CompareResponse } from "@/lib/types";
const schema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("stores"), origin: pointSchema, ids: z.array(z.number().int().min(1).max(stores.length)).min(1).max(4) }).strict(),
  z.object({ mode: z.literal("direct"), origin: pointSchema, destination: addressSchema }).strict(),
]);
export async function POST(request: Request) {
  try {
    await authorize(request);
    const input = schema.parse(await readBody(request));
    if (input.mode === "direct") {
      const destination = await geocode(input.destination, request.signal);
      const result = await driving(input.origin, destination, { id: 0, brand: "직접 입력", name: input.destination, address: destination.address }, request.signal);
      return json({ results: [result], failures: [] });
    }
    const selected = [...new Set(input.ids)].map(id => stores.find(store => store.id === id)!);
    const settled = await Promise.allSettled(selected.map(async store => {
      const destination = { x: store.x, y: store.y, address: store.address };
      return driving(input.origin, destination, store, request.signal);
    }));
    const output: CompareResponse = { results: [], failures: [] };
    for (const [index, item] of settled.entries()) {
      if (item.status === "fulfilled") output.results.push(item.value);
      else {
        if (item.reason instanceof MapsError && item.reason.fatal) throw item.reason;
        output.failures.push({ id: selected[index].id, name: `${selected[index].brand} ${selected[index].name}`, message: item.reason instanceof MapsError ? item.reason.message : "경로를 조회하지 못했습니다." });
      }
    }
    return json(output);
  } catch (error) { return errorResponse(error); }
}
