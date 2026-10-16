import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SamiTicket | Eventos locales",
  description: "Crea, vende y controla eventos locales desde tu celular.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
