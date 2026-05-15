import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isLoginPage = req.nextUrl.pathname === "/login";
  const isRegisterPage = req.nextUrl.pathname === "/register";
  const isOnboardingPage = req.nextUrl.pathname === "/onboarding";
  const role = (req.auth?.user as any)?.role;
  const hasTeam = !!(req.auth?.user as any)?.teamId;
  const path = req.nextUrl.pathname;

  // 1. Redirección si no está logueado
  if (!isLoggedIn && !isLoginPage && !isRegisterPage) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  // 2. Redirección si ya está logueado e intenta ir a login o register
  if (isLoggedIn && (isLoginPage || isRegisterPage)) {
    return NextResponse.redirect(new URL(hasTeam ? "/" : "/onboarding", req.nextUrl));
  }

  // 3. Redirección a onboarding si no tiene equipo
  if (isLoggedIn && !hasTeam && !isOnboardingPage) {
    return NextResponse.redirect(new URL("/onboarding", req.nextUrl));
  }

  // 4. Redirección fuera de onboarding si YA tiene equipo
  if (isLoggedIn && hasTeam && isOnboardingPage) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  // 3. Protección de rutas administrativas globales
  if (path.startsWith("/admin") && role !== "super_admin") {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  // 4. Protección de rutas de gestión de equipo
  if (path.startsWith("/settings/team") && role !== "team_admin" && role !== "super_admin") {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|manifest.json|icon-.*\\.png|login).*)"],
};
