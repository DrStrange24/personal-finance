import { ImportBatchStatus, ImportMode, ImportRowStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, reconcileWalletBalanceWithAdjustmentInTx } = vi.hoisted(() => ({
    mockPrisma: {
        importBatch: {
            findFirst: vi.fn(),
            updateMany: vi.fn(),
            update: vi.fn(),
        },
        importRow: {
            findMany: vi.fn(),
            update: vi.fn(),
            groupBy: vi.fn(),
        },
        walletAccount: {
            findFirst: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
        },
        investment: {
            findFirst: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
        },
        budgetEnvelope: {
            findFirst: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
        },
        incomeStream: {
            findFirst: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
        },
        loanRecord: {
            findFirst: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
        },
        monthlyOverviewEntry: {
            findFirst: vi.fn(),
            create: vi.fn(),
        },
        $transaction: vi.fn(),
    },
    reconcileWalletBalanceWithAdjustmentInTx: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
    prisma: mockPrisma,
}));

vi.mock("@/lib/finance/posting-engine", () => ({
    reconcileWalletBalanceWithAdjustmentInTx,
    syncBudgetEnvelopeAvailableForImportInTx: vi.fn(),
    syncLoanSnapshotForImportInTx: vi.fn(),
}));

let commitImportBatchForUser: typeof import("@/lib/import/commit").commitImportBatchForUser;

beforeEach(async () => {
    vi.resetAllMocks();
    mockPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return callback(mockPrisma);
    });
    const imported = await import("@/lib/import/commit");
    commitImportBatchForUser = imported.commitImportBatchForUser;
});

describe("import commit", () => {
    it("returns no-op for already committed batch", async () => {
        mockPrisma.importBatch.findFirst.mockResolvedValue({
            id: "batch_1",
            importMode: ImportMode.BALANCE_BOOTSTRAP,
            status: ImportBatchStatus.COMMITTED,
        });
        mockPrisma.importRow.groupBy.mockResolvedValue([
            { status: ImportRowStatus.COMMITTED, _count: { _all: 3 } },
        ]);

        const result = await commitImportBatchForUser("user_1", "entity_1", "batch_1");

        expect(result.status).toBe("NO_OP");
        expect(result.rowCounts).toEqual({
            total: 3,
            staged: 0,
            committed: 3,
            failed: 0,
        });
        expect(mockPrisma.importBatch.updateMany).not.toHaveBeenCalled();
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it("rejects batch that is not owned by active entity", async () => {
        mockPrisma.importBatch.findFirst.mockResolvedValue(null);

        await expect(commitImportBatchForUser("user_1", "entity_1", "batch_1"))
            .rejects
            .toThrow("Import batch not found for the active entity.");
    });

    it("marks row and batch failed when a row processing error happens", async () => {
        mockPrisma.importBatch.findFirst.mockResolvedValue({
            id: "batch_1",
            importMode: ImportMode.BALANCE_BOOTSTRAP,
            status: ImportBatchStatus.STAGED,
        });
        mockPrisma.importBatch.updateMany.mockResolvedValue({ count: 1 });
        mockPrisma.importRow.findMany.mockResolvedValue([
            {
                id: "row_1",
                sheetName: "Wallet",
                rowIndex: 2,
                idempotencyKey: "entity_1:Wallet:2:hash",
                payloadJson: {
                    rowType: "wallet",
                    name: "Cash Wallet",
                    amountPhp: 500,
                    initialInvestmentPhp: null,
                    remarks: null,
                },
            },
        ]);
        mockPrisma.walletAccount.findFirst.mockResolvedValue(null);
        mockPrisma.walletAccount.create.mockResolvedValue({ id: "wallet_1" });
        reconcileWalletBalanceWithAdjustmentInTx.mockRejectedValue(new Error("Amount must be greater than 0."));

        await expect(commitImportBatchForUser("user_1", "entity_1", "batch_1"))
            .rejects
            .toThrow("Wallet row 2: Amount must be greater than 0.");

        expect(mockPrisma.importRow.update).toHaveBeenCalledWith({
            where: { id: "row_1" },
            data: {
                status: ImportRowStatus.FAILED,
                errorMessage: "Wallet row 2: Amount must be greater than 0.",
            },
        });
        expect(mockPrisma.importBatch.update).toHaveBeenCalledWith({
            where: { id: "batch_1" },
            data: {
                status: ImportBatchStatus.FAILED,
                errorMessage: "Wallet row 2: Amount must be greater than 0.",
            },
        });
    });

    it("commits staged wallet rows and links external id/import batch metadata", async () => {
        mockPrisma.importBatch.findFirst.mockResolvedValue({
            id: "batch_1",
            importMode: ImportMode.BALANCE_BOOTSTRAP,
            status: ImportBatchStatus.STAGED,
        });
        mockPrisma.importBatch.updateMany.mockResolvedValue({ count: 1 });
        mockPrisma.importRow.findMany.mockResolvedValue([
            {
                id: "row_1",
                sheetName: "Wallet",
                rowIndex: 2,
                idempotencyKey: "entity_1:Wallet:2:hash",
                payloadJson: {
                    rowType: "wallet",
                    name: "Cash Wallet",
                    amountPhp: 500,
                    initialInvestmentPhp: null,
                    remarks: null,
                },
            },
        ]);
        mockPrisma.walletAccount.findFirst.mockResolvedValue(null);
        mockPrisma.walletAccount.create.mockResolvedValue({ id: "wallet_1" });
        mockPrisma.importRow.update.mockResolvedValue({});
        mockPrisma.importBatch.update.mockResolvedValue({});
        mockPrisma.importRow.groupBy.mockResolvedValue([
            { status: ImportRowStatus.COMMITTED, _count: { _all: 1 } },
        ]);
        reconcileWalletBalanceWithAdjustmentInTx.mockResolvedValue({ id: "wallet_1" });

        const result = await commitImportBatchForUser("user_1", "entity_1", "batch_1");

        expect(result.status).toBe("COMMITTED");
        expect(result.result.walletAccountsUpserted).toBe(1);
        expect(reconcileWalletBalanceWithAdjustmentInTx).toHaveBeenCalledWith(
            mockPrisma,
            expect.objectContaining({
                externalId: "entity_1:Wallet:2:hash:wallet-balance",
                importBatchId: "batch_1",
            }),
        );
    });
});
