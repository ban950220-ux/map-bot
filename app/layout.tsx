import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./nearby.css";

export const metadata: Metadata = {
  title: "가까운 한 끼 · 실시간 자동차 소요시간",
  description: "주변 장소를 검색하고 실시간 교통을 반영한 자동차 이동시간과 도로거리로 비교하세요.",
  applicationName: "가까운 한 끼",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/favicon.svg",
    apple: [{ url: "/icon-192.png", type: "image/png", sizes: "192x192" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#162b46",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link rel="manifest" href="/manifest.webmanifest" crossOrigin="use-credentials" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
