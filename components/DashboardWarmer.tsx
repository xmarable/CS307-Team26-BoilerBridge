"use client";

import { useEffect } from "react";

export function DashboardWarmer() {
  useEffect(() => {
    const routes = [
      "/dashboard/activities",
      "/dashboard/friends",
      "/dashboard/groups",
      "/dashboard/profile",
      "/dashboard/expenses",
      "/dashboard/alltrips",
      "/dashboard/discover",
      "/dashboard/messages",
    ];

    // dummy fetch to force the dev compiler to wake up
    routes.forEach((route) => {
      fetch(route, { priority: "low" }).catch(() => {});
      console.log(`Forcing compilation for: ${route}`);
    });
  }, []);

  return null;
}
