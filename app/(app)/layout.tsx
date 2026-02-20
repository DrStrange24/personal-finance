import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Col, Container, Row } from "react-bootstrap";
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
                <Row className={`g-3 g-sm-4 ${styles.shellRow}`}>
                    <Col lg={4} xl={3} className={styles.sidebarWrapper}>
                        <AppSidebar />
                    </Col>
                    <Col lg={8} xl={9} className={styles.mainColumn}>
                        <main className={`${styles.main} pf-surface-panel`}>
                            {children}
                        </main>
                    </Col>
                </Row>
            </Container>
        </div>
    );
}
