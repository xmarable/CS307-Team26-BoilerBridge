import { Header } from "@/components/Header";
import { SignIn } from "@/components/SignIn";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

export default async function SignInPage() {
  const session = await getServerSession(authOptions) as any;
  if (session) {
    redirect("/dashboard");
  }

  return <div><Header /><SignIn /></div>;
}