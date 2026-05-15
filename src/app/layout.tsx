import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { ClientLayout } from "@/components/ClientLayout";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "V-HUB — Valorant Premier Platform",
  description: "Plataforma de gestión para equipos de Valorant Premier: estrategias, disponibilidad, chat y estadísticas en tiempo real",
  manifest: "/manifest.json",
  icons: { icon: "/icon-192.png", apple: "/icon-512.png" },
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
  
  console.log("ROOT_LAYOUT: Session ID:", session?.user?.id);

  // Si hay sesión, verificar que el usuario siga existiendo en la DB
  if (session?.user?.id) {
    const userExists = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true }
    });

    console.log("ROOT_LAYOUT: User exists in DB?", !!userExists);

    if (!userExists) {
      console.log("ROOT_LAYOUT: User NOT found. Redirecting to logout...");
      // Si el usuario no existe (DB reset), forzamos logout
      redirect("/api/auth/signout?callbackUrl=/login");
    }
  }

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
