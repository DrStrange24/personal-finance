import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Container } from "react-bootstrap";
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

            <Container fluid className={styles.container}>
                <div className={styles.shellRow}>
                    <div className={styles.sidebarWrapper}>
                        <AppSidebar />
                    </div>
                    <div className={styles.mainColumn}>
                        <main className={`${styles.main} pf-surface-panel`}>
                            {children}
                        </main>
                    </div>
                </div>
            </Container>
        </div>
    );
}
