import { Header } from "@/components/Header";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { SignIn } from "@/components/SignIn";

export default async function SignInPage() {
  const session = (await getServerSession(authOptions)) as any;
  if (session) {
    redirect("/dashboard");
  }

  return (
    <div>
      <Header />
      <SignIn />
    </div>
  );
}
