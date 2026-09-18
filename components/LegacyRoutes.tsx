/* eslint-disable @next/next/no-html-link-for-pages -- Native navigation avoids the broken Vinext RSC Link prefetch path. */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUpRight, CarFront, Check, CircleAlert, Download, LoaderCircle, MapPin, Route, ShieldCheck, Square, Utensils } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import stores from "@/lib/stores.json";
import { formatDuration, type CompareResponse, type Point, type RouteFailure, type RouteResult } from "@/lib/types";
import { registerRouteTool } from "@/lib/webmcp";

type Query = { origin: string; mode: "stores" | "direct"; destination?: string };
type Report = { origin: Point; mode: "stores" | "direct"; startedAt: string; completed: boolean };
const clock = (value: string) => new Date(value).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });

async function post<T>(path: string, body: unknown, signal: AbortSignal): Promise<T> {
  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  let data: { error?: string };
  try { data = await response.json() as { error?: string }; } catch { throw new Error("로그인 상태를 확인한 뒤 사이트를 다시 열어 주세요."); }
  if (!response.ok) throw new Error(data.error || "요청을 처리하지 못했습니다.");
  return data as T;
}

export default function LegacyRoutes() {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [mode, setMode] = useState<"stores" | "direct">("stores");
  const [connected, setConnected] = useState<boolean | null>(null);
  const [connectionError, setConnectionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState("");
  const [results, setResults] = useState<RouteResult[]>([]);
  const [failures, setFailures] = useState<RouteFailure[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);
  const active = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/status", { signal: controller.signal }).then(async response => {
      const data = await response.json() as { error?: string; connected: boolean };
      if (!response.ok) throw new Error(data.error || "연결 상태를 확인하지 못했습니다.");
      setConnected(data.connected);
    }).catch(error => {
      if (!controller.signal.aborted) { setConnected(false); setConnectionError(error.message || "사이트를 새로고침해 주세요."); }
    });
    return () => { controller.abort(); active.current?.abort(); };
  }, []);

  const run = useCallback(async (query: Query) => {
    if (active.current) throw new Error("진행 중인 조회가 끝난 뒤 다시 시도해 주세요.");
    if (!query.origin.trim() || (query.mode === "direct" && !query.destination?.trim())) throw new Error("출발지와 도착지 주소를 입력해 주세요.");
    const controller = new AbortController();
    active.current = controller;
    setBusy(true); setError(""); setResults([]); setFailures([]); setProgress(0); setReport(null); setShowAll(false);
    setOrigin(query.origin); setMode(query.mode);
    if (query.destination !== undefined) setDestination(query.destination);
    const collected: RouteResult[] = [];
    const failed: RouteFailure[] = [];
    try {
      setPhase("출발지 주소를 확인하고 있어요");
      const point = await post<Point>("/api/geocode", { address: query.origin.trim() }, controller.signal);
      const snapshot: Report = { origin: point, mode: query.mode, startedAt: new Date().toISOString(), completed: false };
      setReport(snapshot);
      if (query.mode === "direct") {
        setPhase("도착지까지의 실시간 경로를 찾고 있어요");
        const data = await post<CompareResponse>("/api/compare", { mode: "direct", origin: point, destination: query.destination!.trim() }, controller.signal);
        collected.push(...data.results); failed.push(...data.failures);
        setProgress(1); setResults([...collected]); setFailures([...failed]);
      } else {
        for (let offset = 0; offset < stores.length; offset += 4) {
          setPhase("매장별 자동차 소요시간을 비교하고 있어요");
          const ids = stores.slice(offset, offset + 4).map(store => store.id);
          const data = await post<CompareResponse>("/api/compare", { mode: "stores", origin: point, ids }, controller.signal);
          collected.push(...data.results); failed.push(...data.failures);
          collected.sort((a, b) => a.durationMs - b.durationMs);
          setResults([...collected]); setFailures([...failed]); setProgress(Math.min(offset + ids.length, stores.length));
        }
      }
      setReport({ ...snapshot, completed: true });
      setPhase("조회 완료");
      if (!collected.length) throw new Error("조회된 경로가 없습니다. 주소 또는 아래 실패 내역을 확인해 주세요.");
      return { origin: point.address, completed: true, count: collected.length, failures: failed, results: collected.map(r => ({ name: r.brand === "직접 입력" ? r.name : r.brand + " " + r.name, address: r.address, minutes: Math.round(r.durationMs / 6000) / 10, distanceKm: Math.round(r.distanceM / 100) / 10, toll: r.toll, checkedAt: r.checkedAt })) };
    } catch (cause) {
      const message = controller.signal.aborted ? "조회를 중단했습니다. 아래에는 중단 전까지 확인한 결과만 표시됩니다." : cause instanceof Error ? cause.message : "조회 중 문제가 발생했습니다.";
      setError(message); setPhase("조회 중단");
      throw new Error(message);
    } finally { active.current = null; setBusy(false); }
  }, []);

  useEffect(() => registerRouteTool(run), [run]);

  function downloadCsv() {
    if (!results.length || !report) return;
    const cell = (value: string | number) => {
      let text = String(value);
      if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
      return '"' + text.replaceAll('"', '""') + '"';
    };
    const rows = [["순위", "브랜드", "도착지", "주소", "소요시간(분)", "거리(km)", "통행료(원)", "출발지", "조회시각", "전체조회완료"], ...results.map((r, i) => [i + 1, r.brand, r.name, r.address, (r.durationMs / 60000).toFixed(1), (r.distanceM / 1000).toFixed(1), r.toll, report.origin.address, r.checkedAt, report.completed ? "완료" : "일부 결과"])];
    const url = URL.createObjectURL(new Blob(["\uFEFF" + rows.map(row => row.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a"); link.href = url; link.download = "자동차_소요시간_" + new Date().toISOString().replaceAll(":", "-") + ".csv"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const total = (report?.mode ?? mode) === "stores" ? stores.length : 1;
  const best = results[0];
  const displayResults = showAll ? results.slice(1) : results.slice(1, 10);
  return <main className="site-shell">
    <header className="site-header"><a href="/" className="brand"><span className="brand-mark"><Route size={23}/></span>가까운 한 끼</a><span className="private-label"><ShieldCheck size={16}/>나만의 경로 비교</span></header>
    <section className="page-intro"><p className="eyebrow">지금 출발한다면</p><h1>어디가 가장 가까울까요?</h1><p>현재 교통상황으로 자동차 이동 시간을 비교하세요.</p></section>
    <div className="workspace">
      <section className="planner panel">
        <div className="section-title"><span className="step">01</span><h2>경로 설정</h2></div>
        <form onSubmit={event => { event.preventDefault(); void run({ origin, mode, destination }).catch(() => {}); }}>
          <fieldset disabled={busy}>
            <label htmlFor="origin">출발지 주소</label>
            <div className="input-wrap"><MapPin size={18}/><Input id="origin" value={origin} onChange={e => setOrigin(e.target.value)} placeholder="도로명 또는 지번 주소" required minLength={3} maxLength={200}/></div>
            <p className="origin-note">검색을 시작하려면 출발지를 입력해 주세요.</p>
            <Tabs value={mode} onValueChange={value => setMode(value as "stores" | "direct")}>
              <TabsList className="mode-tabs"><TabsTrigger value="stores" disabled={busy}><Utensils size={16}/>양꼬치집 비교</TabsTrigger><TabsTrigger value="direct" disabled={busy}><MapPin size={16}/>직접 입력</TabsTrigger></TabsList>
              <TabsContent value="stores"><div className="store-summary"><span>저장된 매장 전체</span><strong>{stores.length}<span>곳</span></strong><p>이가네양꼬치 43곳 · 램미가 13곳</p></div><p className="catalog-note">매장 목록 · 2026.08.17 기준<br/>각 매장의 소요시간은 지금 새로 조회합니다.</p></TabsContent>
              <TabsContent value="direct"><label htmlFor="destination">도착지 주소</label><Input id="destination" value={destination} onChange={e => setDestination(e.target.value)} required={mode === "direct"} minLength={3} maxLength={200} placeholder="예: 수원시 영통구 청명남로28번길 2"/><p className="field-note">장소 이름 대신 도로명 또는 지번 주소를 입력하세요.</p></TabsContent>
            </Tabs>
            <Button type="submit" className="calculate-button" disabled={busy || connected !== true}>{busy ? <LoaderCircle className="spin" size={19}/> : <CarFront size={19}/>} {busy ? "조회 중" : mode === "stores" ? "소요시간 비교" : "자동차 경로 조회"}{!busy && <ArrowRight size={18}/>}</Button>
          </fieldset>
        </form>
        {busy && <Button type="button" className="stop-button" variant="outline" onClick={() => active.current?.abort()}><Square size={14}/>조회 중단</Button>}
        <p className="field-note center">NAVER Maps · 실시간 최적 경로</p>
        <div className={"connection " + (connected === true ? "ready" : "")}>{connected === null ? <><LoaderCircle className="spin" size={14}/>연결 확인 중</> : connected ? <><ShieldCheck size={16}/>인증정보 자동 연결됨</> : <><CircleAlert size={16}/>연결 확인이 필요합니다</>}</div>
        {connected === false && <p className="connection-help">{connectionError || "이 사이트를 만든 대화에서 NAVER 인증정보 연결을 요청해 주세요. 한 번 연결하면 계속 사용할 수 있습니다."}</p>}
      </section>
      <section className="results panel" aria-busy={busy}>
        <div className="result-heading"><div className="section-title"><span className="step">02</span><h2>{report?.mode === "direct" ? "자동차 경로 결과" : "소요시간 순위"}</h2></div>{results.length > 0 && <Button type="button" variant="ghost" size="sm" onClick={downloadCsv} aria-label="현재 조회 결과 CSV 다운로드"><Download size={16}/><span>CSV</span></Button>}</div>
        {busy && <div className="progress-block" role="status"><div><span>{phase}</span><strong>{progress} / {total}</strong></div><Progress value={progress / total * 100} aria-label="매장 경로 조회 진행률"/><p>조회가 끝나면 최종 순위가 정해집니다.</p></div>}
        {error && <div className="error-box" role="alert"><CircleAlert size={19}/><span>{error}</span></div>}
        {report && <div className="report-context"><MapPin size={15}/><div><span>출발 · {report.origin.address}</span><small>{clock(report.startedAt)} 조회 시작 · {report.completed ? "조회 완료" : "일부 결과"}{report.completed && " · " + results.length + "곳 성공"}</small></div></div>}
        {!best && !busy && !error && <div className="empty-result"><div className="empty-icon"><CarFront size={38} strokeWidth={1.4}/></div><h3>출발지를 정하고 비교해 보세요</h3><p>가장 빨리 도착할 수 있는 매장부터<br/>소요시간, 거리, 통행료를 보여드려요.</p><div className="route-key"><span>A · 출발지</span><span className="route-line"/><MapPin size={16}/><span>B · 도착지</span></div></div>}
        {best && <><div className="winner"><div className="winner-top"><span>{report?.mode === "direct" ? "자동차 이동" : report?.completed ? failures.length ? "조회 성공 매장 중 가장 빠른 곳" : "가장 빠르게 도착하는 곳" : "지금까지 조회한 매장 중 1위"}</span><span className="winner-tag">{busy ? <LoaderCircle size={14} className="spin"/> : <Check size={14}/>}{busy ? "조회 중" : report?.completed ? "조회 완료" : "일부 결과"}</span></div><p className="winner-brand">{best.brand !== "직접 입력" && best.brand}</p><h3>{best.name}</h3><div className="winner-time">{formatDuration(best.durationMs)}</div><div className="winner-stats"><span>{(best.distanceM / 1000).toFixed(1)} km</span><span>통행료 {best.toll.toLocaleString()}원</span></div><p className="winner-address">{best.address}</p><div className="winner-foot"><span>{clock(best.checkedAt)} 기준</span><a target="_blank" rel="noopener noreferrer" href={"https://map.naver.com/p/search/" + encodeURIComponent(best.address)}>네이버 지도에서 보기<ArrowUpRight size={16}/></a></div></div>
          {displayResults.length > 0 && <ol className="rank-list" start={2}>{displayResults.map((r,i) => <li key={r.id}><span className="rank-number">{i + 2}</span><div className="rank-main"><p>{r.brand} <strong>{r.name}</strong></p><small>{r.address}</small><div className="rank-meta">{(r.distanceM / 1000).toFixed(1)} km <span>·</span> 통행료 {r.toll.toLocaleString()}원</div></div><div className="rank-time">{formatDuration(r.durationMs)}<small>{clock(r.checkedAt)}</small></div></li>)}</ol>}
          {results.length > 10 && <Button type="button" variant="outline" className="show-more" onClick={() => setShowAll(!showAll)}>{showAll ? "상위 10곳만 보기" : "나머지 " + (results.length - 10) + "곳 모두 보기"}<ArrowDown size={16}/></Button>}
        </>}
        {failures.length > 0 && <details className="failures"><summary>조회하지 못한 매장 {failures.length}곳</summary><ul>{failures.map(f => <li key={f.id}><strong>{f.name}</strong><p>{f.message}</p></li>)}</ul></details>}
      </section>
    </div>
    <footer>승용차 1종 · 실시간 최적 경로 기준<br/>매장별 조회 시각이 조금씩 다르며, 교통상황에 따라 소요시간이 달라집니다.<br/><a href="https://api.ncloud-docs.com/docs/application-maps-directions5" target="_blank" rel="noopener noreferrer">NAVER Maps 안내</a></footer>
  </main>;
}
