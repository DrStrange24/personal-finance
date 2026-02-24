"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type SVGProps, useState } from "react";
import Button from "react-bootstrap/Button";
import Card from "react-bootstrap/Card";
import CardBody from "react-bootstrap/CardBody";
import Nav from "react-bootstrap/Nav";
import NavLink from "react-bootstrap/NavLink";

type IconProps = SVGProps<SVGSVGElement>;

const WalletIcon = (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
        <rect x="2.5" y="5.5" width="19" height="13" rx="2.5" />
        <path d="M16.5 10.5h5v3h-5a1.5 1.5 0 0 1 0-3Z" />
        <circle cx="16.75" cy="12" r="0.75" fill="currentColor" stroke="none" />
    </svg>
);

const DashboardIcon = (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
        <rect x="3" y="3" width="8" height="8" rx="1.5" />
        <rect x="13" y="3" width="8" height="5" rx="1.5" />
        <rect x="13" y="10" width="8" height="11" rx="1.5" />
        <rect x="3" y="13" width="8" height="8" rx="1.5" />
    </svg>
);

const TransactionsIcon = (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
        <path d="M3 7h18" />
        <path d="M3 12h18" />
        <path d="M3 17h18" />
        <circle cx="8" cy="7" r="1" fill="currentColor" stroke="none" />
        <circle cx="16" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="10" cy="17" r="1" fill="currentColor" stroke="none" />
    </svg>
);

const IncomeIcon = (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
        <path d="M12 20V4" />
        <path d="M7 9l5-5 5 5" />
        <path d="M4 20h16" />
    </svg>
);

const InvestmentIcon = (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
        <path d="M4 19.5h16" />
        <path d="m6.5 15 4-4 3 3 4.5-6" />
        <path d="M18 8h2v2" />
    </svg>
);

const BudgetIcon = (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
        <rect x="3" y="4" width="18" height="16" rx="2.5" />
        <path d="M7 9h10" />
        <path d="M7 13h7" />
        <path d="M7 17h5" />
    </svg>
);

const LoanIcon = (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
        <path d="M4 8h12a4 4 0 1 1 0 8H4" />
        <path d="m8 4-4 4 4 4" />
        <path d="m16 20 4-4-4-4" />
    </svg>
);

const CreditIcon = (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
        <rect x="3" y="6" width="18" height="12" rx="2.5" />
        <path d="M3 10h18" />
        <path d="M7 14h4" />
    </svg>
);

const CalendarIcon = (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
        <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
        <path d="M8 3v3" />
        <path d="M16 3v3" />
        <path d="M3 9.5h18" />
        <path d="M8 13h3" />
        <path d="M13 13h3" />
        <path d="M8 17h3" />
    </svg>
);

const LogoutIcon = (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
        <path d="M10 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H10" />
        <path d="M14 16.5 18.5 12 14 7.5" />
        <path d="M9.5 12h9" />
    </svg>
);

const ChevronLeftIcon = (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
        <path d="M15 18 9 12l6-6" />
    </svg>
);

const links = [
    { href: "/dashboard", label: "Dashboard", Icon: DashboardIcon },
    { href: "/transactions", label: "Transactions", Icon: TransactionsIcon },
    { href: "/income", label: "Income", Icon: IncomeIcon },
    { href: "/investment", label: "Investment", Icon: InvestmentIcon },
    { href: "/budget", label: "Budget", Icon: BudgetIcon },
    { href: "/loan", label: "Loan", Icon: LoanIcon },
    { href: "/credit", label: "Credit", Icon: CreditIcon },
    { href: "/wallet", label: "Wallet", Icon: WalletIcon },
    { href: "/monthly-overview", label: "Monthly Overview", Icon: CalendarIcon },
];

export default function AppSidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [isCollapsed, setIsCollapsed] = useState(false);
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
        <Card as="aside" data-collapsed={isCollapsed} className="pf-surface-panel h-100 border-0">
            <CardBody className="d-flex flex-column p-3 p-sm-4">
                <div className="mb-3 mb-sm-4">
                    <div className="d-flex align-items-center justify-content-between gap-2">
                        {!isCollapsed && (
                            <p className="m-0 text-uppercase small" style={{ letterSpacing: "0.3em", color: "var(--color-kicker-primary)" }}>
                                Personal Finance
                            </p>
                        )}
                        <Button
                            type="button"
                            variant="light"
                            className="border rounded-circle d-flex align-items-center justify-content-center p-0"
                            onClick={() => setIsCollapsed((value) => !value)}
                            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                            style={{ width: "2rem", height: "2rem", color: "var(--color-text-subtle)", borderColor: "var(--color-border-default)", background: "transparent" }}
                        >
                            <ChevronLeftIcon
                                width={16}
                                height={16}
                                style={isCollapsed ? { transform: "rotate(180deg)" } : undefined}
                            />
                        </Button>
                    </div>
                    {!isCollapsed && <h1 className="mt-2 mb-0 fs-4 fw-semibold" style={{ color: "var(--color-text-strong)" }}>Dashboard</h1>}
                </div>

                <Nav className="flex-column gap-2 pb-1">
                {links.map((link) => {
                    const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);

                    return (
                        <NavLink
                            key={link.href}
                            as={Link}
                            href={link.href}
                            className={`rounded-4 px-3 py-2 border d-flex align-items-center ${isCollapsed ? "justify-content-center" : "gap-2"}`}
                            style={isActive ? {
                                background: "var(--color-primary)",
                                borderColor: "transparent",
                                color: "var(--color-primary-text)",
                            } : {
                                borderColor: "var(--color-border-default)",
                                color: "var(--color-text-subtle)",
                            }}
                            aria-label={isCollapsed ? link.label : undefined}
                            title={isCollapsed ? link.label : undefined}
                        >
                            <link.Icon width={16} height={16} />
                            {!isCollapsed && <span>{link.label}</span>}
                        </NavLink>
                    );
                })}
                </Nav>

                <Button
                    type="button"
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    variant="outline-danger"
                    className={`mt-3 mt-sm-auto rounded-4 py-2 fw-semibold d-flex align-items-center ${isCollapsed ? "justify-content-center" : "gap-2"}`}
                    style={{ borderColor: "var(--color-logout-border)", color: "var(--color-logout-text)" }}
                    aria-label={isCollapsed ? "Logout" : undefined}
                    title={isCollapsed ? "Logout" : undefined}
                >
                    <LogoutIcon width={16} height={16} />
                    {!isCollapsed && (isLoggingOut ? "Logging out..." : "Logout")}
                </Button>
            </CardBody>
        </Card>
    );
}
