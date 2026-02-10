import type { Metadata } from "next";
import "./globals.css";

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
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
