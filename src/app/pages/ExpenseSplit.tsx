import { useState } from "react";
import {
  ChevronLeft,
  Plus,
  DollarSign,
  TrendingUp,
  Users,
  Receipt,
  Check,
  X
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { Link } from "react-router";

const expenses = [
  {
    id: 1,
    description: "Airbnb - 3 nights",
    amount: 900,
    paidBy: { id: 1, name: "John Doe", initials: "JD", color: "from-blue-400 to-blue-600" },
    splitBetween: ["JD", "SK", "MR", "AL", "TC"],
    category: "Accommodation",
    date: "Mar 10, 2026"
  },
  {
    id: 2,
    description: "Dinner at Ocean Drive",
    amount: 180,
    paidBy: { id: 2, name: "Sarah Kim", initials: "SK", color: "from-purple-400 to-purple-600" },
    splitBetween: ["JD", "SK", "MR", "AL", "TC"],
    category: "Food",
    date: "Mar 15, 2026"
  },
  {
    id: 3,
    description: "Uber to South Beach",
    amount: 45,
    paidBy: { id: 3, name: "Mike Ross", initials: "MR", color: "from-green-400 to-green-600" },
    splitBetween: ["JD", "SK", "MR"],
    category: "Transport",
    date: "Mar 15, 2026"
  },
  {
    id: 4,
    description: "Beach equipment rental",
    amount: 120,
    paidBy: { id: 4, name: "Anna Lee", initials: "AL", color: "from-pink-400 to-pink-600" },
    splitBetween: ["JD", "SK", "MR", "AL", "TC"],
    category: "Activities",
    date: "Mar 16, 2026"
  },
  {
    id: 5,
    description: "Groceries",
    amount: 85,
    paidBy: { id: 5, name: "Tom Chen", initials: "TC", color: "from-amber-400 to-amber-600" },
    splitBetween: ["JD", "SK", "MR", "AL", "TC"],
    category: "Food",
    date: "Mar 15, 2026"
  }
];

const balances = [
  { name: "Alex Chen", initials: "AC", amount: 42, type: "owe", color: "from-red-400 to-red-600" },
  { name: "Chris Park", initials: "CP", amount: 18, type: "owes", color: "from-green-400 to-green-600" },
  { name: "Jordan Lee", initials: "JL", amount: 25, type: "owe", color: "from-red-400 to-red-600" },
];

const categoryData = [
  { name: "Accommodation", amount: 900, percentage: 38, color: "bg-blue-500" },
  { name: "Food", amount: 765, percentage: 32, color: "bg-green-500" },
  { name: "Transport", amount: 445, percentage: 19, color: "bg-amber-500" },
  { name: "Activities", amount: 290, percentage: 11, color: "bg-purple-500" }
];

export function ExpenseSplit() {
  const [filter, setFilter] = useState("all");

  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-40">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <Link to="/trip/1">
              <Button variant="ghost" size="icon">
                <ChevronLeft size={20} />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Expense Split</h1>
              <p className="text-sm text-gray-600">Spring Break Miami</p>
            </div>
          </div>

          <Button className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white">
            <Plus className="mr-2" size={18} />
            Add Expense
          </Button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6 lg:p-8">
        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          {/* Total Spent Card */}
          <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-6 text-white">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign size={20} />
              <span className="text-sm opacity-90">Total Spent</span>
            </div>
            <p className="text-4xl font-bold mb-1">${totalExpenses.toLocaleString()}</p>
            <p className="text-sm opacity-90">Out of $3,500 budget</p>
            <div className="mt-4 bg-white/20 rounded-full h-2">
              <div 
                className="bg-white h-2 rounded-full"
                style={{ width: `${(totalExpenses / 3500) * 100}%` }}
              ></div>
            </div>
          </div>

          {/* Your Share Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-2">
              <Users size={20} className="text-gray-600" />
              <span className="text-sm text-gray-600">Your Share</span>
            </div>
            <p className="text-4xl font-bold text-gray-900 mb-1">$480</p>
            <p className="text-sm text-gray-600">Split with 5 people</p>
          </div>

          {/* Status Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={20} className="text-gray-600" />
              <span className="text-sm text-gray-600">Your Balance</span>
            </div>
            <p className="text-4xl font-bold text-green-600 mb-1">+$15</p>
            <p className="text-sm text-gray-600">You're owed this amount</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content - Expense List */}
          <div className="lg:col-span-2 space-y-6">
            {/* Balances Summary */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Settlement Summary</h2>
              <div className="space-y-3">
                {balances.map((balance, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between p-4 rounded-xl ${
                      balance.type === "owe" ? "bg-red-50" : "bg-green-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className={`bg-gradient-to-br ${balance.color} text-white text-sm`}>
                          {balance.initials}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-gray-900">
                          {balance.type === "owe" ? `You owe ${balance.name}` : `${balance.name} owes you`}
                        </p>
                        <p className="text-sm text-gray-600">
                          ${balance.amount}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={balance.type === "owe" ? "default" : "outline"}
                      className={balance.type === "owe" ? "bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white" : ""}
                    >
                      {balance.type === "owe" ? "Settle Up" : "Remind"}
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Expense List */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900">All Expenses</h2>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={filter === "all" ? "default" : "outline"}
                      onClick={() => setFilter("all")}
                      className={filter === "all" ? "bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white" : ""}
                    >
                      All
                    </Button>
                    <Button
                      size="sm"
                      variant={filter === "paid" ? "default" : "outline"}
                      onClick={() => setFilter("paid")}
                      className={filter === "paid" ? "bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white" : ""}
                    >
                      I Paid
                    </Button>
                    <Button
                      size="sm"
                      variant={filter === "owe" ? "default" : "outline"}
                      onClick={() => setFilter("owe")}
                      className={filter === "owe" ? "bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white" : ""}
                    >
                      I Owe
                    </Button>
                  </div>
                </div>
              </div>

              <div className="divide-y divide-gray-200">
                {expenses.map((expense) => (
                  <div key={expense.id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                          <Receipt className="text-amber-600" size={20} />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{expense.description}</p>
                          <p className="text-sm text-gray-600 mt-1">
                            Paid by {expense.paidBy.name}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                              {expense.category}
                            </span>
                            <span className="text-xs text-gray-500">
                              {expense.date}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-gray-900">${expense.amount}</p>
                        <p className="text-sm text-gray-600 mt-1">
                          ${(expense.amount / expense.splitBetween.length).toFixed(2)} each
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-3">
                      <span className="text-xs text-gray-600">Split between:</span>
                      <div className="flex items-center gap-1">
                        {expense.splitBetween.map((member, idx) => (
                          <div
                            key={idx}
                            className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-xs text-gray-700 -ml-1 first:ml-0"
                          >
                            {member}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Sidebar - Category Breakdown */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Spending by Category</h3>
              
              <div className="space-y-4">
                {categoryData.map((category, idx) => (
                  <div key={idx}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900">{category.name}</span>
                      <span className="text-sm font-bold text-gray-900">${category.amount}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className={`${category.color} h-2 rounded-full`}
                          style={{ width: `${category.percentage}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-600 w-10 text-right">
                        {category.percentage}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-6 border border-blue-200">
              <h3 className="text-lg font-bold text-gray-900 mb-2">💡 Pro Tip</h3>
              <p className="text-sm text-gray-700">
                Add receipts to expenses by clicking on them. This helps everyone stay transparent about costs!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
