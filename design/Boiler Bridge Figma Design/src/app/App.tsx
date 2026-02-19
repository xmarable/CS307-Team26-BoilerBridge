import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { Landing } from "./pages/Landing";
import { SignIn } from "./pages/SignIn";
import { Dashboard } from "./pages/Dashboard";
import { TripWorkspace } from "./pages/TripWorkspace";
import { ExpenseSplit } from "./pages/ExpenseSplit";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/trip/:id" element={<TripWorkspace />} />
        <Route path="/trip/:id/expenses" element={<ExpenseSplit />} />
      </Routes>
    </BrowserRouter>
  );
}