import { EntityType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import AddEntityModal from "./add-entity-modal";
import EntityTable from "./entity-table";
import {
    archiveFinanceEntityForUser,
    createFinanceEntityForUser,
    getFinanceEntityContextForUser,
    getFinanceEntityRecordCounts,
    setActiveFinanceEntityForUser,
    updateFinanceEntityForUser,
} from "@/lib/finance/entity-context";
import { getAuthenticatedEntitySession } from "@/lib/server-session";
import { prisma } from "@/lib/prisma";

const parseEntityType = (value: FormDataEntryValue | null): EntityType | null => {
    if (value === EntityType.PERSONAL || value === EntityType.BUSINESS) {
        return value;
    }
    return null;
};

const parseEntityName = (value: FormDataEntryValue | null) => {
    if (typeof value !== "string") {
        return null;
    }
    const normalized = value.trim();
    if (normalized.length < 1 || normalized.length > 80) {
        return null;
    }
    return normalized;
};

export default async function EntityPage() {
    const session = await getAuthenticatedEntitySession();

    const createEntityAction = async (formData: FormData): Promise<{ ok: boolean; message: string }> => {
        "use server";

        const actionSession = await getAuthenticatedEntitySession();
        const name = parseEntityName(formData.get("name"));
        const type = parseEntityType(formData.get("type"));
        const setActive = formData.get("setActive") === "on";

        try {
            if (!name || !type) {
                return { ok: false, message: "Please provide a valid entity name and type." };
            }

            const created = await createFinanceEntityForUser(actionSession.userId, { name, type });
            if (setActive) {
                await setActiveFinanceEntityForUser(actionSession.userId, created.id);
            }
            revalidatePath("/entity");
            revalidatePath("/dashboard");
            revalidatePath("/transactions");
            revalidatePath("/income");
            revalidatePath("/budget");
            revalidatePath("/loan");
            revalidatePath("/wallet");
            revalidatePath("/monthly-overview");
            return { ok: true, message: "Entity created successfully." };
        } catch (error) {
            return { ok: false, message: error instanceof Error ? error.message : "Could not create entity." };
        }
    };

    const updateEntityAction = async (formData: FormData): Promise<{ ok: boolean; message: string }> => {
        "use server";

        const actionSession = await getAuthenticatedEntitySession();
        const id = typeof formData.get("id") === "string" ? String(formData.get("id")).trim() : "";
        const name = parseEntityName(formData.get("name"));
        const type = parseEntityType(formData.get("type"));

        try {
            if (!id || !name || !type) {
                return { ok: false, message: "Please provide valid entity update details." };
            }

            await updateFinanceEntityForUser(actionSession.userId, id, { name, type });
            revalidatePath("/entity");
            revalidatePath("/dashboard");
            revalidatePath("/transactions");
            revalidatePath("/income");
            revalidatePath("/budget");
            revalidatePath("/loan");
            revalidatePath("/wallet");
            revalidatePath("/monthly-overview");
            return { ok: true, message: "Entity updated successfully." };
        } catch (error) {
            return { ok: false, message: error instanceof Error ? error.message : "Could not update entity." };
        }
    };

    const setActiveEntityAction = async (formData: FormData): Promise<{ ok: boolean; message: string }> => {
        "use server";

        const actionSession = await getAuthenticatedEntitySession();
        const id = typeof formData.get("id") === "string" ? String(formData.get("id")).trim() : "";
        try {
            if (!id) {
                return { ok: false, message: "Entity id is required." };
            }

            await setActiveFinanceEntityForUser(actionSession.userId, id);
            revalidatePath("/entity");
            revalidatePath("/dashboard");
            revalidatePath("/transactions");
            revalidatePath("/income");
            revalidatePath("/budget");
            revalidatePath("/loan");
            revalidatePath("/wallet");
            revalidatePath("/monthly-overview");
            return { ok: true, message: "Active entity updated." };
        } catch (error) {
            return { ok: false, message: error instanceof Error ? error.message : "Could not set active entity." };
        }
    };

    const archiveEntityAction = async (formData: FormData): Promise<{ ok: boolean; message: string }> => {
        "use server";

        const actionSession = await getAuthenticatedEntitySession();
        const id = typeof formData.get("id") === "string" ? String(formData.get("id")).trim() : "";
        try {
            if (!id) {
                return { ok: false, message: "Entity id is required." };
            }

            await archiveFinanceEntityForUser(actionSession.userId, id);
            const nextContext = await getFinanceEntityContextForUser(actionSession.userId);
            await setActiveFinanceEntityForUser(actionSession.userId, nextContext.activeEntity.id);
            revalidatePath("/entity");
            revalidatePath("/dashboard");
            revalidatePath("/transactions");
            revalidatePath("/income");
            revalidatePath("/budget");
            revalidatePath("/loan");
            revalidatePath("/wallet");
            revalidatePath("/monthly-overview");
            return { ok: true, message: "Entity archived successfully." };
        } catch (error) {
            return { ok: false, message: error instanceof Error ? error.message : "Could not archive entity." };
        }
    };

    const entities = await prisma.financeEntity.findMany({
        where: {
            userId: session.userId,
            isArchived: false,
        },
        orderBy: [{ createdAt: "asc" }, { name: "asc" }],
        select: {
            id: true,
            name: true,
            type: true,
            createdAt: true,
        },
    });

    const entityCounts = await Promise.all(
        entities.map(async (entity) => {
            const counts = await getFinanceEntityRecordCounts(prisma, session.userId, entity.id);
            return [entity.id, counts] as const;
        }),
    );
    const countMap = new Map(entityCounts);

    return (
        <section className="d-grid gap-4">
            <header className="d-grid gap-2">
                <p className="m-0 text-uppercase small" style={{ letterSpacing: "0.3em", color: "var(--color-kicker-primary)" }}>
                    Settings
                </p>
                <h2 className="m-0 fs-2 fw-semibold" style={{ color: "var(--color-text-strong)" }}>
                    Entity Management
                </h2>
                <p className="m-0 small" style={{ color: "var(--color-text-muted)" }}>
                    Create, update, archive, and switch your finance entities.
                </p>
            </header>

            <AddEntityModal createEntityAction={createEntityAction} />

            <EntityTable
                entities={entities.map((entity) => ({
                    id: entity.id,
                    name: entity.name,
                    type: entity.type,
                    totalRecords: countMap.get(entity.id)?.total ?? 0,
                    createdAtLabel: entity.createdAt.toISOString().slice(0, 10),
                    isActive: entity.id === session.activeEntity.id,
                }))}
                updateEntityAction={updateEntityAction}
                archiveEntityAction={archiveEntityAction}
                setActiveEntityAction={setActiveEntityAction}
            />
        </section>
    );
}
