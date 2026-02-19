"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "./page.module.scss";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

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

            router.push("/wallet");
        } catch {
            setError("Unable to connect. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className={styles.card}>
            <div className={styles.header}>
                <p className={styles.kicker}>
                    Personal Finance
                </p>
                <h1 className={styles.title}>Welcome back</h1>
                <p className={styles.description}>
                    Sign in to track your spending, budgets, and insights.
                </p>
            </div>

            {isMounted ? (
                <form className={styles.form} onSubmit={handleSubmit}>
                    <label className={styles.label}>
                        Email
                        <input
                            className={styles.input}
                            type="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            required
                            autoComplete="email"
                        />
                    </label>
                    <label className={styles.label}>
                        Password
                        <input
                            className={styles.input}
                            type="password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            required
                            minLength={8}
                            autoComplete="current-password"
                        />
                    </label>

                    {error ? (
                        <div className={styles.error}>
                            {error}
                        </div>
                    ) : null}

                    <button
                        className={styles.submitButton}
                        type="submit"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? "Signing in..." : "Sign in"}
                    </button>
                </form>
            ) : (
                <div className={styles.skeleton} aria-hidden="true">
                    <div className={styles.skeletonField} />
                    <div className={styles.skeletonField} />
                    <div className={styles.skeletonButton} />
                </div>
            )}

            <p className={styles.footerText}>
                New here?{" "}
                <Link className={styles.footerLink} href="/signup">
                    Create an account
                </Link>
            </p>
        </div>
    );
}
