import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import DemoBanner from "@/components/DemoBanner";
import PieManual from "@/components/PieManual";
import AvisoCuenta from "@/components/AvisoCuenta";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sistema de Reservas",
  description: "Sistema de gestión de reservas y vuelos",
  // app/icon.svg es el de Reservaps, igual en todos los subdominios. El logo de
  // cada empresa es otra cosa: va dentro de la pantalla, no en la pestaña.
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#f0f4f8]">
        <DemoBanner />
        <AvisoCuenta>{children}</AvisoCuenta>
        <PieManual />
      </body>
    </html>
  );
}
