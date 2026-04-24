import { Header } from "@/components/Header";
import { Landing } from "@/components/Landing";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export default async function LandingPage() {
  const session = (await getServerSession(authOptions)) as any;

  if (session?.user?.email) {
    redirect("/dashboard");
    return null; // Ensure we don't render anything while redirecting
  }
  return (
    <div>
      <Header session={session} />
      <Landing />
    </div>
  );
}
