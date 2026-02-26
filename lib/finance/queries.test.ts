import { Prisma, TransactionKind, WalletAccountType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDashboardSummary } from "@/lib/finance/queries";

const { mockPrisma, mockEstimate } = vi.hoisted(() => ({
    mockPrisma: {
        walletAccount: { findMany: vi.fn() },
        investment: { findMany: vi.fn() },
        budgetEnvelope: { aggregate: vi.fn() },
        financeTransaction: { aggregate: vi.fn() },
        incomeStream: { aggregate: vi.fn() },
    },
    mockEstimate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
    prisma: mockPrisma,
}));

vi.mock("@/lib/finance/coins-ph", () => ({
    getCoinsPhEstimatedValuePhp: mockEstimate,
}));

describe("queries.getDashboardSummary", () => {
    beforeEach(() => {
        mockPrisma.walletAccount.findMany.mockResolvedValue([
            { type: WalletAccountType.CASH, currentBalanceAmount: new Prisma.Decimal(1000) },
            { type: WalletAccountType.CREDIT_CARD, currentBalanceAmount: new Prisma.Decimal(200) },
        ]);
        mockPrisma.investment.findMany.mockImplementation(async ({ where }: { where: { entityId?: string } }) => {
            if (where.entityId === "e1") {
                return [{ name: "BTC", value: new Prisma.Decimal(2) }];
            }
            return [
                { name: "BTC", value: new Prisma.Decimal(2) },
                { name: "ETH", value: new Prisma.Decimal(3) },
            ];
        });
        mockPrisma.budgetEnvelope.aggregate.mockResolvedValue({
            _sum: { availablePhp: new Prisma.Decimal(300) },
        });
        mockPrisma.financeTransaction.aggregate.mockImplementation(async ({ where }: { where: { kind: TransactionKind | { in: TransactionKind[] } } }) => {
            if (where.kind === TransactionKind.INCOME) {
                return { _sum: { amountPhp: new Prisma.Decimal(500) } };
            }
            return { _sum: { amountPhp: new Prisma.Decimal(200) } };
        });
        mockPrisma.incomeStream.aggregate.mockResolvedValue({
            _sum: { defaultAmountPhp: new Prisma.Decimal(1000) },
        });
        mockEstimate.mockImplementation(async (_symbol: string, units: number) => units * 100);
    });

    it("scopes investment aggregation by active entity", async () => {
        const summary = await getDashboardSummary("u1", "e1");

        expect(mockPrisma.investment.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                userId: "u1",
                entityId: "e1",
                isArchived: false,
            }),
        }));
        expect(summary.totalInvestmentPhp).toBe(200);
        expect(summary.totalAssetsPhp).toBe(1400);
        expect(summary.totalWalletBalancePhp).toBe(1000);
        expect(summary.totalCreditCardDebtPhp).toBe(200);
        expect(summary.monthIncomePhp).toBe(500);
        expect(summary.monthExpensePhp).toBe(200);
        expect(summary.monthNetCashflowPhp).toBe(300);
    });
});
