import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import db from "@/lib/db";
import bcrypt from "bcryptjs";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      allowDangerousEmailAccountLinking: true,
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Rate limit login attempts per email
        const rl = rateLimit(`login:${credentials.email}`, RATE_LIMITS.login);
        if (!rl.allowed) {
          throw new Error("Too many login attempts. Please try again later.");
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.password) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          return null;
        }

        if (!user.isActive) {
          throw new Error("Account has been deactivated.");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          b2bStatus: user.b2bStatus,
          isActive: user.isActive,
        };
      },
    }),
  ],
  callbacks: {
    // Prevent deactivated users from signing in via OAuth
    async signIn({ account, profile }) {
      if (account?.provider === "google" && profile?.email) {
        const dbUser = await db.user.findUnique({
          where: { email: profile.email },
          select: { isActive: true },
        });
        // If user exists and is deactivated, block OAuth sign-in
        if (dbUser && !dbUser.isActive) {
          return false;
        }
      }
      return true;
    },

    async jwt({ token, user, account }) {
      // Initial sign-in (user object is present)
      if (user) {
        token.id = user.id;

        if (account?.provider === "google") {
          // For OAuth: user was just created/found by PrismaAdapter.
          // Re-fetch from DB to guarantee all custom fields are present.
          const dbUser = await db.user.findUnique({
            where: { id: user.id },
            select: { role: true, b2bStatus: true, isActive: true },
          });
          token.role = dbUser?.role ?? "CUSTOMER";
          token.b2bStatus = dbUser?.b2bStatus ?? "NOT_APPLIED";
          token.disabled = dbUser ? !dbUser.isActive : false;
        } else {
          // Credentials sign-in: user object already has all custom fields
          token.role = user.role;
          token.b2bStatus = user.b2bStatus;
          token.disabled = user.isActive === false;
        }
      }

      // Subsequent requests: refresh role/status from DB
      if (token.id && !user) {
        const dbUser = await db.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, b2bStatus: true, isActive: true },
        });
        if (!dbUser || !dbUser.isActive) {
          token.disabled = true;
          return token;
        }
        token.disabled = false;
        token.role = dbUser.role;
        token.b2bStatus = dbUser.b2bStatus;
      }

      return token;
    },

    async session({ session, token }) {
      if (token.disabled) {
        return null as any;
      }
      if (session.user) {
        session.user.role = token.role as string;
        session.user.id = token.id as string;
        session.user.b2bStatus = token.b2bStatus as string;
      }
      return session;
    },
  },
};
