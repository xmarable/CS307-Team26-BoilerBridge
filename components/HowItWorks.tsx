/* eslint-disable @next/next/no-img-element */
import { Check } from "lucide-react";

const steps = [
  {
    number: "01",
    title: "Create Your Trip",
    description: "Set up a new trip in seconds. Add a name, dates, and invite your crew.",
    image: "https://images.unsplash.com/photo-1758270705172-07b53627dfcb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdHVkZW50cyUyMHVzaW5nJTIwbGFwdG9wJTIwY29sbGFib3JhdGlvbnxlbnwxfHx8fDE3NzEwMDI5Njh8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
  },
  {
    number: "02",
    title: "Plan Together",
    description: "Vote on destinations, share ideas, and build your itinerary as a group.",
    image: "https://images.unsplash.com/photo-1758272959140-e727ef77bbda?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmcmllbmRzJTIwcGxhbm5pbmclMjB0cmlwJTIwdG9nZXRoZXJ8ZW58MXx8fHwxNzcxMDAyOTY3fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
  },
  {
    number: "03",
    title: "Hit the Road",
    description: "Track expenses, access your itinerary, and make memories that last forever.",
    image: "https://images.unsplash.com/photo-1770563182248-165e7c6b4492?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx5b3VuZyUyMHBlb3BsZSUyMGFkdmVudHVyZSUyMHRyYXZlbHxlbnwxfHx8fDE3NzEwMDI5Njh8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
  }
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 px-6 lg:px-8 bg-linear-to-b from-white to-blue-50">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            From Idea to Adventure in 3 Simple Steps
          </h2>
          <p className="text-xl text-gray-600">
            No more spreadsheets, no more confusion. Just easy, fun trip planning.
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-16">
          {steps.map((step, index) => (
            <div 
              key={index}
              className={`flex flex-col ${
                index % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'
              } gap-12 items-center`}
            >
              {/* Content */}
              <div className="flex-1">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-linear-to-br from-blue-500 to-purple-600 rounded-2xl mb-6">
                  <span className="text-2xl font-bold text-white">{step.number}</span>
                </div>
                <h3 className="text-3xl font-bold text-gray-900 mb-4">
                  {step.title}
                </h3>
                <p className="text-lg text-gray-600 mb-6">
                  {step.description}
                </p>
                <ul className="space-y-3">
                  <li className="flex items-center gap-3 text-gray-700">
                    <Check className="text-green-500" size={20} />
                    <span>Quick and intuitive</span>
                  </li>
                  <li className="flex items-center gap-3 text-gray-700">
                    <Check className="text-green-500" size={20} />
                    <span>Works on any device</span>
                  </li>
                  <li className="flex items-center gap-3 text-gray-700">
                    <Check className="text-green-500" size={20} />
                    <span>Real-time collaboration</span>
                  </li>
                </ul>
              </div>

              {/* Image */}
              <div className="flex-1">
                <div className="aspect-4/3 rounded-2xl overflow-hidden shadow-2xl">
                  <img
                    src={step.image}
                    alt={step.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}