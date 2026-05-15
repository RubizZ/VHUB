import { DefaultSession, DefaultUser } from "next-auth";
import { JWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      playerId: number | null;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    role: string;
    playerId: number | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string;
    playerId: number | null;
  }
}
