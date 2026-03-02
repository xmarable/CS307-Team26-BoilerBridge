import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import clientPromise from "./mongodb";
import { validateLogin } from "./validateLogin";

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: 'Credentials',
            credentials: {
                email: { label: "Email", type: "email", placeholder: "youremail@test.com" },
                password: { label: "Password", type: 'password' },
            },
            async authorize(credentials, req) {
                if (!credentials?.email || !credentials?.password) {
                    return null;
                }

        const user = await validateLogin(
          credentials.email,
          credentials.password,
        );
        if (!user) return null;

                // Use Mongo _id as the stable identifier for sessions
                const mongoId = (user as any).userId ?? undefined;
                if (!mongoId) return null;

        return {
          id: mongoId,
          email: user.email,
          name: user.username,
          username: user.username,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.username = (user as any).username;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id as string;
        (session.user as any).username = token.username as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/signin",
  },
};
