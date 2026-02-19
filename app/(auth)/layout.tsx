import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
    return (
        <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute -left-24 top-10 h-64 w-64 rounded-full bg-emerald-500/25 blur-[120px]" />
                <div className="absolute -right-24 bottom-10 h-72 w-72 rounded-full bg-cyan-400/25 blur-[140px]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.9),_rgba(2,6,23,0.95))]" />
            </div>
            <div className="relative flex min-h-screen items-center justify-center px-6 py-16">
                {children}
            </div>
        </div>
    );
}
