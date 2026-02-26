import { LoanStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const getFinanceContextData = async (userId: string, entityId: string) => {
    const [wallets, budgets, incomes, loans] = await Promise.all([
        prisma.walletAccount.findMany({
            where: {
                userId,
                entityId,
                isArchived: false,
            },
            orderBy: [{ type: "asc" }, { name: "asc" }],
        }),
        prisma.budgetEnvelope.findMany({
            where: {
                userId,
                entityId,
                isArchived: false,
            },
            orderBy: [{ isSystem: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
        }),
        prisma.incomeStream.findMany({
            where: {
                userId,
                entityId,
                isActive: true,
            },
            orderBy: { name: "asc" },
        }),
        prisma.loanRecord.findMany({
            where: {
                userId,
                entityId,
                status: LoanStatus.ACTIVE,
            },
            orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        }),
    ]);

    return {
        wallets,
        budgets,
        incomes,
        loans,
    };
};

export const getFinanceContextDataAcrossEntities = async (userId: string) => {
    const [wallets, budgets, incomes, loans] = await Promise.all([
        prisma.walletAccount.findMany({
            where: {
                userId,
                isArchived: false,
                entity: {
                    isArchived: false,
                },
            },
            include: {
                entity: {
                    select: {
                        id: true,
                        name: true,
                        type: true,
                    },
                },
            },
            orderBy: [{ type: "asc" }, { name: "asc" }],
        }),
        prisma.budgetEnvelope.findMany({
            where: {
                userId,
                isArchived: false,
                entity: {
                    isArchived: false,
                },
            },
            include: {
                entity: {
                    select: {
                        id: true,
                        name: true,
                        type: true,
                    },
                },
            },
            orderBy: [{ isSystem: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
        }),
        prisma.incomeStream.findMany({
            where: {
                userId,
                isActive: true,
                entity: {
                    isArchived: false,
                },
            },
            include: {
                entity: {
                    select: {
                        id: true,
                        name: true,
                        type: true,
                    },
                },
            },
            orderBy: { name: "asc" },
        }),
        prisma.loanRecord.findMany({
            where: {
                userId,
                status: LoanStatus.ACTIVE,
                entity: {
                    isArchived: false,
                },
            },
            include: {
                entity: {
                    select: {
                        id: true,
                        name: true,
                        type: true,
                    },
                },
            },
            orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        }),
    ]);

    return {
        wallets,
        budgets,
        incomes,
        loans,
    };
};
