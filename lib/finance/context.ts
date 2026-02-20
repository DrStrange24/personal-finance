import { prisma } from "@/lib/prisma";

export const getFinanceContextData = async (userId: string) => {
    const [wallets, budgets, incomes, loans] = await Promise.all([
        prisma.walletAccount.findMany({
            where: {
                userId,
                isArchived: false,
            },
            orderBy: [{ type: "asc" }, { name: "asc" }],
        }),
        prisma.budgetEnvelope.findMany({
            where: {
                userId,
                isArchived: false,
            },
            orderBy: [{ isSystem: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
        }),
        prisma.incomeStream.findMany({
            where: {
                userId,
                isActive: true,
            },
            orderBy: { name: "asc" },
        }),
        prisma.loanRecord.findMany({
            where: {
                userId,
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
