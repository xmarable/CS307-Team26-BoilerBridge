"use client";

import { Mail } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Footer } from "./Footer";
import { useState } from "react";

export function ResetPassword() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const token = params.get("token") ?? "";

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email,
        token: token,
        newPassword: newPassword
      })
    });

    const data = await res.json();
    setMessage(res.ok ? "Password reset successfully." : data.error ?? "Invalid Link")
    setNewPassword("");
  }

  return (
    <div>
    <main>
    <div className="min-h-screen bg-linear-to-br from-amber-50 to-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="grid md:grid-cols-2">
          <div className="hidden md:block relative bg-linear-to-br from-amber-500 to-orange-600 p-12">
            <div className="absolute inset-0 opacity-20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
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

              <h1 className="text-3xl font-bold text-gray-900 mb-2">Set New Password</h1>
              <p className="text-gray-600 mb-8">Enter your new password</p>

              <form className="space-y-4" onSubmit={handleSubmit}>

                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-black">New Password</Label>
                  </div>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    value={newPassword}
                    placeholder="••••••••"
                    className="mt-1.5 bg-white text-black placeholder:text-gray-400"
                    required
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>

                <Button 
                  type="submit"
                  className="w-full bg-linear-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white"
                  size="lg"
                >
                  Submit
                </Button>
                <div className="text-gray-400">
                  {message}
                </div>
              </form>

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