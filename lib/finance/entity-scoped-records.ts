import { type CreditAccount, type Investment, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type PrismaClientLike = Prisma.TransactionClient | typeof prisma;

export const listActiveCreditAccountsByEntity = async (
    db: PrismaClientLike,
    userId: string,
    entityId: string,
) => {
    return db.creditAccount.findMany({
        where: {
            userId,
            entityId,
            isArchived: false,
        },
        orderBy: { name: "asc" },
    });
};

export const requireOwnedCreditAccount = async (
    db: PrismaClientLike,
    userId: string,
    entityId: string,
    creditAccountId: string,
    includeArchived = false,
): Promise<CreditAccount> => {
    const account = await db.creditAccount.findFirst({
        where: {
            id: creditAccountId,
            userId,
            entityId,
            ...(includeArchived ? {} : { isArchived: false }),
        },
    });

    if (!account) {
        throw new Error("Credit account not found.");
    }

    return account;
};

export const ensureUniqueActiveCreditAccountName = async (
    db: PrismaClientLike,
    userId: string,
    entityId: string,
    name: string,
    excludeId?: string,
) => {
    const existing = await db.creditAccount.findFirst({
        where: {
            userId,
            entityId,
            isArchived: false,
            name,
            ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: { id: true },
    });

    if (existing) {
        throw new Error("An active credit account with this name already exists in this entity.");
    }
};

export const listActiveInvestmentsByEntity = async (
    db: PrismaClientLike,
    userId: string,
    entityId: string,
) => {
    return db.investment.findMany({
        where: {
            userId,
            entityId,
            isArchived: false,
        },
        orderBy: [{ createdAt: "desc" }],
    });
};

export const requireOwnedInvestment = async (
    db: PrismaClientLike,
    userId: string,
    entityId: string,
    investmentId: string,
    includeArchived = false,
): Promise<Investment> => {
    const investment = await db.investment.findFirst({
        where: {
            id: investmentId,
            userId,
            entityId,
            ...(includeArchived ? {} : { isArchived: false }),
        },
    });

    if (!investment) {
        throw new Error("Investment not found.");
    }

    return investment;
};

export const ensureUniqueActiveInvestmentName = async (
    db: PrismaClientLike,
    userId: string,
    entityId: string,
    name: string,
    excludeId?: string,
) => {
    const existing = await db.investment.findFirst({
        where: {
            userId,
            entityId,
            isArchived: false,
            name,
            ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: { id: true },
    });

    if (existing) {
        throw new Error("An active investment with this name already exists in this entity.");
    }
};
