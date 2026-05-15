import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
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
          playerId: user.playerId,
          teamId: user.teamId
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
        return {
          id: profile.sub,
          name: profile.acct.game_name,
          email: profile.email || `${profile.sub}@riot.com`,
          image: null,
          role: "member",
        };
      },
    }
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    ...authConfig.callbacks,
    async session({ session, token }) {
      if (session.user && token.id) {
        // Esta comprobación se ejecuta en Node.js (API routes), no en el Middleware
        const userExists = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { id: true }
        });

        if (!userExists) return null as any;

        session.user.id = token.id as string;
        (session.user as any).role = token.role as string;
        (session.user as any).playerId = token.playerId as number | null;
        (session.user as any).teamId = token.teamId as string | null;
      }
      return session;
    },
  },
});
