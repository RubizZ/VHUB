import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
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
          role: "member", // Rol por defecto para nuevos usuarios de Riot
        };
      },
    }
  ],
  callbacks: {
    async jwt({ token, user, account, profile }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.playerId = user.playerId;
        token.teamId = user.teamId;
      }
      
      // Si el usuario se acaba de vincular con Riot
      if (account?.provider === "riot-games" && profile) {
        // Aquí podríamos actualizar el PUUID del jugador automáticamente
        token.riotId = profile.sub;
      }
      
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.playerId = token.playerId as number | null;
        session.user.teamId = token.teamId as string | null;
      }
      return session;
    }
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
});
