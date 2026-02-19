"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const links = [
    { href: "/wallet", label: "Wallet" },
    { href: "/monthly-overview", label: "Monthly Overview" },
];

export default function AppSidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const handleLogout = async () => {
        if (isLoggingOut) return;

        setIsLoggingOut(true);

        try {
            await fetch("/api/auth/logout", { method: "POST" });
        } catch {
            // Redirect regardless so users do not get stuck in the protected shell.
        } finally {
            router.replace("/login");
        }
    };

    return (
        <aside className="flex h-full flex-col rounded-3xl border border-white/10 bg-slate-900/70 p-4 backdrop-blur sm:p-6">
            <div className="mb-4 sm:mb-8">
                <p className="text-xs uppercase tracking-[0.3em] text-emerald-300/80">
                    Personal Finance
                </p>
                <h1 className="mt-2 text-xl font-semibold text-white">Dashboard</h1>
            </div>

            <nav className="flex flex-row gap-2 overflow-x-auto pb-1 sm:flex-col sm:gap-3">
                {links.map((link) => {
                    const isActive = pathname === link.href;

                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${
                                isActive
                                    ? "bg-emerald-400 text-slate-950"
                                    : "border border-white/10 text-slate-200 hover:border-emerald-200/50 hover:text-emerald-100"
                            }`}
                        >
                            {link.label}
                        </Link>
                    );
                })}
            </nav>

            <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="mt-4 rounded-2xl border border-rose-300/40 px-4 py-3 text-left text-sm font-semibold text-rose-200 transition hover:border-rose-200 hover:text-rose-100 disabled:cursor-not-allowed disabled:opacity-60 sm:mt-auto"
            >
                {isLoggingOut ? "Logging out..." : "Logout"}
            </button>
        </aside>
    );
}
