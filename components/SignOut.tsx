"use client";

import React, { useState } from "react";
import { signOut } from "next-auth/react";
import { LogOut, ArrowLeft } from "lucide-react";
import { Button } from "./ui/button";
import Link from "next/link";

export function SignOut() {
  const [isLoading, setIsLoading] = useState(false);

  const handleSignOut = async () => {
    setIsLoading(true);
    await signOut({ callbackUrl: "/", redirect: true });
  };

  return (
    <div className="min-h-[calc(100vh-73px)] flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-gray-100 p-10 text-center">
        {/* Icon Header */}
        <div className="w-20 h-20 bg-linear-to-br from-amber-100 to-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <LogOut className="text-orange-600" size={32} />
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">Sign Out</h1>
        <p className="text-gray-600 mb-8">
          Are you sure you want to sign out of your BoilerBridge account?
        </p>

        <div className="space-y-3">
          <Button
            onClick={handleSignOut}
            disabled={isLoading}
            className="w-full py-6 text-lg bg-linear-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold rounded-2xl shadow-md transition-all disabled:opacity-70"
          >
            {isLoading ? "Signing out..." : "Yes, Sign Out"}
          </Button>

          <Link href="/dashboard" className="block">
            <Button
              variant="ghost"
              className="w-full py-6 text-gray-500 hover:text-gray-700 font-medium rounded-2xl"
            >
              <ArrowLeft className="mr-2" size={18} />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
