"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import Button from "react-bootstrap/Button";
import Card from "react-bootstrap/Card";
import CardBody from "react-bootstrap/CardBody";
import Nav from "react-bootstrap/Nav";
import NavLink from "react-bootstrap/NavLink";

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
        <Card as="aside" className="pf-surface-panel h-100 border-0">
            <CardBody className="d-flex flex-column p-3 p-sm-4">
                <div className="mb-3 mb-sm-4">
                    <p className="m-0 text-uppercase small" style={{ letterSpacing: "0.3em", color: "var(--color-kicker-primary)" }}>
                    Personal Finance
                    </p>
                    <h1 className="mt-2 mb-0 fs-4 fw-semibold" style={{ color: "var(--color-text-strong)" }}>Dashboard</h1>
                </div>

                <Nav className="flex-row flex-sm-column gap-2 overflow-x-auto pb-1">
                {links.map((link) => {
                    const isActive = pathname === link.href;

                    return (
                        <NavLink
                            key={link.href}
                            as={Link}
                            href={link.href}
                            className="rounded-4 px-3 py-2 text-nowrap border"
                            style={isActive ? {
                                background: "var(--color-primary)",
                                borderColor: "transparent",
                                color: "var(--color-primary-text)",
                            } : {
                                borderColor: "var(--color-border-default)",
                                color: "var(--color-text-subtle)",
                            }}
                        >
                            {link.label}
                        </NavLink>
                    );
                })}
                </Nav>

                <Button
                    type="button"
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    variant="outline-danger"
                    className="mt-3 mt-sm-auto text-start rounded-4 py-2 fw-semibold"
                    style={{ borderColor: "var(--color-logout-border)", color: "var(--color-logout-text)" }}
                >
                    {isLoggingOut ? "Logging out..." : "Logout"}
                </Button>
            </CardBody>
        </Card>
    );
}
