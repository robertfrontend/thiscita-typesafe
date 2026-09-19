import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OBRA | TypeSafe Lab",
  description:
    "Zona de pruebas para buscar servicios, revisar propuestas y organizar una agenda personal con TypeSafe.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
