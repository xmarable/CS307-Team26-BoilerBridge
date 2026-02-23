"use client";

import { Hero } from "./Hero";
import { Features } from "./Features";
import { HowItWorks } from "./HowItWorks";
import { Testimonials } from "./Testimonials";
import { CTA } from "./CTA";
import { Footer } from "./Footer";

export function Landing() {
  return (
    <div className="min-h-screen bg-white">
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <Testimonials />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}