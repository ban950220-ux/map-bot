"use client";
import { useSyncExternalStore } from "react";
import type { Point } from "@/lib/types";
import { isAndroidUserAgent, naverAndroidDirectionsUrl, naverWebDirectionsUrl } from "@/lib/naverDirectionsLink";

type Destination = { name: string; latitude: number; longitude: number };
const subscribe = () => () => {};
const onClient = () => isAndroidUserAgent(navigator.userAgent);
const onServer = () => false;

export default function NaverDirectionsLink({ origin, originName, destination }: { origin: Point; originName: string; destination: Destination }) {
  const android = useSyncExternalStore(subscribe, onClient, onServer);

  return <>
    <a href={naverWebDirectionsUrl(origin, originName, destination)} target="_blank" rel="noopener noreferrer">네이버 길찾기 열기</a>
    {android && <a href={naverAndroidDirectionsUrl(origin, originName, destination, window.location.origin)}>네이버 앱에서 길찾기</a>}
  </>;
}
