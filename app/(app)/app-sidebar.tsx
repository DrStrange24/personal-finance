"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./app-sidebar.module.scss";

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
        <aside className={styles.sidebar}>
            <div className={styles.header}>
                <p className={styles.kicker}>
                    Personal Finance
                </p>
                <h1 className={styles.title}>Dashboard</h1>
            </div>

            <nav className={styles.nav}>
                {links.map((link) => {
                    const isActive = pathname === link.href;

                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={`${styles.navLink} ${isActive ? styles.navLinkActive : ""}`}
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
                className={styles.logoutButton}
            >
                {isLoggingOut ? "Logging out..." : "Logout"}
            </button>
        </aside>
    );
}
