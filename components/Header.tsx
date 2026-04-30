import { Button } from "./ui/button";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import MobileMenu from "./MobileMenu";

interface HeaderProps {
  readonly user?: any;
  /** When the parent page already called getServerSession, pass it to avoid duplicate work. */
  readonly session?: Session | null;
}

export async function Header({ session: sessionProp }: HeaderProps) {
  const session =
    sessionProp !== undefined
      ? sessionProp
      : await getServerSession(authOptions);
  const isAuthed = !!session?.user;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-bb-surface/80 backdrop-blur-md border-b border-bb-border">
      <nav className="mx-auto max-w-7xl px-6 py-4 lg:px-8">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-linear-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">B</span>
            </div>
            <span className="text-xl font-bold text-bb-text">BoilerBridge</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <a
              href="#features"
              className="text-bb-text-sub hover:text-bb-text transition-colors"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="text-bb-text-sub hover:text-bb-text transition-colors"
            >
              How It Works
            </a>
            <a
              href="#testimonials"
              className="text-bb-text-sub hover:text-bb-text transition-colors"
            >
              Testimonials
            </a>
            {isAuthed ? (
              <Link href="/dashboard">
                <Button variant="ghost" className="text-bb-text-sub">
                  Dashboard
                </Button>
              </Link>
            ) : (
              <Link href="/signin">
                <Button variant="ghost" className="text-bb-text-sub">
                  Sign In
                </Button>
              </Link>
            )}
            <Link href="/signup">
              <Button className="bg-linear-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white">
                Get Started
              </Button>
            </Link>
          </div>

          <MobileMenu isAuthed={isAuthed} />
        </div>
      </nav>
    </header>
  );
}
