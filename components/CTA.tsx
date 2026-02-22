"use client";

import { ArrowRight } from "lucide-react";
import { Button } from "./ui/button";
import Link from "next/link";

export function CTA() {
  return (
    <section className="py-20 px-6 lg:px-8 bg-linear-to-br from-amber-500 via-orange-600 to-amber-600">
      <div className="mx-auto max-w-4xl text-center">
        <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
          Ready to Plan Your Next Adventure?
        </h2>
        <p className="text-xl text-amber-100 mb-8">
          Join thousands of students making group travel planning easy and fun.
          Get started free today—no credit card required.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/signin">
            <Button
              size="lg"
              className="bg-white text-amber-600 hover:bg-gray-100 text-lg"
            >
              Start Planning Free
              <ArrowRight className="ml-2" size={20} />
            </Button>
          </Link>
          <Button
            size="lg"
            variant="outline"
            className="border-white text-white hover:bg-white/10 text-lg"
          >
            Schedule a Demo
          </Button>
        </div>
        <p className="text-amber-100 mt-6 text-sm">
          Free forever for groups up to 10 people • No credit card required
        </p>
      </div>
    </section>
  );
}