import React from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import SignOut from "@/components/SignOut";

// ENV Vars check for dev
console.log("ENV CHECK", {
  hasMongoDBSecret: !!process.env.MONGODB_URI,
  hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
  hasAuthSecret: !!process.env.AUTH_SECRET,
  nextAuthUrl: process.env.NEXTAUTH_URL,
})

export default async function Home() {
  const session = await getServerSession(authOptions);
  return ( 
    <div>
      {JSON.stringify(session)}
      {session && <SignOut/>}
    </div>
  );
}