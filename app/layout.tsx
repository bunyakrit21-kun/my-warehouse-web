import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: 'DiaM Universal Inventory - ระบบจัดการคลังสินค้าอัจฉริยะ',
  description: 'แพลตฟอร์มบริหารจัดการสต็อกและวัสดุอุปกรณ์สำหรับทุกประเภทธุรกิจ มั่นใจด้วยระบบ Data Integrity และ Multi-Device Terminal',
  keywords: 'DiaM, Inventory System, คลังสินค้า, จัดการสต็อก, ระบบจัดการคลังสินค้า, ก่อสร้าง, ร้านอาหาร, ค้าปลีก',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}