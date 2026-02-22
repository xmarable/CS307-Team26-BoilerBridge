"use client";

// We no longer need the 'view' state or the big 'switch' statement!
// This file now simply serves as the entry point for your Landing page.
import { Landing } from "@/components/Landing";

export default function HomePage() {
  return (
    <main>
      <Landing />
    </main>
  );
}