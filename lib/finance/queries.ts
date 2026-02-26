import { LoanDirection, LoanStatus, Prisma, TransactionKind, WalletAccountType } from "@prisma/client";
import { getCoinsPhEstimatedValuePhp } from "@/lib/finance/coins-ph";
import { prisma } from "@/lib/prisma";
import type { DashboardSummary } from "@/lib/finance/types";

const startOfMonth = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
};

export const getDashboardSummary = async (userId: string, entityId: string): Promise<DashboardSummary> => {
    const [walletAccounts, investments, budgetAggregate, incomeAggregate, expenseAggregate, incomeStreamAggregate] = await Promise.all([
        prisma.walletAccount.findMany({
            where: {
                userId,
                entityId,
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
                entityId,
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
                entityId,
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
                entityId,
                isReversal: false,
                voidedAt: null,
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
                entityId,
                isReversal: false,
                voidedAt: null,
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
        prisma.incomeStream.aggregate({
            where: {
                userId,
                entityId,
                isActive: true,
            },
            _sum: {
                defaultAmountPhp: true,
            },
        }),
    ]);

    const estimatedInvestmentValues = await Promise.all(
        investments.map(async (investment) => {
            const symbol = investment.name.toUpperCase().match(/\b[A-Z]{2,10}\b/)?.[0] ?? "UNITS";
            return getCoinsPhEstimatedValuePhp(symbol, Number(investment.value));
        }),
    );

    let totalWalletBalancePhp = 0;
    let totalAllWalletsPhp = 0;
    let totalCreditCardDebtPhp = 0;

    for (const wallet of walletAccounts) {
        const amount = Number(wallet.currentBalanceAmount);
        totalAllWalletsPhp += amount;
        if (wallet.type === WalletAccountType.CREDIT_CARD) {
            totalCreditCardDebtPhp += amount;
        }
        if (wallet.type !== WalletAccountType.CREDIT_CARD && wallet.type !== WalletAccountType.ASSET) {
            totalWalletBalancePhp += amount;
        }
    }

    const totalEstimatedInvestmentsPhp = estimatedInvestmentValues
        .reduce((sum: number, value) => sum + (value ?? 0), 0);
    const totalAssetsPhp = totalAllWalletsPhp + totalEstimatedInvestmentsPhp;
    const budgetAvailablePhp = Number(budgetAggregate._sum.availablePhp ?? 0);
    const monthIncomePhp = Number(incomeAggregate._sum.amountPhp ?? 0);
    const monthExpensePhp = Number(expenseAggregate._sum.amountPhp ?? 0);
    const monthlyTotalIncomePhp = Number(incomeStreamAggregate._sum.defaultAmountPhp ?? 0);

    return {
        totalWalletBalancePhp,
        totalCreditCardDebtPhp,
        totalAssetsPhp,
        totalInvestmentPhp: totalEstimatedInvestmentsPhp,
        netPositionPhp: totalWalletBalancePhp - totalCreditCardDebtPhp,
        budgetAvailablePhp,
        unallocatedCashPhp: totalWalletBalancePhp - (budgetAvailablePhp + totalCreditCardDebtPhp),
        monthlyTotalIncomePhp,
        monthIncomePhp,
        monthExpensePhp,
        monthNetCashflowPhp: monthIncomePhp - monthExpensePhp,
    };
};

export const getBudgetStats = async (userId: string, entityId: string) => {
    const start = startOfMonth();
    const envelopes = await prisma.budgetEnvelope.findMany({
        where: {
            userId,
            entityId,
            isArchived: false,
            isSystem: false,
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    const spentByEnvelope = await prisma.financeTransaction.groupBy({
        by: ["budgetEnvelopeId"],
        where: {
            userId,
            entityId,
            isReversal: false,
            voidedAt: null,
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

export const getCreditCardStatus = async (userId: string, entityId: string) => {
    const creditCards = await prisma.walletAccount.findMany({
        where: {
            userId,
            entityId,
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

export const getOutstandingLoanTotals = async (userId: string, entityId: string) => {
    const outstandingLoanWhere = {
        userId,
        direction: LoanDirection.YOU_OWE,
        status: LoanStatus.ACTIVE,
        remainingPhp: {
            gt: 0,
        },
    } satisfies Prisma.LoanRecordWhereInput;

    const [allEntitiesAggregate, activeEntityAggregate] = await Promise.all([
        prisma.loanRecord.aggregate({
            where: {
                ...outstandingLoanWhere,
                entity: {
                    isArchived: false,
                },
            },
            _sum: {
                remainingPhp: true,
            },
        }),
        prisma.loanRecord.aggregate({
            where: {
                ...outstandingLoanWhere,
                entityId,
            },
            _sum: {
                remainingPhp: true,
            },
        }),
    ]);

    return {
        allEntitiesOutstandingPhp: Number(allEntitiesAggregate._sum.remainingPhp ?? 0),
        activeEntityOutstandingPhp: Number(activeEntityAggregate._sum.remainingPhp ?? 0),
    };
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

