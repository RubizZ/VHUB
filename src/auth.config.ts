import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

// This configuration is compatible with the Edge Runtime
export const authConfig = {
  providers: [
    // We leave this empty or with basic providers. 
    // Credentials provider needs bcrypt which is not Edge compatible, 
    // so it will be added in the main auth.ts file.
  ],
  callbacks: {
    async authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const hasTeam = !!(auth?.user as any)?.teamId;
            const isLoginPage = nextUrl.pathname === "/login";
      const isRegisterPage = nextUrl.pathname === "/register";
      const isOnboardingPage = nextUrl.pathname === "/onboarding";
      const isLandingPage = nextUrl.pathname === "/";

      // Allow public access to login, register, and landing pages
      if (!isLoggedIn) {
        if (isLoginPage || isRegisterPage || isLandingPage) return true;
        return false; // Redirect to login
      }

      // User is logged in
      if (isLoginPage || isRegisterPage) {
        return Response.redirect(new URL("/", nextUrl));
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
} satisfies NextAuthConfig;
