import { Header } from "@/components/Header";
import { SignUp } from "@/components/SignUp";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

export default async function SignUpPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = await getServerSession(authOptions) as any;
  if (session) {
    redirect("/dashboard");
  }
  return (
    <div>
      <Header />
      <SignUp />
    </div>
  );
}
