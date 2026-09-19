import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "thiscita | Boston services navigator",
  description: "Bilingual navigation to curated Massachusetts and federal government services.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
