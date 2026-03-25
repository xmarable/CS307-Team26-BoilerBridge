"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function DashboardWarmer() {
  const router = useRouter();

  useEffect(() => {
    // forced pre-compilation list
    const routes = [
      "/dashboard/activities",
      "/dashboard/alltrips",
      "/dashboard/friends",
      "/dashboard/groups",
      "/dashboard/messages",
      "/dashboard/profile",
      "/dashboard/trip",
    ];

    // telling the next.js router to grab these chunks now
    routes.forEach((route) => router.prefetch(route));
  }, [router]);

  return null; // this component doesnt render anything visually
}
