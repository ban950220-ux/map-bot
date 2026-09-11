"use client";
import { useEffect, useRef, useState } from "react";
import type { Point } from "@/lib/types";
import type { DestinationCandidate } from "@/services/maps/types";
// Only the public browser SDK identifier is used here, never server secrets.
type MapsSdk = Record<string, any>;
const browser = () => window as Window & { naver?: { maps: MapsSdk }; navermap_authFailure?: () => void };
const MAP_RUNTIME_ERROR = "지도를 표시하지 못했습니다. 장소 목록과 자동차 경로 비교는 계속 사용할 수 있습니다.";
let sdkPromise: Promise<MapsSdk> | undefined;
function loadSdk(clientId: string) {
  if (browser().naver?.maps) return Promise.resolve(browser().naver!.maps);
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const timer = setTimeout(() => reject(new Error("지도 로딩 시간이 초과되었습니다.")), 15000);
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}`;
    script.async = true;
    script.onload = () => { clearTimeout(timer); const maps = browser().naver?.maps; maps ? resolve(maps) : reject(new Error("지도 API를 불러오지 못했습니다.")); };
    script.onerror = () => { clearTimeout(timer); reject(new Error("지도 서버에 연결하지 못했습니다.")); };
    document.head.appendChild(script);
  });
  return sdkPromise;
}
export default function NearbyMap({ clientId, origin, places, selectedId, onSelect }: { clientId: string; origin: Point; places: DestinationCandidate[]; selectedId?: string; onSelect: (id: string) => void }) {
  const container = useRef<HTMLDivElement>(null), mapRef = useRef<any>(null);
  const [sdk, setSdk] = useState<MapsSdk>(), [error, setError] = useState("");
  useEffect(() => {
    let disposed = false;
    const previous = browser().navermap_authFailure;
    const authError = () => { if (!disposed) setError("지도 표시 인증이 필요합니다. NAVER Cloud에서 Dynamic Map 사용과 이 사이트 주소 등록을 확인해 주세요. 목록 비교는 계속 사용할 수 있습니다."); };
    browser().navermap_authFailure = authError;
    if (!clientId) setError("지도 표시용 NAVER Client ID가 연결되지 않았습니다.");
    else void loadSdk(clientId).then(value => { if (!disposed) setSdk(value); }).catch(cause => { if (!disposed) setError(cause.message); });
    return () => { disposed = true; if (browser().navermap_authFailure === authError) browser().navermap_authFailure = previous; };
  }, [clientId]);
  useEffect(() => {
    if (!sdk || !container.current) return;
    let map: MapsSdk | undefined, observer: ResizeObserver | undefined;
    try {
      map = new sdk.Map(container.current, { center: new sdk.LatLng(origin.y, origin.x), zoom: 12, zoomControl: true });
      mapRef.current = map;
      observer = new ResizeObserver(() => {
        try { if (container.current) map?.setSize(new sdk.Size(container.current.clientWidth, container.current.clientHeight)); }
        catch { setError(MAP_RUNTIME_ERROR); }
      });
      observer.observe(container.current);
    } catch {
      try { map?.destroy?.(); } catch { /* A failed map instance may not support cleanup. */ }
      mapRef.current = null; queueMicrotask(() => setError(MAP_RUNTIME_ERROR)); return;
    }
    return () => {
      observer?.disconnect();
      try { map?.destroy?.(); } catch { /* Keep navigation usable if the SDK cleanup fails. */ }
      mapRef.current = null;
    };
  }, [sdk]);
  useEffect(() => {
    if (!sdk || !mapRef.current) return;
    const maps = sdk, map = mapRef.current, overlays: any[] = [];
    const clearOverlays = () => overlays.forEach(overlay => {
      try { maps.Event?.clearInstanceListeners?.(overlay); overlay.setMap?.(null); } catch { /* Ignore third-party cleanup failures. */ }
    });
    try {
      const start = new sdk.LatLng(origin.y, origin.x), bounds = new sdk.LatLngBounds(start, start);
      function marker(position: any, text: string, title: string, selected: boolean, id?: string) {
        const button = document.createElement("button");
        button.type = "button"; button.textContent = text; button.title = title; button.setAttribute("aria-label", title);
        button.className = "destination-marker" + (selected ? " selected" : "") + (!id ? " origin-marker" : "");
        if (id) button.onclick = () => onSelect(id);
        overlays.push(new maps.Marker({ map, position, title, icon: { content: button, anchor: new maps.Point(19, 38) }, zIndex: selected ? 100 : 10 }));
        bounds.extend(position);
      }
      marker(start, "출발", origin.address, false);
      places.forEach((p, index) => {
        const selected = p.id === selectedId;
        marker(new sdk.LatLng(p.latitude, p.longitude), String.fromCharCode(65 + index), `${String.fromCharCode(65 + index)} ${p.name}`, selected, p.id);
        if (p.route?.path.length) {
          const path = p.route.path.map(([x, y]) => new sdk.LatLng(y, x));
          overlays.push(new sdk.Polyline({ map, path, strokeColor: selected ? "#145cdd" : "#7489a4", strokeWeight: selected ? 6 : 2, strokeOpacity: selected ? 0.95 : 0.28, zIndex: selected ? 5 : 1 }));
          if (selected) path.forEach((position: any) => bounds.extend(position));
        }
      });
      if (places.length) map.fitBounds(bounds, 44); else map.setCenter(start);
    } catch {
      clearOverlays(); queueMicrotask(() => setError(MAP_RUNTIME_ERROR)); return;
    }
    return clearOverlays;
  }, [sdk, origin, places, selectedId, onSelect]);
  return <div className="nearby-map-wrap"><div ref={container} className="nearby-map" aria-label="출발지와 후보 목적지 지도"/>{!sdk && !error && <p className="map-status" role="status">지도 불러오는 중…</p>}{error && <p className="map-status error-box" role="alert">{error}</p>}</div>;
}
