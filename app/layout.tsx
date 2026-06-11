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
  title: 'DiaM Supply Chain - ระบบจัดการคลังสินค้า',
  description: 'แพลตฟอร์มบริหารจัดการสต็อกและคำสั่งซื้อจาก LINE Bot มั่นใจด้วยระบบ Data Integrity',
  keywords: 'DiaM, Supply Chain, Blockchain, คลังสินค้า, ร้านอาหาร',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}