import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isLoginPage = req.nextUrl.pathname === "/login";
  const role = req.auth?.user?.role;
  const path = req.nextUrl.pathname;

  // 1. Redirección si no está logueado
  if (!isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  // 2. Redirección si ya está logueado e intenta ir a login
  if (isLoggedIn && isLoginPage) {
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
