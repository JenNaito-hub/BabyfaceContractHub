import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aescentic OS",
  description: "Lớp vận hành trung tâm của Aescentic",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
