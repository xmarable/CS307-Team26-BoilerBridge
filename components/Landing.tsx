"use client";

import { Hero } from "./Hero";
import { Features } from "./Features";
import { HowItWorks } from "./HowItWorks";
import { Testimonials } from "./Testimonials";
import { CTA } from "./CTA";
import { Footer } from "./Footer";

interface LandingProps {
  readonly user?: any;
}

export function Landing(user: LandingProps) {
  return (
    <div className="min-h-screen bg-white">
      <main>
        <Hero user={user} />
        <Features />
        <HowItWorks />
        <Testimonials />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}