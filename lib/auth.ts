 
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import clientPromise from "./mongodb";
import { validateLogin } from "./validateLogin";
import { JWT } from "next-auth/jwt";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: {
          label: "Email",
          type: "email",
          placeholder: "youremail@test.com",
        },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await validateLogin(
          credentials.email,
          credentials.password,
        );

        if (!user) return null;

        const mongoId = (user as any)._id?.toString();
        const uuid = (user as any).userId;

        if (!mongoId || !uuid) return null;

        return {
          id: mongoId,
          userId: uuid,
          email: user.email,
          name: user.username,
          username: user.username,
          image: (user as any).image || null,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, user, trigger, session }): Promise<JWT> {
      // initial sign in
      if (user) {
        token.id = (user as any).id;
        token.userId = (user as any).userId;
        token.username = (user as any).username;
        token.picture = (user as any).image;
      }

      // manual updates from ProfilePage
      if (trigger === "update" && session) {
        token.name = session.name || token.name;
        token.picture = session.image || token.picture;
        token.isStudentVerified =
          session.user?.isStudentVerified ?? token.isStudentVerified;
        token.eduEmail = session.user?.eduEmail ?? token.eduEmail;
      }

      // only sync with DB if we have an email and it's not a static request
      // this prevents the loop from hijacking the redirect flow
      if (token?.email) {
        try {
          const client = await clientPromise;
          const db = client.db("BoilerBridge");
          const dbUser = await db
            .collection("users")
            .findOne({ email: token.email });

          if (!dbUser) {
            // if user is deleted, we invalidate the token fields
            // but keep the shape valid for TS
            return {
              ...token,
              email: null,
              userId: undefined,
              id: undefined,
            } as unknown as JWT;
          }

          if (dbUser) {
            token.name = dbUser.username || dbUser.name || token.name;
            token.picture = dbUser.image || token.picture;
            token.isStudentVerified =
              dbUser.settings?.security?.isStudentVerified ?? false;
            token.eduEmail = dbUser.eduEmail || null;
          }
        } catch (error) {
          // log it but don't kill the session, otherwise u loop forever
          console.error("Auth Callback DB Error:", error);
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        (session.user as any).id = token.id as string;
        (session.user as any).userId = token.userId as string;
        (session.user as any).username = token.username as string;
        session.user.image = token.picture as string;
        session.user.name = token.name as string;
        (session.user as any).isStudentVerified = token.isStudentVerified;
        (session.user as any).eduEmail = token.eduEmail;
      }
      return session;
    },
  },
  pages: {
    signIn: "/signin",
    error: "/signin", // redirect errors back to signin instead of default error page
  },
};
