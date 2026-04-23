import { Header } from "@/components/Header";
import { SignUp } from "@/components/SignUp";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

export default async function SignUpPage() {
   
  const session = (await getServerSession(authOptions)) as any;
  if (session?.user) {
    redirect("/dashboard");
  }
  return (
    <div>
      <Header session={session} />
      <SignUp />
    </div>
  );
}
