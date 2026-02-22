"use client"

import { signIn } from "next-auth/react"

export default function LoginPage() {
    const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();

        const formData = new FormData(e.currentTarget);

        const res = await signIn("credentials", {
            email: formData.get("email"),
            password: formData.get("password"),
            redirect: false
        });

        if (res?.ok) {
            window.location.href = "/";
        } else {
            alert("Invalid Credentials");
        }
    }

    return (
        <div>
            <div>
                <h1>Login</h1>

                <form onSubmit={handleSubmit}>
                    <input
                        type="email"
                        placeholder="Email"
                        name="email"
                    />

                    ,<input 
                        type="password"
                        placeholder="Password"
                        name="password"
                     />

                     <button type="submit">
                        Login
                     </button>
                </form>
            </div>
        </div>
    )
}