import { env } from "cloudflare:workers";
import { z } from "zod";
import type { StoreParking } from "./types";
import { parkingFromGoogle, selectGoogleMatch, unknownStoreParking, type GoogleParkingOptions, type ParkingCandidateIdentity } from "./googlePlaceMatching";
export type { ParkingCandidateIdentity } from "./googlePlaceMatching";

export const GOOGLE_FIELD_MASK = "places.id,places.displayName,places.formattedAddress,places.location,places.parkingOptions,places.attributions";
export const GOOGLE_PARKING_CONCURRENCY = 3;
const TIMEOUT_MS = 8000;

export type ParkingEnrichment = { id: string; storeParking: StoreParking };
export type ParkingEnrichmentResult = { enrichments: ParkingEnrichment[]; attempted: number; matched: number; available: number; failed: number; warnings: string[] };

const parkingOptionsSchema: z.ZodType<GoogleParkingOptions> = z.object({
  freeParkingLot: z.boolean().optional(), paidParkingLot: z.boolean().optional(),
  freeStreetParking: z.boolean().optional(), paidStreetParking: z.boolean().optional(),
  valetParking: z.boolean().optional(), freeGarageParking: z.boolean().optional(),
  paidGarageParking: z.boolean().optional(),
}).strict();
const googleResponseSchema = z.object({ places: z.array(z.object({
  id: z.string(), displayName: z.object({ text: z.string(), languageCode: z.string().optional() }),
  formattedAddress: z.string().default(""),
  location: z.object({ latitude: z.number(), longitude: z.number() }),
  parkingOptions: parkingOptionsSchema.optional(),
  attributions: z.array(z.object({ provider: z.string(), providerUri: z.string().regex(/^https:\/\//).optional() })).optional(),
}).passthrough()).default([]) }).passthrough();
export function googlePlacesConfigured() { return !!(env as unknown as Record<string, string>).GOOGLE_PLACES_API_KEY; }
export async function lookupGoogleStoreParking(candidate: ParkingCandidateIdentity, signal?: AbortSignal, timeoutMs = TIMEOUT_MS): Promise<{ parking: StoreParking; matched: boolean }> {
  if (!googlePlacesConfigured()) return { parking: unknownStoreParking(), matched: false };
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(cancel, timeoutMs);
  try {
    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST", redirect: "manual", signal: controller.signal,
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": (env as unknown as Record<string, string>).GOOGLE_PLACES_API_KEY, "X-Goog-FieldMask": GOOGLE_FIELD_MASK },
      body: JSON.stringify({ textQuery: `${candidate.name} ${candidate.address}`.trim(), pageSize: 3, languageCode: "ko", regionCode: "KR", locationBias: { circle: { center: { latitude: candidate.latitude, longitude: candidate.longitude }, radius: 200 } } }),
    });
    if (!response.ok) throw new Error(`Google Places HTTP ${response.status}`);
    const data = googleResponseSchema.parse(await response.json());
    const match = selectGoogleMatch(candidate, data.places);
    return match ? { parking: parkingFromGoogle(match.place), matched: true } : { parking: unknownStoreParking(), matched: false };
  } finally { clearTimeout(timer); signal?.removeEventListener("abort", cancel); }
}

export async function enrichGoogleStoreParking(candidates: ParkingCandidateIdentity[], signal?: AbortSignal, timeoutMs = TIMEOUT_MS): Promise<ParkingEnrichmentResult> {
  if (!googlePlacesConfigured()) return { enrichments: candidates.map(candidate => ({ id: candidate.id, storeParking: unknownStoreParking() })), attempted: 0, matched: 0, available: 0, failed: 0, warnings: ["매장 주차정보 제공처가 연결되지 않아 확인이 필요합니다."] };
  const enrichments = new Array<ParkingEnrichment>(candidates.length);
  let cursor = 0, matched = 0, available = 0, failed = 0;
  async function worker() {
    while (true) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const index = cursor++; if (index >= candidates.length) return;
      try {
        const result = await lookupGoogleStoreParking(candidates[index], signal, timeoutMs);
        if (result.matched) matched++;
        if (result.parking.status === "available") available++;
        enrichments[index] = { id: candidates[index].id, storeParking: result.parking };
      } catch (error) {
        if (signal?.aborted) throw error;
        failed++; enrichments[index] = { id: candidates[index].id, storeParking: unknownStoreParking() };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(GOOGLE_PARKING_CONCURRENCY, candidates.length) }, worker));
  return { enrichments, attempted: candidates.length, matched, available, failed, warnings: failed ? ["일부 매장의 자체 주차정보를 확인하지 못했습니다."] : [] };
}
