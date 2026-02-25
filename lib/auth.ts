import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
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
                if (!credentials?.email || !credentials.password) {
                    return null;
                }

                const user = await validateLogin(credentials.email, credentials.password);
                if (!user) return null;

                // Use Mongo _id as the stable identifier for sessions
                const mongoId = (user as any)._id?.toString?.() ?? undefined;
                if (!mongoId) return null;

                return { id: mongoId, email: user.email, name: user.username };
            }
        }),
    ],
    session: {
        strategy: "jwt"
    },
    secret: process.env.NEXTAUTH_SECRET,
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                // Propagate the user id into the JWT so it is available in the session callback.
                (token as any).id = (user as any).id;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user && (token as any).id) {
                (session.user as any).id = (token as any).id;
            }

            return session;
        },
    },
    pages: {
        signIn: "/login",
    }
}