import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { ClientLayout } from "@/components/ClientLayout";

export const metadata: Metadata = {
  title: "V-HUB — Valorant Premier Platform",
  description: "Plataforma de gestión para equipos de Valorant Premier: estrategias, disponibilidad, chat y estadísticas en tiempo real",
  manifest: "/manifest.json",
  icons: { icon: "/icon-192.png", apple: "/icon-512.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0A0A0F",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <Providers>
          <ClientLayout>
            {children}
          </ClientLayout>
        </Providers>
      </body>
    </html>
  );
}
