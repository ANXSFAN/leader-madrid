import NextAuth, { DefaultSession } from "next-auth";
import { JWT } from "next-auth/jwt";
import { Role, B2BStatus } from "@prisma/client";

declare module "next-auth" {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: {
      id: string;
      role: Role | string;
      b2bStatus: B2BStatus | string;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: Role | string;
    b2bStatus: B2BStatus | string;
    isActive?: boolean;
  }
}

declare module "next-auth/jwt" {
  /** Returned by the `jwt` callback and `getToken`, when using JWT sessions */
  interface JWT {
    id: string;
    role: Role | string;
    b2bStatus: B2BStatus | string;
    disabled?: boolean;
  }
}
