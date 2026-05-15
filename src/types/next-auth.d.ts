import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string; // super_admin, team_admin, member
      playerId?: number | null;
      teamId?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role: string;
    playerId?: number | null;
    teamId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    playerId?: number | null;
    teamId?: string | null;
  }
}
