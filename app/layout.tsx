import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./nearby.css";

export const metadata: Metadata = {
  title: "가까운 한 끼 · 실시간 자동차 소요시간",
  description: "주변 장소를 검색하고 실시간 교통을 반영한 자동차 이동시간과 도로거리로 비교하세요.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
