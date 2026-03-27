import { Expenses } from "@/components/ExpenseSplit";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";

export default function ExpensesPage() {
  return (
    <div>
      <div>
        <Navbar />
      </div>
      <div className="flex min-h-screen bg-gray-50 overflow-x-hidden flex-1">
        <Sidebar />
        <Expenses />
      </div>
    </div>
  )
}
