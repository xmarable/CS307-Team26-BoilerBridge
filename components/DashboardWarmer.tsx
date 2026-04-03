"use client";

import { useEffect } from "react";

export function DashboardWarmer() {
  useEffect(() => {
    const routes = [
      "/dashboard/activities",
      "/dashboard/alltrips",
      "/dashboard/discover",
      "/dashboard/expenses",
      "/dashboard/friends",
      "/dashboard/groups",
      "/dashboard/messages",
      "/dashboard/profile",
      "/dashboard/trip",
    ];

    // dummy fetch to force the dev compiler to wake up
    routes.forEach((route) => {
      fetch(route, { priority: "low" }).catch(() => {});
      console.log(`Forcing compilation for: ${route}`);
    });
  }, []);

  return null;
}
