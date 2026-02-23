"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import Image from "next/image";
import { LogOut, ArrowLeft } from "lucide-react";

export function SignOut() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleSignOut = async () => {
    setIsLoading(true);
    // This clears the session and redirects to landing
    await signOut({ callbackUrl: "/" });
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-amber-50 to-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="grid md:grid-cols-2">
          
          {/* Left Side: Branding (Consistent with SignIn) */}
          <div className="hidden md:block relative bg-linear-to-br from-amber-500 to-orange-600 p-12">
            <div className="absolute inset-0 opacity-20">
              <Image
                src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"
                alt="Mountains"
                fill
                className="object-cover"
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
                <h2 className="text-3xl font-bold mb-4">Adventure is out there</h2>
                <p className="text-white/90 text-lg">
                  We&apos;ll be here when you&apos;re ready to plan your next journey.
                </p>
              </div>
            </div>
          </div>

          {/* Right Side: Sign Out Action */}
          <div className="p-8 md:p-12 flex flex-col justify-center">
            <div className="max-w-md mx-auto w-full text-center">
              <div className="md:hidden flex items-center justify-center gap-2 mb-8">
                <div className="w-8 h-8 bg-linear-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">B</span>
                </div>
                <span className="text-xl font-bold text-gray-900">BoilerBridge</span>
              </div>

              <div className="mb-8">
                <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <LogOut size={32} />
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Sign Out</h1>
                <p className="text-gray-600">Are you sure you want to log out of your account?</p>
              </div>

              <div className="space-y-3">
                <Button 
                  onClick={handleSignOut}
                  className="w-full bg-linear-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white"
                  size="lg"
                  disabled={isLoading}
                >
                  {isLoading ? "Signing out..." : "Confirm Sign Out"}
                </Button>

                <Button 
                  variant="outline" 
                  className="w-full" 
                  size="lg"
                  onClick={() => router.back()}
                  disabled={isLoading}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Go Back
                </Button>
              </div>

              <p className="text-xs text-gray-500 mt-12 italic">
                &quot;Not all those who wander are lost.&quot; — J.R.R. Tolkien
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}