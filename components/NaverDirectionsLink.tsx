"use client";
import type { MouseEvent } from "react";
import type { Point } from "@/lib/types";
import { isAndroidUserAgent, naverAndroidDirectionsUrl, naverWebDirectionsUrl } from "@/lib/naverDirectionsLink";

type Destination = { name: string; latitude: number; longitude: number };

export default function NaverDirectionsLink({ origin, originName, destination }: { origin: Point; originName: string; destination: Destination }) {
  function open(event: MouseEvent<HTMLAnchorElement>) {
    if (!isAndroidUserAgent(navigator.userAgent)) return;
    event.currentTarget.href = naverAndroidDirectionsUrl(origin, originName, destination, window.location.origin);
    event.currentTarget.target = "_self";
  }

  return <a href={naverWebDirectionsUrl(origin, originName, destination)} target="_blank" rel="noopener noreferrer" onClick={open}>네이버 길찾기 열기</a>;
}
