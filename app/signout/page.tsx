import { Header } from "@/components/Header";
import { SignOut } from "@/components/SignOut";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

export default async function SignOutPage() {
   
  const session = (await getServerSession(authOptions)) as any;

  if (!session?.user?.email) {
    redirect("/");
  }

  return (
    <div>
      <Header session={session} />
      <SignOut />
    </div>
  );
}
