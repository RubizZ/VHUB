/* eslint-disable no-undef */
"use client";
import { signOut, useSession } from "next-auth/react";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function SessionGuard() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  useEffect(() => {
    const isPublicPage = pathname === "/login" || pathname === "/register" || pathname === "/";

    // CASO 1: El servidor ha invalidado la sesión (ej: tras un seed)
    // pero el navegador podría tener aún residuos. Limpiamos y mandamos al login.
    if (status === "unauthenticated" && !isPublicPage) {
      console.log("[SessionGuard] No session or invalid session. Redirecting to login...");
      signOut({ callbackUrl: "/login", redirect: true });
      return;
    }

    // CASO 2: Sesión detectada como 'authenticated' pero sin ID de usuario (sesión zombie).
    if (status === "authenticated" && !session?.user?.id) {
      console.log("[SessionGuard] Zombie session detected. Clearing cookies...");
      signOut({ callbackUrl: "/login", redirect: true });
    }
  }, [session, status, pathname]);

  return null;
}
