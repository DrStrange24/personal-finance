import { BudgetEnvelopeSystemType, Prisma, TransactionKind, WalletAccountType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getBudgetStats, getDashboardSummary } from "@/lib/finance/queries";

const { mockPrisma, mockBidPrice } = vi.hoisted(() => ({
    mockPrisma: {
        walletAccount: {
            groupBy: vi.fn(),
        },
        creditAccount: {
            aggregate: vi.fn(),
        },
        investment: {
            findMany: vi.fn(),
        },
        budgetEnvelope: {
            groupBy: vi.fn(),
            findMany: vi.fn(),
        },
        financeTransaction: {
            groupBy: vi.fn(),
        },
        incomeStream: {
            aggregate: vi.fn(),
        },
    },
    mockBidPrice: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
    prisma: mockPrisma,
}));

vi.mock("@/lib/finance/coins-ph", () => ({
    getCoinsPhBidPricePhp: mockBidPrice,
}));

describe("queries", () => {
    beforeEach(() => {
        vi.resetAllMocks();

        mockPrisma.walletAccount.groupBy.mockResolvedValue([
            { type: WalletAccountType.CASH, _sum: { currentBalanceAmount: new Prisma.Decimal(1000) } },
            { type: WalletAccountType.CREDIT_CARD, _sum: { currentBalanceAmount: new Prisma.Decimal(200) } },
        ]);
        mockPrisma.creditAccount.aggregate.mockResolvedValue({
            _sum: { currentBalanceAmount: new Prisma.Decimal(200) },
        });
        mockPrisma.investment.findMany.mockResolvedValue([
            {
                name: "BTC",
                value: new Prisma.Decimal(2),
                initialInvestmentPhp: new Prisma.Decimal(150),
            },
        ]);
        mockPrisma.budgetEnvelope.groupBy.mockResolvedValue([
            { isSystem: false, systemType: null, _sum: { availablePhp: new Prisma.Decimal(300) } },
            {
                isSystem: true,
                systemType: BudgetEnvelopeSystemType.CREDIT_CARD_PAYMENT,
                _sum: { availablePhp: new Prisma.Decimal(80) },
            },
        ]);
        mockPrisma.financeTransaction.groupBy.mockResolvedValue([
            { kind: TransactionKind.INCOME, _sum: { amountPhp: new Prisma.Decimal(500) } },
            { kind: TransactionKind.EXPENSE, _sum: { amountPhp: new Prisma.Decimal(120) } },
            { kind: TransactionKind.CREDIT_CARD_CHARGE, _sum: { amountPhp: new Prisma.Decimal(80) } },
        ]);
        mockPrisma.incomeStream.aggregate.mockResolvedValue({
            _sum: { defaultAmountPhp: new Prisma.Decimal(1000) },
        });
        mockBidPrice.mockResolvedValue(100);
    });

    it("computes ledger KPI metrics and cash allocation regression values", async () => {
        const summary = await getDashboardSummary("u1", "e1");

        expect(summary.totalWalletBalancePhp).toBe(1000);
        expect(summary.totalCreditCardDebtPhp).toBe(200);
        expect(summary.totalCreditPaymentReservePhp).toBe(80);
        expect(summary.totalInvestmentPhp).toBe(200);
        expect(summary.totalAssetsPhp).toBe(1400);
        expect(summary.netPositionPhp).toBe(800);
        expect(summary.budgetAvailablePhp).toBe(300);
        expect(summary.unallocatedCashPhp).toBe(-200);
        expect(summary.monthIncomePhp).toBe(500);
        expect(summary.monthExpensePhp).toBe(200);
        expect(summary.monthNetCashflowPhp).toBe(300);
    });

    it("falls back to initial investment when bid price lookup fails", async () => {
        mockBidPrice.mockResolvedValue(null);

        const summary = await getDashboardSummary("u1", "e1");

        expect(summary.totalInvestmentPhp).toBe(150);
        expect(summary.totalAssetsPhp).toBe(1350);
    });

    it("uses credit-account total used for dashboard debt", async () => {
        mockPrisma.walletAccount.groupBy.mockResolvedValue([
            { type: WalletAccountType.CASH, _sum: { currentBalanceAmount: new Prisma.Decimal(1000) } },
            { type: WalletAccountType.CREDIT_CARD, _sum: { currentBalanceAmount: new Prisma.Decimal(-200) } },
        ]);
        mockPrisma.creditAccount.aggregate.mockResolvedValue({
            _sum: { currentBalanceAmount: new Prisma.Decimal(350) },
        });

        const summary = await getDashboardSummary("u1", "e1");

        expect(summary.totalCreditCardDebtPhp).toBe(350);
        expect(summary.netPositionPhp).toBe(650);
    });

    it("enforces monthly budget spent aggregation with countsTowardBudget=true", async () => {
        mockPrisma.budgetEnvelope.findMany.mockResolvedValue([
            {
                id: "b1",
                userId: "u1",
                entityId: "e1",
                name: "Food",
                monthlyTargetPhp: new Prisma.Decimal(1000),
                availablePhp: new Prisma.Decimal(200),
                rolloverEnabled: true,
                payTo: null,
                remarks: null,
                isSystem: false,
                systemType: null,
                linkedWalletAccountId: null,
                linkedCreditAccountId: null,
                isArchived: false,
                sortOrder: 1,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        ]);
        mockPrisma.financeTransaction.groupBy.mockResolvedValue([
            {
                budgetEnvelopeId: "b1",
                _sum: {
                    amountPhp: new Prisma.Decimal(300),
                },
            },
        ]);

        const rows = await getBudgetStats("u1", "e1");

        expect(rows).toHaveLength(1);
        expect(rows[0].spentPhp).toBe(300);
        expect(rows[0].remainingPhp).toBe(700);
        expect(mockPrisma.financeTransaction.groupBy).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                countsTowardBudget: true,
                kind: {
                    in: [TransactionKind.EXPENSE, TransactionKind.CREDIT_CARD_CHARGE],
                },
            }),
        }));
    });
});
