import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AppSidebar from "./app-sidebar";
import { verifySessionToken } from "@/lib/auth";
import styles from "./layout.module.scss";

export default async function AppLayout({ children }: { children: ReactNode }) {
    const cookieStore = await cookies();
    const token = cookieStore.get("pf_session")?.value;

    if (!token || !verifySessionToken(token)) {
        redirect("/login");
    }

    return (
        <div className={styles.layout}>
            <div className={styles.background} aria-hidden="true">
                <div className={styles.glowLeft} />
                <div className={styles.glowRight} />
                <div className={styles.overlay} />
            </div>

            <div className={styles.container}>
                <div className={styles.sidebarWrapper}>
                    <AppSidebar />
                </div>

                <main className={styles.main}>
                    {children}
                </main>
            </div>
        </div>
    );
}
