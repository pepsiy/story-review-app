import type { Metadata } from "next";
import { Geist, Geist_Mono, Roboto, Outfit } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    template: "%s | Tóm Tắt Truyện",
    default: "Tóm Tắt Truyện - Review & Tóm tắt nhanh",
  },
  description: "Nền tảng review và tóm tắt truyện tranh, tiểu thuyết nhanh gọn, chính xác.",
  openGraph: {
    title: "Tóm Tắt Truyện - Review & Tóm tắt nhanh",
    description: "Cập nhật review, tóm tắt highlight các bộ truyện hot nhất. Đọc nhanh, hiểu sâu, không tốn thời gian.",
    url: "https://tomtat.com.vn",
    siteName: "Tóm Tắt Truyện",
    locale: "vi_VN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tóm Tắt Truyện - Review & Tóm tắt nhanh",
    description: "Nền tảng review và tóm tắt truyện tranh, tiểu thuyết nhanh gọn.",
  },
};

import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ChatPopup } from "@/components/ChatPopup";
import { auth } from "@/auth";
import { Toaster } from "sonner";

import { Providers } from "@/components/Providers";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

import NextTopLoader from "nextjs-toploader";
import GoogleAnalytics from "@/components/GoogleAnalytics";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let session;
  try {
    session = await auth();
  } catch (e) {
    console.warn("⚠️ Auth failed during build (safe to ignore):", e);
  }

  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  return (
    <html lang="vi">
      <body
        className={`${roboto.variable} ${geistSans.variable} ${geistMono.variable} ${outfit.variable} antialiased`}
      >
        <GoogleAnalytics measurementId={gaId} />
        <Providers>
          <NextTopLoader color="#2563eb" showSpinner={false} />
          <Header />
          {children}
          <Toaster />
          <Footer />
          <ChatPopup user={session?.user} />
        </Providers>
      </body>
    </html>
  );
}
