import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import dbConnect from "./dbConnect";
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

                await dbConnect();

                const user = await validateLogin(credentials.email, credentials.password);
                if (!user) return null;

                return { id: user.id.toString(), email: user.email, name: user.username };
                //return {id: "1", email:"test@test.com", name: "test_user"};
            }
        }),
    ],
    session: {
        strategy: "jwt"
    },
    secret: process.env.NEXTAUTH_SECRET,
    callbacks: {
        async jwt({token, user}) {
            if (user) {
                token.id = user.id;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                // @ts-ignore
                session.user.id = token.id;
            }

            return session;
        }
    },
    pages: {
        signIn: "/login",
    }
}