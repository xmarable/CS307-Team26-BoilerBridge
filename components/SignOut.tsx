'use client'

import React from "react"
import { signOut } from "next-auth/react"

export default function SignOut() {
    const handleSignOut = () => signOut();
    return (
        <button onClick={handleSignOut}>
            Sign Out
        </button>
    )
}