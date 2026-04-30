"use client";

import { ArrowRight, Play } from "lucide-react";
import { Button } from "./ui/button";
import Link from "next/link";
interface HeroProps {
  readonly user?: any;
}

export function Hero({ user }: HeroProps) {
  return (
    <section className="pt-32 pb-16 px-6 lg:px-8 bg-linear-to-b from-amber-50 to-white">
      <div className="mx-auto max-w-7xl">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="flex flex-col gap-6">
            <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-700 px-4 py-2 rounded-full w-fit">
              <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
              <span className="text-sm">Made for College Students</span>
            </div>

            <h1 className="text-5xl lg:text-6xl font-bold text-bb-text leading-tight">
              Plan Group Trips{" "}
              <span className="bg-linear-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">
                Without the Chaos
              </span>
            </h1>

            <p className="text-xl text-bb-text-muted">
              Coordinate with friends, split costs, and create unforgettable
              memories. BoilerBridge makes group travel planning actually fun.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mt-4">
              <Link href="/signin">
                <Button
                  size="lg"
                  className="bg-linear-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-lg text-white"
                >
                  Start Planning Free
                  <ArrowRight className="ml-2" size={20} />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="text-lg">
                <Play className="mr-2" size={20} />
                Watch Demo
              </Button>
            </div>

            <div className="flex items-center gap-8 mt-4">
              <div>
                <p className="text-3xl font-bold text-bb-text">10K+</p>
                <p className="text-sm text-bb-text-muted">Active Users</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-bb-text">5K+</p>
                <p className="text-sm text-bb-text-muted">Trips Planned</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-bb-text">4.9★</p>
                <p className="text-sm text-bb-text-muted">User Rating</p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="aspect-square rounded-2xl overflow-hidden shadow-2xl">
              {}
              <img
                src="https://images.unsplash.com/photo-1586195518174-b88cd52f6571?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb2xsZWdlJTIwc3R1ZGVudHMlMjBncm91cCUyMHRyYXZlbHxlbnwxfHx8fDE3NzEwMDI5Njd8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                alt="College students planning trip together"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute -bottom-6 -left-6 bg-bb-surface p-4 rounded-xl shadow-lg hidden lg:block">
              <p className="text-sm text-bb-text-muted">Spring Break Trip</p>
              <p className="text-lg font-bold text-bb-text">$450/person</p>
            </div>
            <div className="absolute -top-6 -right-6 bg-bb-surface p-4 rounded-xl shadow-lg hidden lg:block">
              <p className="text-sm text-bb-text-muted">8 friends going</p>
              <p className="text-lg font-bold text-blue-600">All in! 🎉</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
