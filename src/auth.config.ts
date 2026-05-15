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
      const isLoginPage = nextUrl.pathname === "/login";

      if (!isLoggedIn && !isLoginPage) {
        return false; // Redirect to login
      }
      if (isLoggedIn && isLoginPage) {
        return Response.redirect(new URL("/", nextUrl));
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.playerId = (user as any).playerId;
        token.teamId = (user as any).teamId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string;
        (session.user as any).role = token.role as string;
        (session.user as any).playerId = token.playerId as number | null;
        (session.user as any).teamId = token.teamId as string | null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
} satisfies NextAuthConfig;
