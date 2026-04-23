import { Header } from "@/components/Header";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { ResetPassword } from "@/components/ResetPassword";

export default async function ResetPasswordPage() {
    const session = await getServerSession(authOptions);
    if (session?.user?.email) {
        redirect("/dashboard");
    }

    return (
        <div>
            <Header session={session} />
            <ResetPassword />
        </div>
    )
}