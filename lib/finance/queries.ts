import {
    BudgetEnvelopeSystemType,
    LoanDirection,
    LoanStatus,
    Prisma,
    TransactionKind,
    WalletAccountType,
} from "@prisma/client";
import { getCoinsPhBidPricePhp } from "@/lib/finance/coins-ph";
import { prisma } from "@/lib/prisma";
import type { DashboardSummary } from "@/lib/finance/types";

const startOfMonth = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
};

const shouldLogFinanceQueries = process.env.NODE_ENV !== "test";

const logFinanceQuery = (
    level: "info" | "error",
    payload: {
        queryType: string;
        entityId: string;
        durationMs: number;
        details?: Record<string, unknown>;
        error?: string;
    },
) => {
    if (!shouldLogFinanceQueries) {
        return;
    }

    const logger = level === "error" ? console.error : console.info;
    logger(JSON.stringify({
        scope: "finance-query",
        level,
        ...payload,
    }));
};

const inferAssetSymbol = (name: string) => {
    const match = name.toUpperCase().match(/\b[A-Z]{2,10}\b/);
    return match?.[0] ?? "UNITS";
};

const sumTransactionKind = (
    rows: Array<{ kind: TransactionKind; _sum: { amountPhp: Prisma.Decimal | null } }>,
    kind: TransactionKind,
) => {
    const row = rows.find((item) => item.kind === kind);
    return Number(row?._sum.amountPhp ?? 0);
};

export const getDashboardSummary = async (userId: string, entityId: string): Promise<DashboardSummary> => {
    const queryStartedAt = Date.now();

    try {
        const monthStart = startOfMonth();
        const [walletByType, investments, budgetBySystem, monthTransactionsByKind, incomeStreamAggregate] = await Promise.all([
            prisma.walletAccount.groupBy({
                by: ["type"],
                where: {
                    userId,
                    entityId,
                    isArchived: false,
                },
                _sum: {
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
                    initialInvestmentPhp: true,
                },
            }),
            prisma.budgetEnvelope.groupBy({
                by: ["isSystem", "systemType"],
                where: {
                    userId,
                    entityId,
                    isArchived: false,
                },
                _sum: {
                    availablePhp: true,
                },
            }),
            prisma.financeTransaction.groupBy({
                by: ["kind"],
                where: {
                    userId,
                    entityId,
                    isReversal: false,
                    voidedAt: null,
                    postedAt: {
                        gte: monthStart,
                    },
                    kind: {
                        in: [TransactionKind.INCOME, TransactionKind.EXPENSE, TransactionKind.CREDIT_CARD_CHARGE],
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

        const uniqueSymbols = Array.from(
            new Set(investments.map((investment) => inferAssetSymbol(investment.name))),
        );
        const bidBySymbol = new Map<string, number | null>();
        const bidResults = await Promise.allSettled(uniqueSymbols.map(async (symbol) => {
            const bid = await getCoinsPhBidPricePhp(symbol);
            return [symbol, bid] as const;
        }));
        for (const result of bidResults) {
            if (result.status === "fulfilled") {
                bidBySymbol.set(result.value[0], result.value[1]);
            }
        }

        let totalWalletBalancePhp = 0;
        let totalAllWalletsPhp = 0;
        let totalCreditCardDebtPhp = 0;
        for (const wallet of walletByType) {
            const amount = Number(wallet._sum.currentBalanceAmount ?? 0);
            totalAllWalletsPhp += amount;

            if (wallet.type === WalletAccountType.CREDIT_CARD) {
                totalCreditCardDebtPhp += amount;
            }
            if (wallet.type !== WalletAccountType.CREDIT_CARD && wallet.type !== WalletAccountType.ASSET) {
                totalWalletBalancePhp += amount;
            }
        }

        let budgetAvailablePhp = 0;
        let totalCreditPaymentReservePhp = 0;
        for (const budget of budgetBySystem) {
            const amount = Number(budget._sum.availablePhp ?? 0);
            if (budget.isSystem && budget.systemType === BudgetEnvelopeSystemType.CREDIT_CARD_PAYMENT) {
                totalCreditPaymentReservePhp += amount;
                continue;
            }
            if (!budget.isSystem) {
                budgetAvailablePhp += amount;
            }
        }

        const monthIncomePhp = sumTransactionKind(monthTransactionsByKind, TransactionKind.INCOME);
        const monthExpensePhp =
            sumTransactionKind(monthTransactionsByKind, TransactionKind.EXPENSE)
            + sumTransactionKind(monthTransactionsByKind, TransactionKind.CREDIT_CARD_CHARGE);

        const totalEstimatedInvestmentsPhp = investments.reduce((total, investment) => {
            const bidPrice = bidBySymbol.get(inferAssetSymbol(investment.name)) ?? null;
            if (bidPrice !== null && Number.isFinite(bidPrice) && bidPrice > 0) {
                return total + bidPrice * Number(investment.value);
            }
            return total + Number(investment.initialInvestmentPhp);
        }, 0);

        const totalAssetsPhp = totalAllWalletsPhp + totalEstimatedInvestmentsPhp;
        const monthlyTotalIncomePhp = Number(incomeStreamAggregate._sum.defaultAmountPhp ?? 0);
        const summary: DashboardSummary = {
            totalWalletBalancePhp,
            totalCreditCardDebtPhp,
            totalCreditPaymentReservePhp,
            totalAssetsPhp,
            totalInvestmentPhp: totalEstimatedInvestmentsPhp,
            netPositionPhp: totalWalletBalancePhp - totalCreditCardDebtPhp,
            budgetAvailablePhp,
            unallocatedCashPhp: totalWalletBalancePhp - (budgetAvailablePhp + totalCreditPaymentReservePhp),
            monthlyTotalIncomePhp,
            monthIncomePhp,
            monthExpensePhp,
            monthNetCashflowPhp: monthIncomePhp - monthExpensePhp,
        };

        logFinanceQuery("info", {
            queryType: "dashboard-summary",
            entityId,
            durationMs: Date.now() - queryStartedAt,
            details: {
                investmentCount: investments.length,
                symbolCount: uniqueSymbols.length,
            },
        });

        return summary;
    } catch (error) {
        logFinanceQuery("error", {
            queryType: "dashboard-summary",
            entityId,
            durationMs: Date.now() - queryStartedAt,
            error: error instanceof Error ? error.message : "Unknown query error.",
        });
        throw error;
    }
};

export const getBudgetStats = async (userId: string, entityId: string) => {
    const queryStartedAt = Date.now();

    try {
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
                countsTowardBudget: true,
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

        const rows = envelopes.map((envelope) => {
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

        logFinanceQuery("info", {
            queryType: "budget-stats",
            entityId,
            durationMs: Date.now() - queryStartedAt,
            details: {
                envelopeCount: envelopes.length,
            },
        });

        return rows;
    } catch (error) {
        logFinanceQuery("error", {
            queryType: "budget-stats",
            entityId,
            durationMs: Date.now() - queryStartedAt,
            error: error instanceof Error ? error.message : "Unknown query error.",
        });
        throw error;
    }
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
    const queryStartedAt = Date.now();

    try {
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

        const totals = {
            allEntitiesOutstandingPhp: Number(allEntitiesAggregate._sum.remainingPhp ?? 0),
            activeEntityOutstandingPhp: Number(activeEntityAggregate._sum.remainingPhp ?? 0),
        };

        logFinanceQuery("info", {
            queryType: "outstanding-loan-totals",
            entityId,
            durationMs: Date.now() - queryStartedAt,
        });

        return totals;
    } catch (error) {
        logFinanceQuery("error", {
            queryType: "outstanding-loan-totals",
            entityId,
            durationMs: Date.now() - queryStartedAt,
            error: error instanceof Error ? error.message : "Unknown query error.",
        });
        throw error;
    }
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
