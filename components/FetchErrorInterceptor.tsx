"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export function FetchErrorInterceptor() {
  useEffect(() => {
    const original = window.fetch;

    window.fetch = async (...args) => {
      const response = await original(...args);

      if (!response.ok && response.status !== 500) {
        const url =
          typeof args[0] === "string"
            ? args[0]
            : args[0] instanceof URL
              ? args[0].href
              : (args[0] as Request).url;

        if (url.includes("/api/")) {
          try {
            const clone = response.clone();
            const data = await clone.json();
            if (data?.error) {
              toast.error(data.error);
            }
          } catch {
            // non-JSON body — skip
          }
        }
      }

      return response;
    };

    return () => {
      window.fetch = original;
    };
  }, []);

  return null;
}
