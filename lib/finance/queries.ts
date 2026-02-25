import { Prisma, TransactionKind, WalletAccountType } from "@prisma/client";
import { getCoinsPhEstimatedValuePhp } from "@/lib/finance/coins-ph";
import { prisma } from "@/lib/prisma";
import type { DashboardSummary } from "@/lib/finance/types";

const startOfMonth = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
};

export const getDashboardSummary = async (userId: string): Promise<DashboardSummary> => {
    const [walletAccounts, investments, budgetAggregate, incomeAggregate, expenseAggregate] = await Promise.all([
        prisma.walletAccount.findMany({
            where: {
                userId,
                isArchived: false,
            },
            select: {
                type: true,
                currentBalanceAmount: true,
            },
        }),
        prisma.investment.findMany({
            where: {
                userId,
                isArchived: false,
            },
            select: {
                name: true,
                value: true,
            },
        }),
        prisma.budgetEnvelope.aggregate({
            where: {
                userId,
                isArchived: false,
                isSystem: false,
            },
            _sum: {
                availablePhp: true,
            },
        }),
        prisma.financeTransaction.aggregate({
            where: {
                userId,
                postedAt: {
                    gte: startOfMonth(),
                },
                kind: TransactionKind.INCOME,
            },
            _sum: {
                amountPhp: true,
            },
        }),
        prisma.financeTransaction.aggregate({
            where: {
                userId,
                postedAt: {
                    gte: startOfMonth(),
                },
                kind: {
                    in: [TransactionKind.EXPENSE, TransactionKind.CREDIT_CARD_CHARGE],
                },
            },
            _sum: {
                amountPhp: true,
            },
        }),
    ]);

    const estimatedInvestmentValues = await Promise.all(
        investments.map(async (investment) => {
            const symbol = investment.name.toUpperCase().match(/\b[A-Z]{2,10}\b/)?.[0] ?? "UNITS";
            return getCoinsPhEstimatedValuePhp(symbol, Number(investment.value));
        }),
    );

    let totalCreditCardDebtPhp = 0;
    let totalWalletBalancePhp = 0;
    let totalAllWalletsPhp = 0;

    for (const wallet of walletAccounts) {
        const amount = Number(wallet.currentBalanceAmount);
        totalAllWalletsPhp += amount;
        if (wallet.type === WalletAccountType.CREDIT_CARD) {
            totalCreditCardDebtPhp += amount;
        } else if (wallet.type !== WalletAccountType.ASSET) {
            totalWalletBalancePhp += amount;
        }
    }

    const totalEstimatedInvestmentsPhp = estimatedInvestmentValues
        .reduce((sum: number, value) => sum + (value ?? 0), 0);
    const totalAssetsPhp = totalAllWalletsPhp + totalEstimatedInvestmentsPhp;
    const budgetAvailablePhp = Number(budgetAggregate._sum.availablePhp ?? 0);
    const monthIncomePhp = Number(incomeAggregate._sum.amountPhp ?? 0);
    const monthExpensePhp = Number(expenseAggregate._sum.amountPhp ?? 0);

    return {
        totalWalletBalancePhp,
        totalCreditCardDebtPhp,
        totalAssetsPhp,
        netPositionPhp: totalWalletBalancePhp - totalCreditCardDebtPhp,
        budgetAvailablePhp,
        unallocatedCashPhp: totalWalletBalancePhp - budgetAvailablePhp,
        monthIncomePhp,
        monthExpensePhp,
        monthNetCashflowPhp: monthIncomePhp - monthExpensePhp,
    };
};

export const getBudgetStats = async (userId: string) => {
    const start = startOfMonth();
    const envelopes = await prisma.budgetEnvelope.findMany({
        where: {
            userId,
            isArchived: false,
            isSystem: false,
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    const spentByEnvelope = await prisma.financeTransaction.groupBy({
        by: ["budgetEnvelopeId"],
        where: {
            userId,
            postedAt: { gte: start },
            kind: {
                in: [TransactionKind.EXPENSE, TransactionKind.CREDIT_CARD_CHARGE],
            },
            budgetEnvelopeId: {
                not: null,
            },
        },
        _sum: {
            amountPhp: true,
        },
    });

    const spentMap = new Map<string, number>();
    for (const item of spentByEnvelope) {
        if (item.budgetEnvelopeId) {
            spentMap.set(item.budgetEnvelopeId, Number(item._sum.amountPhp ?? 0));
        }
    }

    return envelopes.map((envelope) => {
        const spentPhp = spentMap.get(envelope.id) ?? 0;
        const monthlyTargetPhp = Number(envelope.monthlyTargetPhp);
        const availablePhp = Number(envelope.availablePhp);
        const remainingPhp = monthlyTargetPhp - spentPhp;
        return {
            ...envelope,
            spentPhp,
            monthlyTargetPhp,
            availablePhp,
            remainingPhp,
            variancePhp: remainingPhp,
        };
    });
};

export const getCreditCardStatus = async (userId: string) => {
    const creditCards = await prisma.walletAccount.findMany({
        where: {
            userId,
            isArchived: false,
            type: WalletAccountType.CREDIT_CARD,
        },
        orderBy: { name: "asc" },
    });

    return creditCards.map((card) => ({
        ...card,
        currentBalanceAmount: Number(card.currentBalanceAmount),
    }));
};

export const formatTransactionDirection = (
    kind: TransactionKind,
    amount: Prisma.Decimal | number | string,
) => {
    const numeric = Number(amount);
    if (
        kind === TransactionKind.EXPENSE
        || kind === TransactionKind.BUDGET_ALLOCATION
        || kind === TransactionKind.CREDIT_CARD_PAYMENT
        || kind === TransactionKind.LOAN_REPAY
    ) {
        return -Math.abs(numeric);
    }
    return Math.abs(numeric);
};

