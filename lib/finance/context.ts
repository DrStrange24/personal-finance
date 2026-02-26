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
