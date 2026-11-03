export type ParkingPreference = "none" | "required";

export type SearchIntent = {
  rawQuery: string;
  poiQuery: string;
  parkingPreference: ParkingPreference;
};

const PARKING_CONDITION = /(?:주차\s*(?:가능한?|되는|지원(?:하는)?|할\s*수\s*있는)|주차장\s*(?:있는|보유(?:한)?))/gi;

export function parseSearchIntent(query: string): SearchIntent {
  const rawQuery = query.trim().replace(/\s+/g, " ");
  const parkingPreference: ParkingPreference = PARKING_CONDITION.test(rawQuery) ? "required" : "none";
  PARKING_CONDITION.lastIndex = 0;
  const stripped = rawQuery.replace(PARKING_CONDITION, " ").replace(/\s+/g, " ").trim();
  return { rawQuery, poiQuery: stripped || rawQuery, parkingPreference };
}
