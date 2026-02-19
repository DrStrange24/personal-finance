"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignupPage() {
    const router = useRouter();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError("");
        setIsSubmitting(true);

        try {
            const response = await fetch("/api/auth/signup", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ name, email, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data?.error ?? "Signup failed.");
                return;
            }

            router.push("/wallet");
        } catch {
            setError("Unable to connect. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="w-full max-w-md space-y-8 rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl shadow-black/30 backdrop-blur">
            <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/80">
                    Personal Finance
                </p>
                <h1 className="text-3xl font-semibold text-white">Create account</h1>
                <p className="text-sm text-slate-300">
                    Set up your profile to start organizing your finances.
                </p>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
                <label className="block text-sm text-slate-200">
                    Name
                    <input
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/60"
                        type="text"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        autoComplete="name"
                    />
                </label>
                <label className="block text-sm text-slate-200">
                    Email
                    <input
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/60"
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        required
                        autoComplete="email"
                    />
                </label>
                <label className="block text-sm text-slate-200">
                    Password
                    <input
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/60"
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                        minLength={8}
                        autoComplete="new-password"
                    />
                </label>

                {error ? (
                    <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                        {error}
                    </div>
                ) : null}

                <button
                    className="w-full rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
                    type="submit"
                    disabled={isSubmitting}
                >
                    {isSubmitting ? "Creating account..." : "Create account"}
                </button>
            </form>

            <p className="text-center text-sm text-slate-300">
                Already have an account?{" "}
                <Link className="font-semibold text-cyan-200" href="/login">
                    Sign in
                </Link>
            </p>
        </div>
    );
}
