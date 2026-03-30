"use client";

import { Mail } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Footer } from "./Footer";

export function SignIn() {
   
  const router = useRouter();

  const handleSignIn = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const formData = new FormData(e.currentTarget);

    const res = await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirect: false
    });

    if (res?.ok) {
        router.refresh();
        router.push("/");
    } else {
        alert("Invalid Credentials");
    }
  };

  return (
    <div>
    <main>
    <div className="min-h-screen bg-linear-to-br from-amber-50 to-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="grid md:grid-cols-2">
          <div className="hidden md:block relative bg-linear-to-br from-amber-500 to-orange-600 p-12">
            <div className="absolute inset-0 opacity-20">
              { }
              <img
                src="https://images.unsplash.com/photo-1542909359-544eb870c007?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0cmF2ZWwlMjBtYXAlMjBiYWNrcGFjayUyMGlsbHVzdHJhdGlvbnxlbnwxfHx8fDE3NzEwMDgzOTB8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                alt="Travel"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="relative z-10 h-full flex flex-col justify-between">
              <div className="flex items-center gap-2 text-white">
                <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-xl">B</span>
                </div>
                <span className="text-2xl font-bold">BoilerBridge</span>
              </div>
              
              <div className="text-white">
                <h2 className="text-3xl font-bold mb-4">
                  Plan trips together,<br />not alone
                </h2>
                <p className="text-white/90 text-lg">
                  Join thousands of students coordinating unforgettable adventures.
                </p>
              </div>
            </div>
          </div>

          <div className="p-8 md:p-12">
            <div className="max-w-md mx-auto">
              <div className="md:hidden flex items-center gap-2 mb-8">
                <div className="w-8 h-8 bg-linear-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">B</span>
                </div>
                <span className="text-xl font-bold text-gray-900">BoilerBridge</span>
              </div>

              <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome back</h1>
              <p className="text-gray-600 mb-8">Sign in to continue planning your adventures</p>

              <form className="space-y-4" onSubmit={handleSignIn}>
                <div>
                  <Label htmlFor="email" className="text-black">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@university.edu"
                    className="mt-1.5 bg-white text-black placeholder:text-gray-400"
                    autoComplete="off"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-black">Password</Label>
                    <a href="/signin/forgot-password" className="text-sm text-amber-600 hover:text-amber-700">
                      Forgot?
                    </a >
                  </div>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    className="mt-1.5 bg-white text-black placeholder:text-gray-400"
                    required
                  />
                </div>

                <Button 
                  type="submit"
                  className="w-full bg-linear-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white"
                  size="lg"
                >
                  Sign In
                </Button>
              </form>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-gray-500">or</span>
                </div>
              </div>

              <div className="space-y-3">
                {/*<Button variant="outline" className="w-full" size="lg">
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </Button>*/}

                <Button variant="outline" className="w-full" size="lg">
                  <Mail className="w-5 h-5 mr-2" />
                  Continue with Purdue email
                </Button>
              </div>

              <p className="text-center text-sm text-gray-600 mt-6">
                Don&apos;t have an account?{" "}
                <Link href="/signup" className="text-amber-600 hover:text-amber-700 font-medium">
                  Create account
                </Link>
              </p>

              <p className="text-center text-xs text-gray-500 mt-6">
                Plan trips together, not alone 🌍
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
    </main>
    <Footer />
    </div>
  );
}