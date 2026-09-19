import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OBRA | Herramientas de revisión",
  description: "Zona de pruebas para encontrar servicios y revisar propuestas.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
