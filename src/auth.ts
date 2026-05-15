import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db as prisma } from "@/lib/db";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  trustHost: true,
  adapter: PrismaAdapter(prisma),
  providers: [
    ...authConfig.providers,
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string }
        });

        if (!user || !user.password) return null;

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isPasswordValid) return null;
        return { 
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          teamId: user.teamId,
          playerId: user.playerId
        };
      }
    }),
    {
      id: "riot-games",
      name: "Riot Games",
      type: "oidc",
      issuer: "https://auth.riotgames.com",
      clientId: process.env.AUTH_RIOT_ID,
      clientSecret: process.env.AUTH_RIOT_SECRET,
      authorization: {
        params: {
          scope: "openid offline_access",
        },
      },
      profile(profile: any) {
        console.log(`[auth] Riot Games profile callback - Sub: ${profile?.sub}`);
        return {
          id: profile.sub,
          name: profile.acct?.game_name || profile.name || "Riot User",
          email: profile.email || `${profile.sub}@riot.com`,
          image: profile.picture || null,
          role: "member"
        };
      },
    }
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.teamId = (user as any).teamId;
        token.playerId = (user as any).playerId;
      }
      return token;
    },
    async session({ session, token }) {
      console.log(`[auth] Session callback - Session User: ${session?.user?.email}, Token ID: ${token?.id}`);
      if (session?.user && token?.id) {
        try {
          // SACAMOS TODA LA INFO EN CALIENTE DE LA DB
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { 
              id: true, 
              name: true, 
              email: true, 
              role: true, 
              playerId: true, 
              teamId: true 
            }
          });

          if (!dbUser) {
            console.log(`[auth] !!! USER NOT FOUND IN DB: ${token.id} !!!`);
            throw new Error("SessionInvalid");
          }

          console.log(`[auth] User found: ${dbUser.email}, Team: ${dbUser.teamId}, Role: ${dbUser.role}`);
          session.user.id = dbUser.id;
          session.user.name = dbUser.name;
          session.user.email = dbUser.email || "";
          (session.user as any).role = dbUser.role;
          (session.user as any).playerId = dbUser.playerId;
          (session.user as any).teamId = dbUser.teamId;
        } catch (error: any) {
          console.error("[auth] Session callback error:", error);
          if (error.message === "SessionInvalid") {
             // Invalidate session cleanly without breaking NextAuth schemas
             session.user.id = "";
             return session;
          }
          return session;
        }
      }
      return session;
    },
  },
});
