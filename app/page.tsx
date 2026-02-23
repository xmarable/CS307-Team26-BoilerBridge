import { Header } from "@/components/Header";
import { Landing } from "@/components/Landing";
import { getServerSession } from "next-auth";
import { redirect } from "next/dist/client/components/navigation"
import { authOptions } from "./api/auth/[...nextauth]/route";

export default async function LandingPage() {
  const session = await getServerSession(authOptions) as any;

  // Temporary debug log
  console.log("SERVER SESSION:", session ? "Active" : "None");

  if (session) {
    redirect("/dashboard");
  }
  return (
  <div>
    <Header user={session?.user} />
    <Landing user={session?.user} />
  </div>
  );
}