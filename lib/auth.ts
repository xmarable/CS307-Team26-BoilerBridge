/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import dbConnect from "./dbConnect";
import User from "@/models/User";
import { use } from "react";

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
                // @ts-expect-error: Custom ID added to session via JWT token
                session.user.id = token.id;
            }

            return session;
        }
    },
    pages: {
        signIn: "/login",
    }
}

export async function validateLogin(email: string, password: string) {
    const user = await User.findOne({ email: email });
    if (!user) return null;

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) return null;
    
    return user;
}