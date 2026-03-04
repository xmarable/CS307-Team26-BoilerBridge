"use client";

import { Star } from "lucide-react";

const testimonials = [
  {
    name: "Sarah Chen",
    school: "UC Berkeley",
    avatar: "SC",
    rating: 5,
    text: "BoilerBridge saved our spring break trip! We had 12 people trying to coordinate and it would've been impossible without this. The cost splitting feature alone is worth it."
  },
  {
    name: "Marcus Johnson",
    school: "Georgia Tech",
    avatar: "MJ",
    rating: 5,
    text: "Finally, a travel app that actually gets what college students need. No credit card required to start, super easy to use, and our whole group stayed organized."
  },
  {
    name: "Emily Rodriguez",
    school: "UT Austin",
    avatar: "ER",
    rating: 5,
    text: "We planned a road trip for 8 friends in like 2 days using BoilerBridge. The itinerary builder is chef's kiss 👌 and everyone knew exactly what was happening."
  },
  {
    name: "Jake Williams",
    school: "University of Michigan",
    avatar: "JW",
    rating: 5,
    text: "Best decision we made for our group trip. Splitting Airbnb and gas costs used to be SO awkward, but BoilerBridge handles it perfectly. Game changer!"
  },
  {
    name: "Priya Patel",
    school: "Stanford University",
    avatar: "PP",
    rating: 5,
    text: "Love that everything is in one place - chat, budget, itinerary. No more switching between 5 different apps. Made our camping trip so much smoother."
  },
  {
    name: "Alex Thompson",
    school: "Penn State",
    avatar: "AT",
    rating: 5,
    text: "Honestly didn't think we'd need this, but now I can't imagine planning group trips without it. The availability finder saved us hours of back-and-forth texts."
  }
];

export function Testimonials() {
  return (
    <section id="testimonials" className="py-20 px-6 lg:px-8 bg-white">
      <div className="mx-auto max-w-7xl">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Loved by Students Everywhere
          </h2>
          <p className="text-xl text-gray-600">
            Join thousands of college students who&apos;ve made group travel planning effortless.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <div 
              key={index}
              className="p-6 rounded-xl border border-gray-200 bg-white hover:shadow-lg transition-shadow"
            >
              <div className="flex gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="fill-yellow-400 text-yellow-400" size={16} />
                ))}
              </div>

              <p className="text-gray-700 mb-6">
                &quot;{testimonial.text}&quot;
              </p>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-linear-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-bold">
                    {testimonial.avatar}
                  </span>
                </div>
                <div>
                  <p className="font-bold text-gray-900">{testimonial.name}</p>
                  <p className="text-sm text-gray-600">{testimonial.school}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}