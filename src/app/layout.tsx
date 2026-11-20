import type { Metadata } from "next";
import { Manrope, Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { AppExperience } from '@/components/app-feedback';

const inter = Inter({subsets:['latin'],variable:'--font-body'});
const manrope = Manrope({subsets:['latin'],variable:'--font-display'});

export const metadata: Metadata = {
  title: "SamiTicket | La fiesta de Huancayo y el Perú",
  description: "Venta de entradas oficiales para fiestas patronales, Huaylarsh, orquestas del centro y eventos folclóricos con código QR seguro.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={cn("dark", inter.variable, manrope.variable)}>
      <body className={inter.className}><AppExperience>{children}</AppExperience></body>
    </html>
  );
}
