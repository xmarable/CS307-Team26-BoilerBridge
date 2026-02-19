import { 
  Users, 
  DollarSign, 
  Calendar, 
  MapPin, 
  MessageSquare, 
  PieChart 
} from "lucide-react";

const features = [
  {
    icon: Users,
    title: "Group Coordination",
    description: "Invite friends, vote on destinations, and keep everyone in sync with real-time updates."
  },
  {
    icon: DollarSign,
    title: "Smart Cost Splitting",
    description: "Automatically calculate and track who owes what. Say goodbye to awkward money conversations."
  },
  {
    icon: Calendar,
    title: "Availability Finder",
    description: "Find dates that work for everyone with our intelligent scheduling assistant."
  },
  {
    icon: MapPin,
    title: "Itinerary Builder",
    description: "Create and share day-by-day plans. Add activities, restaurants, and must-see spots."
  },
  {
    icon: MessageSquare,
    title: "Group Chat",
    description: "Built-in messaging keeps all trip discussions in one place. No more endless group texts."
  },
  {
    icon: PieChart,
    title: "Budget Tracker",
    description: "Set a group budget and track expenses in real-time. Stay on top of costs together."
  }
];

export function Features() {
  return (
    <section id="features" className="py-20 px-6 lg:px-8 bg-white">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Everything You Need to Plan the Perfect Trip
          </h2>
          <p className="text-xl text-gray-600">
            Built by students, for students. We know what it takes to coordinate a group trip.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div 
                key={index}
                className="p-6 rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all duration-300"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center mb-4">
                  <Icon className="text-white" size={24} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
