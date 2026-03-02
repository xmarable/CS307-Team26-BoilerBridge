import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import clientPromise from "./mongodb";
import { validateLogin } from "./validateLogin";

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

        // mongoId is the Mongo ObjectId string, userId is the UUID string
        const mongoId = (user as any)._id?.toString();
        const uuid = (user as any).userId;

        if (!mongoId || !uuid) return null;

        return {
          id: mongoId,
          userId: uuid,
          email: user.email,
          name: user.username,
          username: user.username,
          image: (user as any).image || null, // get initial image if it exists
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = (user as any).id;
        token.userId = (user as any).userId;
        token.username = (user as any).username;
        token.picture = (user as any).image;
      }

      // manual updates from ProfilePage (update() call)
      if (trigger === "update" && session) {
        token.name = session.name || token.name;
        token.picture = session.image || token.picture;
      }

      // always get latest profile data from BoilerBridge DB to keep Navbar in sync
      try {
        const client = await clientPromise;
        const db = client.db("BoilerBridge");
        const dbUser = await db
          .collection("users")
          .findOne({ email: token.email });

        if (dbUser) {
          token.name = dbUser.name || token.name;
          token.picture = dbUser.image || token.picture;
        }
      } catch (error) {
        console.error("Auth Callback DB Error:", error);
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id as string;
        (session.user as any).userId = token.userId as string;
        (session.user as any).username = token.username as string;
        session.user.image = token.picture as string;
        session.user.name = token.name;
      }
      return session;
    },
  },
  pages: {
    signIn: "/signin",
  },
};
