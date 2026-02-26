import { EntityType, type FinanceEntity, type Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import { ACTIVE_FINANCE_ENTITY_COOKIE } from "@/lib/finance/constants";
import { prisma } from "@/lib/prisma";

export const DEFAULT_FINANCE_ENTITY_NAME = "Personal";

type PrismaClientLike = Prisma.TransactionClient | typeof prisma;

type FinanceEntityOrder = Prisma.FinanceEntityOrderByWithRelationInput[];

const financeEntityOrder: FinanceEntityOrder = [{ createdAt: "asc" }, { name: "asc" }];

export type FinanceEntitySummary = Pick<FinanceEntity, "id" | "name" | "type">;

export type FinanceEntityContext = {
    activeEntity: FinanceEntitySummary;
    entities: FinanceEntitySummary[];
};

export type FinanceEntityRecordCounts = {
    walletAccounts: number;
    budgetEnvelopes: number;
    loanRecords: number;
    incomeStreams: number;
    transactions: number;
    total: number;
};

const createDefaultEntityForUser = async (db: PrismaClientLike, userId: string): Promise<FinanceEntitySummary> => {
    return db.financeEntity.create({
        data: {
            userId,
            name: DEFAULT_FINANCE_ENTITY_NAME,
            type: EntityType.PERSONAL,
        },
        select: {
            id: true,
            name: true,
            type: true,
        },
    });
};

const fetchEntitiesForUser = async (db: PrismaClientLike, userId: string): Promise<FinanceEntitySummary[]> => {
    return db.financeEntity.findMany({
        where: { userId },
        orderBy: financeEntityOrder,
        select: {
            id: true,
            name: true,
            type: true,
        },
    });
};

const ensureEntitiesForUser = async (db: PrismaClientLike, userId: string): Promise<FinanceEntitySummary[]> => {
    const entities = await fetchEntitiesForUser(db, userId);
    if (entities.length > 0) {
        return entities;
    }

    const created = await createDefaultEntityForUser(db, userId);
    return [created];
};

const pickActiveEntity = (
    entities: FinanceEntitySummary[],
    preferredEntityId?: string | null,
): FinanceEntitySummary => {
    if (preferredEntityId) {
        const preferred = entities.find((entity) => entity.id === preferredEntityId);
        if (preferred) {
            return preferred;
        }
    }

    return entities[0];
};

export const getFinanceEntityContextForUser = async (
    userId: string,
    preferredEntityId?: string | null,
): Promise<FinanceEntityContext> => {
    const entities = await ensureEntitiesForUser(prisma, userId);
    const activeEntity = pickActiveEntity(entities, preferredEntityId);
    return {
        entities,
        activeEntity,
    };
};

export const getFinanceEntityContextFromCookie = async (userId: string): Promise<FinanceEntityContext> => {
    const cookieStore = await cookies();
    const preferredEntityId = cookieStore.get(ACTIVE_FINANCE_ENTITY_COOKIE)?.value ?? null;
    return getFinanceEntityContextForUser(userId, preferredEntityId);
};

export const requireOwnedFinanceEntity = async (
    db: PrismaClientLike,
    userId: string,
    entityId: string,
): Promise<FinanceEntitySummary> => {
    const entity = await db.financeEntity.findFirst({
        where: {
            id: entityId,
            userId,
        },
        select: {
            id: true,
            name: true,
            type: true,
        },
    });

    if (!entity) {
        throw new Error("Finance entity not found.");
    }

    return entity;
};

export const setActiveFinanceEntityForUser = async (
    userId: string,
    requestedEntityId: string,
): Promise<FinanceEntitySummary> => {
    const entity = await requireOwnedFinanceEntity(prisma, userId, requestedEntityId);
    const cookieStore = await cookies();

    cookieStore.set({
        name: ACTIVE_FINANCE_ENTITY_COOKIE,
        value: entity.id,
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
    });

    return entity;
};

export const getFinanceEntityRecordCounts = async (
    db: PrismaClientLike,
    userId: string,
    entityId: string,
): Promise<FinanceEntityRecordCounts> => {
    const [walletAccounts, budgetEnvelopes, loanRecords, incomeStreams, transactions] = await Promise.all([
        db.walletAccount.count({
            where: { userId, entityId },
        }),
        db.budgetEnvelope.count({
            where: { userId, entityId },
        }),
        db.loanRecord.count({
            where: { userId, entityId },
        }),
        db.incomeStream.count({
            where: { userId, entityId },
        }),
        db.financeTransaction.count({
            where: { userId, entityId },
        }),
    ]);

    return {
        walletAccounts,
        budgetEnvelopes,
        loanRecords,
        incomeStreams,
        transactions,
        total: walletAccounts + budgetEnvelopes + loanRecords + incomeStreams + transactions,
    };
};

export const deleteFinanceEntityForUser = async (userId: string, entityId: string) => {
    return prisma.$transaction(async (tx) => {
        await requireOwnedFinanceEntity(tx, userId, entityId);
        const counts = await getFinanceEntityRecordCounts(tx, userId, entityId);

        if (counts.total > 0) {
            throw new Error("Cannot delete an entity that still has financial records.");
        }

        const remainingEntities = await tx.financeEntity.count({
            where: { userId },
        });
        if (remainingEntities <= 1) {
            throw new Error("At least one finance entity must remain.");
        }

        await tx.financeEntity.delete({
            where: {
                id: entityId,
            },
        });
    });
};
