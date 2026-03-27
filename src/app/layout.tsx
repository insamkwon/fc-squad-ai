import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/common/Navigation";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FC Squad AI - FC Online AI Squad Builder",
  description: "FC Online AI 기반 자동 스쿼드 추천 + 선수 데이터베이스",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#111827",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-gray-950 text-white">
        <Navigation />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-gray-800 bg-gray-900 py-3 sm:py-4 text-center text-xs text-gray-500 safe-bottom">
          FC Squad AI - Powered by Nexon FC Online Open API
        </footer>
      </body>
    </html>
  );
}
