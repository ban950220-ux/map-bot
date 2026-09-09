import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "가까운 한 끼 · 실시간 자동차 소요시간",
  description: "출발지와 도착지의 자동차 이동 시간과 양꼬치 매장의 소요시간을 비교하세요.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

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
