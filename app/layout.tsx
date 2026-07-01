import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Sans_TC, Sarabun } from "next/font/google";
import { LangProvider } from "@/lib/i18n";
import "./globals.css";

const sarabun = Sarabun({
  subsets: ["thai", "latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-sarabun",
  display: "swap",
});

const notoSansTC = Noto_Sans_TC({
  subsets: ["latin"],
  weight: ["400", "600", "700", "900"],
  variable: "--font-noto-tc",
  display: "swap",
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: 'DiaM Universal Inventory - ระบบจัดการคลังสินค้าอัจฉริยะ',
  description: 'แพลตฟอร์มบริหารจัดการสต็อกและวัสดุอุปกรณ์สำหรับทุกประเภทธุรกิจ มั่นใจด้วยระบบ Data Integrity และ Multi-Device Terminal',
  keywords: 'DiaM, Inventory System, คลังสินค้า, จัดการสต็อก, ระบบจัดการคลังสินค้า, ก่อสร้าง, ร้านอาหาร, ค้าปลีก',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'DiaM',
  },
  icons: {
    apple: '/icon-192.png',
  },
  other: {
    'apple-mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  themeColor: '#000000',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className={`${sarabun.variable} ${geistSans.variable} ${geistMono.variable} ${notoSansTC.variable} font-sans antialiased`}>
        <LangProvider>{children}</LangProvider>
      </body>
    </html>
  );
}