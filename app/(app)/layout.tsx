import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AppSidebar from "./app-sidebar";
import { verifySessionToken } from "@/lib/auth";

export default async function AppLayout({ children }: { children: ReactNode }) {
    const cookieStore = await cookies();
    const token = cookieStore.get("pf_session")?.value;

    if (!token || !verifySessionToken(token)) {
        redirect("/login");
    }

    return (
        <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute -left-20 top-8 h-64 w-64 rounded-full bg-emerald-500/20 blur-[120px]" />
                <div className="absolute -right-24 bottom-10 h-72 w-72 rounded-full bg-cyan-400/20 blur-[140px]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.9),_rgba(2,6,23,0.96))]" />
            </div>

            <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-4 p-4 sm:gap-6 sm:p-6 lg:flex-row">
                <div className="w-full lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:w-72">
                    <AppSidebar />
                </div>

                <main className="min-w-0 flex-1 rounded-3xl border border-white/10 bg-slate-900/40 p-6 backdrop-blur sm:p-8">
                    {children}
                </main>
            </div>
        </div>
    );
}
