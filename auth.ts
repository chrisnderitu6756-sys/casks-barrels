import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Secret is read from AUTH_SECRET / NEXTAUTH_SECRET by Auth.js itself.
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email =
          typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) return null;

        // Loaded lazily so the DB driver is only pulled in when actually signing in
        // (keeps it out of the middleware's startup path).
        const { db } = await import("@/lib/db");
        const [rep] = await db
          .select()
          .from(schema.reps)
          .where(eq(schema.reps.email, email))
          .limit(1);
        if (!rep?.passwordHash) return null;

        const ok = await bcrypt.compare(password, rep.passwordHash);
        if (!ok) return null;

        return { id: rep.id, name: rep.name, email: rep.email, role: rep.role };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "manager" | "rep";
      }
      return session;
    },
  },
});
