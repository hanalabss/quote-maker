import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";

const notoSansKR = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "QuoteMaker - 견적서 자동화",
  description: "하나플랫폼 견적서 자동화 시스템",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className={`min-h-screen bg-gray-50 text-gray-900 antialiased ${notoSansKR.className}`}>
        {children}
      </body>
    </html>
  );
}
