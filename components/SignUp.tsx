/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { signIn } from "next-auth/react";

const signUpSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(30),
  email: z.string().email("Please enter a valid university email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(64),
});

type SignUpValues = z.infer<typeof signUpSchema>;

export function SignUp() {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
  });

  const onSubmit = async (data: SignUpValues) => {
    setIsLoading(true);
    setServerError("");

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        setServerError(result.error || "Failed to create account");
        setIsLoading(false);
        return;
      }
      const loginResult = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (loginResult?.ok) {
        router.refresh();
        router.push("/dashboard?registered=true");
      } else {
        router.push("/login?error=auto_login_failed");
      }
    } catch (_err) {
      setServerError("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-amber-50 to-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="grid md:grid-cols-2">
          <div className="p-8 md:p-12">
            <div className="max-w-md mx-auto">
              <div className="md:hidden flex items-center gap-2 mb-8">
                <div className="w-8 h-8 bg-linear-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">B</span>
                </div>
                <span className="text-xl font-bold text-gray-900">
                  BoilerBridge
                </span>
              </div>

              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Create Account
              </h1>
              <p className="text-gray-600 mb-8">
                Join the community and start bridging your travels.
              </p>

              <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
                {serverError && (
                  <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
                    {serverError}
                  </div>
                )}

                <div>
                  <Label
                    htmlFor="username"
                    className="text-black font-semibold"
                  >
                    Username
                  </Label>
                  <Input
                    id="username"
                    {...register("username")}
                    placeholder="Xavy123"
                    className="mt-1.5 text-black placeholder:text-gray-400 border-gray-300"
                  />
                  {errors.username && (
                    <p className="text-xs text-red-500 mt-1">
                      {errors.username.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="email" className="text-black font-semibold">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    {...register("email")}
                    placeholder="xmarable@purdue.edu"
                    className="mt-1.5 text-black placeholder:text-gray-400 border-gray-300"
                  />
                  {errors.email && (
                    <p className="text-xs text-red-500 mt-1">
                      {errors.email.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label
                    htmlFor="password"
                    className="text-black font-semibold"
                  >
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    {...register("password")}
                    placeholder="••••••••"
                    className="mt-1.5 text-black placeholder:text-gray-400 border-gray-300"
                  />
                  {errors.password && (
                    <p className="text-xs text-red-500 mt-1">
                      {errors.password.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full bg-linear-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white"
                  size="lg"
                  disabled={isLoading}
                >
                  {isLoading ? "Creating Account..." : "Sign Up"}
                </Button>
              </form>

              <p className="text-center text-sm text-gray-600 mt-6">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="text-amber-600 hover:text-amber-700 font-medium"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </div>

          <div className="hidden md:block relative bg-linear-to-br from-amber-500 to-orange-600 p-12">
            <div className="absolute inset-0 opacity-20">
              <Image
                src="https://images.unsplash.com/photo-1488646953014-85cb44e25828?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"
                alt="Travel Planning"
                fill
                className="object-cover"
              />
            </div>
            <div className="relative z-10 h-full flex flex-col justify-between items-end text-right">
              <div className="flex items-center gap-2 text-white">
                <span className="text-2xl font-bold">BoilerBridge</span>
                <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-xl">B</span>
                </div>
              </div>

              <div className="text-white">
                <h2 className="text-3xl font-bold mb-4">
                  Your journey begins
                  <br />
                  with a single bridge
                </h2>
                <p className="text-white/90 text-lg">
                  Coordinate with friends and turn &quot;we should go
                  there&quot; into &quot;we&apos;re going there.&quot;
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
