import { ImportBatchStatus, ImportMode, ImportRowStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ParsedWorkbook } from "@/lib/import/workbook";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        importBatch: {
            create: vi.fn(),
            findFirst: vi.fn(),
        },
        importRow: {
            findMany: vi.fn(),
            createMany: vi.fn(),
            groupBy: vi.fn(),
        },
    },
}));

vi.mock("@/lib/prisma", () => ({
    prisma: mockPrisma,
}));

let stageWorkbookImportInDb: typeof import("@/lib/import/staging-store").stageWorkbookImportInDb;
let getImportBatchStatusForUser: typeof import("@/lib/import/staging-store").getImportBatchStatusForUser;

beforeEach(async () => {
    vi.resetAllMocks();
    const imported = await import("@/lib/import/staging-store");
    stageWorkbookImportInDb = imported.stageWorkbookImportInDb;
    getImportBatchStatusForUser = imported.getImportBatchStatusForUser;
});

describe("import staging store", () => {
    it("stages only non-duplicate rows using idempotency keys", async () => {
        const parsedWorkbook: ParsedWorkbook = {
            sheetNames: ["Wallet"],
            warnings: [],
            counts: {
                wallet: 2,
                statistics: 0,
                income: 0,
                budget: 0,
                loan: 0,
                transactions: 0,
                totalRows: 2,
            },
            rows: [
                {
                    sheetName: "Wallet",
                    rowIndex: 2,
                    rowHash: "hash_1",
                    idempotencyKey: "entity_1:Wallet:2:hash_1",
                    payloadJson: {
                        rowType: "wallet",
                        name: "Wallet A",
                        amountPhp: 100,
                        initialInvestmentPhp: null,
                        remarks: null,
                    },
                },
                {
                    sheetName: "Wallet",
                    rowIndex: 3,
                    rowHash: "hash_2",
                    idempotencyKey: "entity_1:Wallet:3:hash_2",
                    payloadJson: {
                        rowType: "wallet",
                        name: "Wallet B",
                        amountPhp: 200,
                        initialInvestmentPhp: null,
                        remarks: null,
                    },
                },
            ],
        };

        mockPrisma.importBatch.create.mockResolvedValue({ id: "batch_1" });
        mockPrisma.importRow.findMany.mockResolvedValue([
            { idempotencyKey: "entity_1:Wallet:2:hash_1" },
        ]);
        mockPrisma.importRow.createMany.mockResolvedValue({ count: 1 });

        const result = await stageWorkbookImportInDb({
            userId: "user_1",
            entityId: "entity_1",
            sourceFileName: "workbook.xlsx",
            sourceFileHash: "file_hash",
            importMode: ImportMode.BALANCE_BOOTSTRAP,
            parsedWorkbook,
        });

        expect(result).toEqual({
            batchId: "batch_1",
            stagedRowCount: 1,
            duplicateRowCount: 1,
        });
        expect(mockPrisma.importRow.createMany).toHaveBeenCalledWith({
            data: [
                expect.objectContaining({
                    batchId: "batch_1",
                    idempotencyKey: "entity_1:Wallet:3:hash_2",
                    status: ImportRowStatus.STAGED,
                }),
            ],
            skipDuplicates: true,
        });
    });

    it("returns batch status with row counters and errors", async () => {
        mockPrisma.importBatch.findFirst.mockResolvedValue({
            id: "batch_1",
            importMode: ImportMode.BALANCE_BOOTSTRAP,
            status: ImportBatchStatus.FAILED,
            sourceFileName: "workbook.xlsx",
            createdAt: new Date("2026-02-27T00:00:00.000Z"),
            committedAt: null,
            errorMessage: "Wallet row 2: invalid amount",
        });
        mockPrisma.importRow.groupBy.mockResolvedValue([
            { status: ImportRowStatus.STAGED, _count: { _all: 2 } },
            { status: ImportRowStatus.COMMITTED, _count: { _all: 3 } },
            { status: ImportRowStatus.FAILED, _count: { _all: 1 } },
        ]);
        mockPrisma.importRow.findMany.mockResolvedValue([
            { sheetName: "Wallet", rowIndex: 2, errorMessage: "Wallet row 2: invalid amount" },
        ]);

        const status = await getImportBatchStatusForUser("user_1", "entity_1", "batch_1");

        expect(status).toEqual({
            batchId: "batch_1",
            importMode: ImportMode.BALANCE_BOOTSTRAP,
            status: ImportBatchStatus.FAILED,
            sourceFileName: "workbook.xlsx",
            createdAt: new Date("2026-02-27T00:00:00.000Z"),
            committedAt: null,
            errorMessage: "Wallet row 2: invalid amount",
            rowCounts: {
                total: 6,
                staged: 2,
                committed: 3,
                failed: 1,
            },
            rowErrors: [
                { sheetName: "Wallet", rowIndex: 2, errorMessage: "Wallet row 2: invalid amount" },
            ],
        });
    });
});
