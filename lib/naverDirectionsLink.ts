import type { Point } from "./types";

type Destination = { name: string; latitude: number; longitude: number };

export function isAndroidUserAgent(userAgent: string) {
  return /Android/i.test(userAgent);
}

function routeQuery(origin: Point, originName: string, destination: Destination, appname: string) {
  return `slat=${origin.y}&slng=${origin.x}&sname=${encodeURIComponent(originName)}`
    + `&dlat=${destination.latitude}&dlng=${destination.longitude}&dname=${encodeURIComponent(destination.name)}`
    + `&appname=${encodeURIComponent(appname)}`;
}

// NAVER's documented mobile-web intent opens the Maps app when installed and
// the Play Store otherwise. It requires a user-initiated navigation.
export function naverAndroidDirectionsUrl(origin: Point, originName: string, destination: Destination, appname: string) {
  return `intent://route/car?${routeQuery(origin, originName, destination, appname)}`
    + "#Intent;scheme=nmap;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=com.nhn.android.nmap;end";
}

function webMercator(longitude: number, latitude: number) {
  const radians = Math.PI / 180;
  const radius = 6378137;
  return [radius * longitude * radians, radius * Math.log(Math.tan(Math.PI / 4 + latitude * radians / 2))];
}

// NAVER publishes the app scheme, but not a web-route construction contract.
// This follows its shared web route's x,y,name,,ADDRESS_POI shape. A real
// browser check is still needed before treating that web URL as guaranteed.
export function naverWebDirectionsUrl(origin: Point, originName: string, destination: Destination) {
  const segment = (longitude: number, latitude: number, name: string) => {
    const [x, y] = webMercator(longitude, latitude);
    return `${x},${y},${encodeURIComponent(name)},,ADDRESS_POI`;
  };
  return `https://map.naver.com/p/directions/${segment(origin.x, origin.y, originName)}`
    + `/${segment(destination.longitude, destination.latitude, destination.name)}/-/car`;
}
