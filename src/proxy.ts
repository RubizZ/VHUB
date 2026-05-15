import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isLoginPage = req.nextUrl.pathname === "/login";
  const isRegisterPage = req.nextUrl.pathname === "/register";
  
  // Añadimos la URL actual a los headers para que RootLayout pueda leerla (para el check "en caliente")
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-url', req.nextUrl.pathname);

  // 1. Redirección si no está logueado
  if (!isLoggedIn && !isLoginPage && !isRegisterPage) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  // 2. Redirección si ya está logueado e intenta ir a login o register
  if (isLoggedIn && (isLoginPage || isRegisterPage)) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  // Nota: La lógica de "hasTeam" y "onboarding" se maneja en el RootLayout 
  // para que sea 100% "en caliente" consultando la DB.

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|manifest.json|icon-.*\\.png).*)"],
};
