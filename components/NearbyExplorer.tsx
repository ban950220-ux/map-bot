"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CarFront, CircleAlert, Download, LocateFixed, MapPin, Route, Search, ShieldCheck, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import NearbyMap from "./NearbyMap";
import { formatDuration, type Point } from "@/lib/types";
import { currentLocation, runNearbyComparison, type NearbyProgress, type NearbyQuery } from "@/lib/nearby-client";
import { eta, rankCandidates, SEARCH_RADII } from "@/services/maps/ranking";
import type { SortMode } from "@/services/maps/types";
import { registerNearbyTool } from "@/lib/nearby-webmcp";
const clock = (date: string) => new Date(date).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour12: false });
const sortNames: Record<SortMode, string> = { time: "자동차 시간순", distance: "자동차 거리순", recommended: "종합 추천순" };
type Status = { connected: boolean; placesConnected: boolean; mapClientId: string };
export default function NearbyExplorer() {
  const [address, setAddress] = useState("경기도 이천시 대산로247번길 50");
  const [location, setLocation] = useState<(Point & { accuracy?: number })>();
  const [locating, setLocating] = useState(false);
  const [query, setQuery] = useState("양꼬치");
  const [radius, setRadius] = useState(5000), [count, setCount] = useState(5);
  const [expand, setExpand] = useState(true), [sort, setSort] = useState<SortMode>("time");
  const [status, setStatus] = useState<Status>();
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<NearbyProgress>({ phase: "", done: 0, total: 0 });
  const [busy, setBusy] = useState(false), [selectedId, setSelectedId] = useState<string>();
  const active = useRef<AbortController | null>(null), mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    void fetch("/api/status", { signal: controller.signal }).then(async response => {
      const data = await response.json() as Status & { error?: string };
      if (!response.ok) throw new Error(data.error || "연결 상태를 확인하지 못했습니다.");
      if (!controller.signal.aborted) setStatus(data);
    }).catch(cause => { if (!controller.signal.aborted) setError(cause.message); });
    return () => { mounted.current = false; controller.abort(); active.current?.abort(); };
  }, []);
  const run = useCallback(async (input: NearbyQuery) => {
    if (active.current) throw new Error("진행 중인 비교를 먼저 중단해 주세요.");
    const controller = new AbortController(); active.current = controller;
    setBusy(true); setError(""); setSelectedId(undefined); setProgress({ phase: "검색 준비 중", done: 0, total: 0 });
    setAddress(input.address); setLocation(input.location); setQuery(input.query); setRadius(input.radius); setCount(input.count); setExpand(input.expand);
    try { return await runNearbyComparison(input, controller.signal, update => { if (mounted.current && !controller.signal.aborted) setProgress(update); }); }
    catch (cause) {
      const message = controller.signal.aborted ? "조회를 중단했습니다. 완료된 후보만 임시 순위로 표시합니다." : cause instanceof Error ? cause.message : "조회하지 못했습니다.";
      if (mounted.current) setError(message); throw new Error(message);
    } finally { if (active.current === controller) active.current = null; if (mounted.current) setBusy(false); }
  }, []);
  useEffect(() => registerNearbyTool(async input => {
    setSort(input.sort);
    const result = await run(input);
    return { query: result.query, searchedRadius: result.search.searchedRadius, completed: result.completed, compared: result.candidates.length, results: rankCandidates(result.candidates, input.sort).slice(0, input.count).map(({ route, ...item }) => ({ ...item, checkedAt: route?.checkedAt })), failures: result.candidates.filter(p => p.routeError).map(p => ({ name: p.name, error: p.routeError })) };
  }), [run]);
  async function locate() {
    setLocating(true); setError("");
    try {
      const point = await currentLocation();
      if (point.x < 124 || point.x > 132 || point.y < 32 || point.y > 40) throw new Error("현재는 대한민국 내 자동차 경로만 지원합니다. 국내 출발지 주소를 입력해 주세요.");
      if (mounted.current) { setLocation(point); setAddress("현재 위치"); }
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : "위치를 확인하지 못했습니다."); }
    finally { if (mounted.current) setLocating(false); }
  }
  const snapshot = progress.snapshot;
  const ranked = useMemo(() => rankCandidates(snapshot?.candidates || [], sort), [snapshot?.candidates, sort]);
  const visible = useMemo(() => ranked.slice(0, count), [ranked, count]);
  const selected = visible.find(p => p.id === selectedId) || visible[0];
  const failures = snapshot?.candidates.filter(p => p.routeError) || [];
  const choose = useCallback((id: string) => setSelectedId(id), []);
  function csv() {
    const cell = (value: unknown) => '"' + String(value ?? "").replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"', '""') + '"';
    const rows = [["정렬", "순위", "장소", "주소", "자동차분", "도로km", "교통반영", "조회시각"], ...visible.map((p, index) => [sortNames[sort], index + 1, p.name, p.address, ((eta(p) || 0) / 60000).toFixed(1), ((p.drivingDistance || 0) / 1000).toFixed(2), p.route?.trafficAware ? "반영" : "미확인", p.route?.checkedAt])];
    const url = URL.createObjectURL(new Blob(["\uFEFF" + rows.map(row => row.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "주변장소_자동차경로.csv"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <main className="site-shell nearby-shell">
    <header className="site-header"><a href="/" className="brand"><span className="brand-mark"><Route size={23}/></span>가까운 한 끼</a><span className="private-label"><ShieldCheck size={16}/>나만의 경로 비교</span></header>
    <section className="page-intro"><p className="eyebrow">장소를 먼저 정하지 않아도</p><h1>지금 가장 빨리 갈 수 있는 곳</h1><p>주변 후보를 찾고, 각 장소까지의 실제 자동차 경로를 비교합니다.</p></section>
    <div className="nearby-workspace"><section className="panel planner">
      <h2>주변 장소 탐색</h2><form onSubmit={event => { event.preventDefault(); void run({ address, location, query, radius, count, expand }).catch(() => {}); }}><fieldset disabled={busy || locating}>
        <label htmlFor="nearby-origin">출발지</label><Input id="nearby-origin" value={address} required minLength={3} maxLength={200} onChange={event => { setAddress(event.target.value); setLocation(undefined); }} placeholder="도로명·지번 주소 또는 현재 위치"/>
        <Button className="locate-button" type="button" variant="outline" onClick={() => void locate()}><LocateFixed size={16}/>{locating ? "위치 확인 중…" : "현재 위치 사용"}</Button>
        {location && <p className="field-note">위도 {location.y.toFixed(5)} · 경도 {location.x.toFixed(5)}{location.accuracy !== undefined && ` · 정확도 약 ${Math.round(location.accuracy)}m`}</p>}
        <label htmlFor="nearby-query">어떤 장소를 찾으세요?</label><Input id="nearby-query" value={query} required maxLength={100} onChange={event => setQuery(event.target.value)} placeholder="양꼬치, 카페, 스타벅스, 약국…"/>
        <p className="field-note">상호명뿐 아니라 음식·업종 검색어도 입력하세요.</p>
        <div className="nearby-controls"><div><label htmlFor="nearby-radius">검색 반경</label><Select value={String(radius)} onValueChange={v => setRadius(Number(v))} disabled={busy}><SelectTrigger id="nearby-radius"><SelectValue/></SelectTrigger><SelectContent>{SEARCH_RADII.map(r => <SelectItem key={r} value={String(r)}>{r / 1000} km</SelectItem>)}</SelectContent></Select></div><div><label htmlFor="nearby-count">표시 개수</label><Select value={String(count)} onValueChange={v => setCount(Number(v))} disabled={busy}><SelectTrigger id="nearby-count"><SelectValue/></SelectTrigger><SelectContent>{[3, 5, 10, 15].map(n => <SelectItem key={n} value={String(n)}>{n}개</SelectItem>)}</SelectContent></Select></div></div>
        <label className="expand-toggle" htmlFor="nearby-expand"><Checkbox id="nearby-expand" checked={expand} onCheckedChange={value => setExpand(value === true)}/>후보가 부족하면 반경 확대 (최대 20km)</label>
        <Button type="submit" className="calculate-button" disabled={busy || locating || !status?.connected || !status?.placesConnected}><Search size={18}/>{busy ? "후보 비교 중…" : "주변 장소 비교"}</Button>
      </fieldset></form>
      {busy && <Button className="stop-button" type="button" variant="outline" onClick={() => active.current?.abort()}><Square size={14}/>조회 중단</Button>}
      <p className="field-note">최대 30곳의 후보를 4곳씩 병렬 조회합니다.<br/>검색 반경은 직선거리, 최종 순위는 자동차 경로 기준입니다.</p>
      <div className="connection">{!status ? "연결 확인 중" : status.connected && status.placesConnected ? "장소 검색 · 자동차 경로 연결됨" : "API 연결 설정이 필요합니다"}</div>
      {status && !status.placesConnected && <p className="connection-help">카카오 REST API 키와 카카오맵 사용 설정을 확인해 주세요.</p>}
    </section><section className="nearby-results" aria-busy={busy}>
      <div className="panel nearby-summary"><div className="result-heading"><h2>{snapshot ? `${snapshot.query} 비교 결과` : "자동차 경로 비교"}</h2>{visible.length > 0 && <Button variant="ghost" size="sm" onClick={csv} aria-label="상위 결과 CSV 다운로드"><Download size={16}/>CSV</Button>}</div>
      <Tabs value={sort} onValueChange={v => setSort(v as SortMode)}><TabsList className="ranking-tabs"><TabsTrigger value="time">자동차 시간순</TabsTrigger><TabsTrigger value="distance">도로 거리순</TabsTrigger><TabsTrigger value="recommended">추천순</TabsTrigger></TabsList></Tabs>
      {sort === "recommended" && <p className="field-note">후보군 내 정규화 점수: 시간 80% + 거리 20%. 낮을수록 우선하며, 평점·영업 여부는 포함하지 않습니다.</p>}
      {sort === "distance" && <p className="field-note">각 장소의 ‘실시간 빠른 길’에 해당하는 자동차 도로거리순입니다. 최단거리 전용 경로를 계산하는 방식은 아닙니다.</p>}
      {busy && <div className="progress-block" role="status"><p>{progress.phase} · {progress.done}/{progress.total || "…"}</p><Progress value={progress.total ? progress.done / progress.total * 100 : 0}/><p>진행 중 순위는 임시 결과입니다.</p></div>}
      {error && <div className="error-box" role="alert"><CircleAlert size={18}/>{error}</div>}
      {snapshot && <div className="search-context"><p><MapPin size={15}/>출발 · {snapshot.origin.address}</p><p>반경 {snapshot.search.searchedRadius / 1000}km{snapshot.search.expanded ? ` (${snapshot.search.requestedRadius / 1000}km에서 확대)` : ""} · 후보 {snapshot.search.candidates.length}곳 · 경로 성공 {ranked.length}곳 · {snapshot.completed ? "최종 순위" : "일부 결과"}</p><small>장소 목록 {clock(snapshot.search.checkedAt)} 기준{snapshot.search.cached ? " · 5분 이내 캐시" : ""}. 순위는 조회된 후보 안에서만 비교합니다.</small>{snapshot.search.warnings.map(w => <p key={w} className="connection-help">{w}</p>)}</div>}
      {snapshot?.completed && ranked.length < count && <p className="notice" role="status">{ranked.length === 0 ? "비교할 수 있는 경로가 없습니다. 검색어·출발지·반경 또는 실패 내역을 확인해 주세요." : `요청한 ${count}개보다 결과가 적어 ${ranked.length}개만 표시합니다.`}</p>}
      {!snapshot && !busy && <div className="empty-result"><CarFront size={34}/><h3>양꼬치집도, 카페도 한 번에</h3><p>검색하면 주변 후보의 도로거리와<br/>교통상황을 반영한 예상시간을 비교합니다.</p></div>}
      </div>
      {snapshot && <div className="panel map-panel"><NearbyMap clientId={status?.mapClientId || ""} origin={snapshot.origin} places={visible} selectedId={selected?.id} onSelect={choose}/>{selected && <div className="map-selection"><strong>{selected.name}</strong><span>{formatDuration(eta(selected)!)} · {(selected.drivingDistance! / 1000).toFixed(1)}km</span>{!selected.route?.path.length && <small>경로 선 표시 정보가 없습니다. 시간·거리는 조회된 값입니다.</small>}</div>}</div>}
      {visible.length > 0 && <ol className="nearby-list">{visible.map((place, index) => <li key={place.id} className={"panel place-card" + (place.id === selected?.id ? " active" : "")}><button className="place-select" type="button" aria-pressed={place.id === selected?.id} onClick={() => choose(place.id)}><span className="place-letter">{String.fromCharCode(65 + index)}</span><div><small>{index + 1}위 · {place.category}</small><h3>{place.name}</h3><p>{place.address}</p></div><div className="place-metrics"><strong>{formatDuration(eta(place)!)}</strong><span>{(place.drivingDistance! / 1000).toFixed(1)} km</span></div></button><div className="place-footer"><span>{place.route?.trafficAware ? "실시간 교통 반영" : "예상 자동차 이동시간"} · {place.route && clock(place.route.checkedAt)} 기준 · 통행료 {(place.route?.toll || 0).toLocaleString()}원</span><div><button type="button" onClick={() => choose(place.id)}>지도에서 보기</button>{place.placeUrl && <a href={place.placeUrl} target="_blank" rel="noopener noreferrer">장소 정보</a>}<a href={`https://map.kakao.com/link/to/${encodeURIComponent(place.name)},${place.latitude},${place.longitude}`} target="_blank" rel="noopener noreferrer">길찾기 열기</a></div></div></li>)}</ol>}
      {failures.length > 0 && <details className="panel nearby-summary failures"><summary>경로 조회 실패 {failures.length}곳</summary>{failures.map(p => <p key={p.id}><strong>{p.name}</strong> · {p.routeError}</p>)}</details>}
    </section></div><footer>장소 검색: Kakao Local · 경로·지도: NAVER Maps · 승용차 1종, 실시간 빠른 길<br/>교통 조회는 최대 45초 이내 캐시를 사용할 수 있습니다. 장소별 조회 시각과 현재 교통상황에 따라 결과가 달라집니다.<br/>평점·리뷰·영업·폐업 정보는 제공되지 않아 확인되지 않은 상태로 취급합니다. 방문 전 장소 정보를 확인하세요.</footer>
  </main>;
}
