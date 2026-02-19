"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError("");
        setIsSubmitting(true);

        try {
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data?.error ?? "Login failed.");
                return;
            }

            router.push("/");
        } catch {
            setError("Unable to connect. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="w-full max-w-md space-y-8 rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl shadow-black/30 backdrop-blur">
            <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.3em] text-emerald-300/80">
                    Personal Finance
                </p>
                <h1 className="text-3xl font-semibold text-white">Welcome back</h1>
                <p className="text-sm text-slate-300">
                    Sign in to track your spending, budgets, and insights.
                </p>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
                <label className="block text-sm text-slate-200">
                    Email
                    <input
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-400/60"
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
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-400/60"
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                        minLength={8}
                        autoComplete="current-password"
                    />
                </label>

                {error ? (
                    <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                        {error}
                    </div>
                ) : null}

                <button
                    className="w-full rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                    type="submit"
                    disabled={isSubmitting}
                >
                    {isSubmitting ? "Signing in..." : "Sign in"}
                </button>
            </form>

            <p className="text-center text-sm text-slate-300">
                New here?{" "}
                <Link className="font-semibold text-emerald-300" href="/signup">
                    Create an account
                </Link>
            </p>
        </div>
    );
}
