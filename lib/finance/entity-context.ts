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
    creditAccounts: number;
    investments: number;
    budgetEnvelopes: number;
    loanRecords: number;
    incomeStreams: number;
    transactions: number;
    total: number;
};

type EntityInput = {
    name: string;
    type: EntityType;
};

const normalizeEntityName = (name: string) => {
    const normalized = name.trim();
    if (normalized.length < 1 || normalized.length > 80) {
        throw new Error("Entity name must be between 1 and 80 characters.");
    }
    return normalized;
};

const createDefaultEntityForUser = async (db: PrismaClientLike, userId: string): Promise<FinanceEntitySummary> => {
    return db.financeEntity.create({
        data: {
            userId,
            name: DEFAULT_FINANCE_ENTITY_NAME,
            type: EntityType.PERSONAL,
            isArchived: false,
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
        where: {
            userId,
            isArchived: false,
        },
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
    includeArchived = false,
): Promise<FinanceEntitySummary> => {
    const entity = await db.financeEntity.findFirst({
        where: {
            id: entityId,
            userId,
            ...(includeArchived ? {} : { isArchived: false }),
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

export const createFinanceEntityForUser = async (
    userId: string,
    input: EntityInput,
): Promise<FinanceEntitySummary> => {
    const name = normalizeEntityName(input.name);
    const existing = await prisma.financeEntity.findFirst({
        where: {
            userId,
            isArchived: false,
            name,
            type: input.type,
        },
        select: { id: true },
    });

    if (existing) {
        throw new Error("An entity with this name and type already exists.");
    }

    return prisma.financeEntity.create({
        data: {
            userId,
            name,
            type: input.type,
            isArchived: false,
        },
        select: {
            id: true,
            name: true,
            type: true,
        },
    });
};

export const updateFinanceEntityForUser = async (
    userId: string,
    entityId: string,
    input: EntityInput,
): Promise<FinanceEntitySummary> => {
    await requireOwnedFinanceEntity(prisma, userId, entityId);
    const name = normalizeEntityName(input.name);
    const existing = await prisma.financeEntity.findFirst({
        where: {
            userId,
            isArchived: false,
            id: { not: entityId },
            name,
            type: input.type,
        },
        select: { id: true },
    });

    if (existing) {
        throw new Error("Another entity with this name and type already exists.");
    }

    return prisma.financeEntity.update({
        where: { id: entityId },
        data: {
            name,
            type: input.type,
        },
        select: {
            id: true,
            name: true,
            type: true,
        },
    });
};

export const getFinanceEntityRecordCounts = async (
    db: PrismaClientLike,
    userId: string,
    entityId: string,
): Promise<FinanceEntityRecordCounts> => {
    const [walletAccounts, creditAccounts, investments, budgetEnvelopes, loanRecords, incomeStreams, transactions] = await Promise.all([
        db.walletAccount.count({
            where: { userId, entityId },
        }),
        db.creditAccount.count({
            where: { userId, entityId },
        }),
        db.investment.count({
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
        creditAccounts,
        investments,
        budgetEnvelopes,
        loanRecords,
        incomeStreams,
        transactions,
        total: walletAccounts + creditAccounts + investments + budgetEnvelopes + loanRecords + incomeStreams + transactions,
    };
};

export const archiveFinanceEntityForUser = async (userId: string, entityId: string) => {
    return prisma.$transaction(async (tx) => {
        await requireOwnedFinanceEntity(tx, userId, entityId);

        const activeEntityCount = await tx.financeEntity.count({
            where: {
                userId,
                isArchived: false,
            },
        });
        if (activeEntityCount <= 1) {
            throw new Error("Cannot archive the last active entity.");
        }

        await tx.financeEntity.update({
            where: {
                id: entityId,
            },
            data: {
                isArchived: true,
            },
        });
    });
};
