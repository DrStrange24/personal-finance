import type { ReactNode } from "react";
import { revalidatePath } from "next/cache";
import { Container } from "react-bootstrap";
import AppSidebar from "./app-sidebar";
import {
    setActiveFinanceEntityForUser,
} from "@/lib/finance/entity-context";
import { getAuthenticatedEntitySession } from "@/lib/server-session";
import styles from "./layout.module.scss";

export default async function AppLayout({ children }: { children: ReactNode }) {
    const session = await getAuthenticatedEntitySession();

    const setActiveEntityAction = async (entityId: string) => {
        "use server";

        const actionSession = await getAuthenticatedEntitySession();
        await setActiveFinanceEntityForUser(actionSession.userId, entityId);
        revalidatePath("/dashboard");
        revalidatePath("/transactions");
        revalidatePath("/income");
        revalidatePath("/credit");
        revalidatePath("/investment");
        revalidatePath("/budget");
        revalidatePath("/loan");
        revalidatePath("/wallet");
        revalidatePath("/entity");
        revalidatePath("/monthly-overview");
    };

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
                        <AppSidebar
                            entities={session.entities}
                            activeEntityId={session.activeEntity.id}
                            setActiveEntityAction={setActiveEntityAction}
                        />
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
