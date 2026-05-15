import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { ClientLayout } from "@/components/ClientLayout";
import { SessionGuard } from "@/components/SessionGuard";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "V-HUB — Valorant Premier Platform",
  description: "Plataforma de gestión para equipos de Valorant Premier: estrategias, disponibilidad, chat y estadísticas en tiempo real",
  manifest: "/manifest.json",
  icons: { 
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icon-512.png" 
  },
};

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0A0A0F",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  
  const { headers } = await import("next/headers");
  const h = await headers();
  const pathname = h.get("x-url") || h.get("x-invoke-path") || ""; 
  const isPublicPage = pathname === "/login" || pathname === "/register";
  const isOnboardingPage = pathname === "/onboarding";

  // Si hay sesión, verificar que el usuario siga existiendo y tenga equipo
  if (session?.user?.id) {
    const hasTeam = !!(session.user as any).teamId;

    if (!hasTeam && !isPublicPage && !isOnboardingPage) {
      redirect("/onboarding");
    }

    if (hasTeam && isOnboardingPage) {
      redirect("/");
    }
  }

  return (
    <html lang="es">
      <body>
        <Providers>
          <SessionGuard />
          <ClientLayout>
            {children}
          </ClientLayout>
        </Providers>
      </body>
    </html>
  );
}
