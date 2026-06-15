import { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { ClientLayout } from "@/components/ClientLayout";
import { SessionGuard } from "@/components/SessionGuard";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getLocale } from "next-intl/server";

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

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  const { headers } = await import("next/headers");
  const h = await headers();
  const pathname = h.get("x-url") || h.get("x-invoke-path") || "";
  const isPublicPage = pathname === "/login" || pathname === "/register";
  const isOnboardingPage = pathname === "/onboarding";

  // Si hay sesión, verificar que el usuario siga existiendo y tenga equipo
  if (session?.user?.id) {
    const hasTeam = !!session.user.teamId;

    if (!hasTeam && !isPublicPage && !isOnboardingPage) {
      redirect("/onboarding");
    }

    if (hasTeam && isOnboardingPage) {
      redirect("/");
    }
  }

  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale.split('-')[0]}>
      <body>
        <NextIntlClientProvider messages={messages} locale={locale}>
          <Providers>
            <SessionGuard />
            <ClientLayout>
              {children}
            </ClientLayout>
          </Providers>
        </NextIntlClientProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
