import type { DestinationCandidate, StoreParking, StoreParkingAttribution } from "./types";

const MATCH_RADIUS_METERS = 120;
const STRONG_MATCH_RADIUS_METERS = 180;

export type ParkingCandidateIdentity = { id: string; name: string; address: string; latitude: number; longitude: number };
export type GoogleParkingOptions = {
  freeParkingLot?: boolean; paidParkingLot?: boolean; freeStreetParking?: boolean;
  paidStreetParking?: boolean; valetParking?: boolean; freeGarageParking?: boolean; paidGarageParking?: boolean;
};
export type GooglePlaceCandidate = {
  id: string; displayName: { text: string; languageCode?: string }; formattedAddress: string;
  location: { latitude: number; longitude: number }; parkingOptions?: GoogleParkingOptions;
  attributions?: { provider: string; providerUri?: string }[];
};
const optionLabels: Record<keyof GoogleParkingOptions, string> = {
  freeParkingLot: "무료 주차장", paidParkingLot: "유료 주차장",
  freeStreetParking: "무료 노상주차", paidStreetParking: "유료 노상주차",
  valetParking: "발렛", freeGarageParking: "무료 실내주차", paidGarageParking: "유료 실내주차",
};

export function unknownStoreParking(): StoreParking { return { status: "unknown", source: "unknown", description: "매장 자체 주차정보 확인 필요" }; }
export function withoutStoredGoogleParking<T extends DestinationCandidate>(candidate: T): T {
  return candidate.storeParking?.source === "google-places" ? { ...candidate, storeParking: unknownStoreParking() } : candidate;
}
export function normalizePlaceText(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/대한민국/g, "").replace(/\b(?:republic of korea|south korea|korea)\b/g, "").replace(/[^0-9a-z가-힣]/g, "");
}
function bigrams(value: string) {
  const normalized = normalizePlaceText(value);
  if (normalized.length < 2) return new Set(normalized ? [normalized] : []);
  return new Set(Array.from({ length: normalized.length - 1 }, (_, index) => normalized.slice(index, index + 2)));
}
export function textSimilarity(left: string, right: string) {
  const a = normalizePlaceText(left), b = normalizePlaceText(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (Math.min(a.length, b.length) >= 4 && (a.includes(b) || b.includes(a))) return 0.92;
  const aa = bigrams(a), bb = bigrams(b);
  let overlap = 0; for (const gram of aa) if (bb.has(gram)) overlap++;
  return aa.size + bb.size ? 2 * overlap / (aa.size + bb.size) : 0;
}
export function coordinateDistanceMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const rad = Math.PI / 180;
  const h = Math.sin((b.latitude - a.latitude) * rad / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin((b.longitude - a.longitude) * rad / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}
export function selectGoogleMatch(candidate: ParkingCandidateIdentity, places: GooglePlaceCandidate[]) {
  return places.map((place, index) => {
    const name = textSimilarity(candidate.name, place.displayName.text);
    const address = textSimilarity(candidate.address, place.formattedAddress);
    const distance = coordinateDistanceMeters(candidate, place.location);
    const ordinary = distance <= MATCH_RADIUS_METERS && name >= 0.72 && address >= 0.22;
    const strong = distance <= STRONG_MATCH_RADIUS_METERS && name >= 0.9 && address >= 0.45;
    return { place, index, name, address, distance, accepted: ordinary || strong, score: name * 0.58 + address * 0.22 + Math.max(0, 1 - distance / STRONG_MATCH_RADIUS_METERS) * 0.2 };
  }).filter(item => item.accepted).sort((a, b) => b.score - a.score || a.distance - b.distance || a.index - b.index)[0];
}
export function parkingFromGoogle(place: GooglePlaceCandidate): StoreParking {
  const types = (Object.entries(place.parkingOptions || {}) as [keyof GoogleParkingOptions, boolean][]).filter(([, value]) => value === true).map(([key]) => optionLabels[key]);
  const attributions: StoreParkingAttribution[] | undefined = place.attributions?.map(item => ({ provider: item.provider, ...(item.providerUri ? { providerUri: item.providerUri } : {}) }));
  if (!types.length) return { status: "unknown", source: "google-places", description: "Google Places에 매장 주차정보가 없어 확인이 필요합니다.", ...(attributions?.length ? { attributions } : {}) };
  return { status: "available", source: "google-places", description: `매장 주차 가능 · ${types.join(" · ")}`, types, ...(attributions?.length ? { attributions } : {}) };
}
