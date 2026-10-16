import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SamiTicket | La fiesta de Huancayo y el Perú",
  description: "Venta de entradas oficiales para fiestas patronales, Huaylarsh, orquestas del centro y eventos folclóricos con código QR seguro.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={jakarta.variable}>
      <body className={jakarta.className}>{children}</body>
    </html>
  );
}
