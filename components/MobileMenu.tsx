'use client'

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "./ui/button";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function MobileMenu({ isAuthed }: { isAuthed: boolean }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  return (
    <div className="md:hidden">
        <button
        className="md:hidden p-2 text-gray-700"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
        {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

    {
        mobileMenuOpen && (
        <div className="md:hidden mt-4 pb-4 flex flex-col gap-4">
            <a
            href="#features"
            className="text-gray-700 hover:text-gray-900 transition-colors"
            onClick={() => setMobileMenuOpen(false)}
            >
            Features
            </a>
            <a
            href="#how-it-works"
            className="text-gray-700 hover:text-gray-900 transition-colors"
            onClick={() => setMobileMenuOpen(false)}
            >
            How It Works
            </a>
            <a
            href="#testimonials"
            className="text-gray-700 hover:text-gray-900 transition-colors"
            onClick={() => setMobileMenuOpen(false)}
            >
            Testimonials
            </a>
            <Link href="/signin">
            <Button variant="ghost" className="text-gray-700 justify-start">
                Sign In
            </Button>
            </Link>
            <Link href="/signup">
            <Button className="bg-linear-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white">
                Get Started
            </Button>
            </Link>
        </div>
        )
    }
    </div>
    );
}