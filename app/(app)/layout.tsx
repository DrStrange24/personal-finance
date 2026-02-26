import type { ReactNode } from "react";
import { revalidatePath } from "next/cache";
import { Container } from "react-bootstrap";
import AppSidebar from "./app-sidebar";
import {
    createFinanceEntityForUser,
    deleteFinanceEntityForUser,
    getFinanceEntityContextForUser,
    setActiveFinanceEntityForUser,
    updateFinanceEntityForUser,
} from "@/lib/finance/entity-context";
import { getAuthenticatedEntitySession } from "@/lib/server-session";
import styles from "./layout.module.scss";

export default async function AppLayout({ children }: { children: ReactNode }) {
    const session = await getAuthenticatedEntitySession();

    const revalidateFinancePaths = () => {
        revalidatePath("/dashboard");
        revalidatePath("/transactions");
        revalidatePath("/income");
        revalidatePath("/budget");
        revalidatePath("/loan");
        revalidatePath("/wallet");
        revalidatePath("/monthly-overview");
    };

    const setActiveEntityAction = async (entityId: string) => {
        "use server";

        const actionSession = await getAuthenticatedEntitySession();
        await setActiveFinanceEntityForUser(actionSession.userId, entityId);
        revalidateFinancePaths();
    };

    const createEntityAction = async (name: string, type: "PERSONAL" | "BUSINESS") => {
        "use server";

        const actionSession = await getAuthenticatedEntitySession();
        const created = await createFinanceEntityForUser(actionSession.userId, { name, type });
        await setActiveFinanceEntityForUser(actionSession.userId, created.id);
        revalidateFinancePaths();
    };

    const updateEntityAction = async (entityId: string, name: string, type: "PERSONAL" | "BUSINESS") => {
        "use server";

        const actionSession = await getAuthenticatedEntitySession();
        await updateFinanceEntityForUser(actionSession.userId, entityId, { name, type });
        revalidateFinancePaths();
    };

    const deleteEntityAction = async (entityId: string) => {
        "use server";

        const actionSession = await getAuthenticatedEntitySession();
        await deleteFinanceEntityForUser(actionSession.userId, entityId);

        const contextAfterDelete = await getFinanceEntityContextForUser(actionSession.userId);
        await setActiveFinanceEntityForUser(actionSession.userId, contextAfterDelete.activeEntity.id);
        revalidateFinancePaths();
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
                            createEntityAction={createEntityAction}
                            updateEntityAction={updateEntityAction}
                            deleteEntityAction={deleteEntityAction}
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
