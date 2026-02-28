"use client";

import React, { useState } from "react";
import { signOut } from "next-auth/react";

export function SignOut() {
  const [isLoading, setIsLoading] = useState(false);

  const handleSignOut = async () => {
    setIsLoading(true);
    await signOut({ callbackUrl: "/", redirect: true });
  };

  return (
    <div style={{ textAlign: "center", marginTop: "100px" }}>
      <h1 style={{ color: "white", marginBottom: "20px" }}>Confirm Sign Out</h1>
      <button
        onClick={handleSignOut}
        disabled={isLoading}
        style={{
          padding: "10px 20px",
          backgroundColor: isLoading ? "#555" : "#ff4e00",
          color: "white",
          border: "none",
          borderRadius: "5px",
          cursor: isLoading ? "not-allowed" : "pointer",
          opacity: isLoading ? 0.7 : 1,
        }}
      >
        {isLoading ? "Signing out..." : "Click to Sign Out"}
      </button>
    </div>
  );
}
