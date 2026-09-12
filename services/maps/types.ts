import type { Point } from "@/lib/types";
export type TravelMode = "driving" | "walking" | "bicycling" | "transit";
export type SortMode = "time" | "distance" | "relevance" | "recommended";
export type ParkingStatus = "available" | "unavailable" | "unknown";
export type StoreParkingSource = "provider" | "public-data" | "user" | "unknown";
export type StoreParking = { status: ParkingStatus; source: StoreParkingSource; description?: string };
export type NearbyParking = {
  status: "found" | "unknown"; source: "kakao-local" | "public-data" | "unknown";
  name?: string; distance?: number; parkingType?: string; feeType?: string;
  operatingHours?: string; spaces?: number; address?: string; placeUrl?: string;
};
export type RouteData = { path: [number, number][]; checkedAt: string; trafficAware: boolean; toll: number };
export interface DestinationCandidate {
  id: string; name: string; address: string; latitude: number; longitude: number;
  category?: string; phone?: string; placeUrl?: string; straightDistance?: number;
  source?: "kakao-local"; relevanceRank?: number;
  storeParking?: StoreParking; nearbyParking?: NearbyParking;
  drivingDistance?: number; drivingDuration?: number; trafficDuration?: number;
  rating?: number; reviewCount?: number; isOpen?: boolean; isClosed?: boolean;
  route?: RouteData; routeError?: string; routeErrorFatal?: boolean;
}
export type PlaceSearchResult = { candidates: DestinationCandidate[]; searchedRadius: number; requestedRadius: number; expanded: boolean; checkedAt: string; cached: boolean; limited: boolean; warnings: string[]; intent?: import("./searchIntent").SearchIntent };
export interface PlaceProvider { searchPlaces(query: string, origin: Point, radius: number, limit: number, signal?: AbortSignal): Promise<PlaceSearchResult>; }
export interface RoutingProvider {
  capabilities: { matrix: boolean; trafficAware: boolean; modes: TravelMode[] };
  getRoute(origin: Point, candidate: DestinationCandidate, signal?: AbortSignal): Promise<DestinationCandidate>;
  getRouteMatrix?(origin: Point, candidates: DestinationCandidate[], signal?: AbortSignal): Promise<DestinationCandidate[]>;
}
