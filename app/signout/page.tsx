import { Header } from "@/components/Header";
import { SignOut } from "@/components/SignOut";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

export default async function SignOutPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = await getServerSession(authOptions) as any;

  if (!session) {
    redirect("/");
  }

  return (
    <div>
      <Header />
      <SignOut />
    </div>
  );
}