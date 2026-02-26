import { ImportBatchStatus, ImportMode, ImportRowStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ParsedWorkbook } from "@/lib/import/workbook";

const chunk = <T>(items: T[], size: number) => {
    const result: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
        result.push(items.slice(index, index + size));
    }
    return result;
};

export type StageWorkbookInput = {
    userId: string;
    entityId: string;
    sourceFileName: string;
    sourceFileHash: string;
    importMode: ImportMode;
    parsedWorkbook: ParsedWorkbook;
};

export type StagedWorkbookBatch = {
    batchId: string;
    stagedRowCount: number;
    duplicateRowCount: number;
};

export const stageWorkbookImportInDb = async (input: StageWorkbookInput): Promise<StagedWorkbookBatch> => {
    const batch = await prisma.importBatch.create({
        data: {
            userId: input.userId,
            entityId: input.entityId,
            sourceFileName: input.sourceFileName,
            sourceFileHash: input.sourceFileHash,
            importMode: input.importMode,
            status: ImportBatchStatus.STAGED,
            errorMessage: null,
            committedAt: null,
        },
        select: {
            id: true,
        },
    });

    const uniqueRows = Array.from(
        new Map(input.parsedWorkbook.rows.map((row) => [row.idempotencyKey, row])).values(),
    );

    if (uniqueRows.length === 0) {
        return {
            batchId: batch.id,
            stagedRowCount: 0,
            duplicateRowCount: 0,
        };
    }

    const existingKeys = new Set<string>();
    for (const keyChunk of chunk(uniqueRows.map((row) => row.idempotencyKey), 500)) {
        const existing = await prisma.importRow.findMany({
            where: {
                idempotencyKey: {
                    in: keyChunk,
                },
            },
            select: {
                idempotencyKey: true,
            },
        });
        for (const row of existing) {
            existingKeys.add(row.idempotencyKey);
        }
    }

    const rowsToCreate = uniqueRows
        .filter((row) => !existingKeys.has(row.idempotencyKey))
        .map((row) => ({
            batchId: batch.id,
            sheetName: row.sheetName,
            rowIndex: row.rowIndex,
            rowHash: row.rowHash,
            idempotencyKey: row.idempotencyKey,
            payloadJson: row.payloadJson,
            status: ImportRowStatus.STAGED,
        }));

    let createdCount = 0;
    if (rowsToCreate.length > 0) {
        const created = await prisma.importRow.createMany({
            data: rowsToCreate,
            skipDuplicates: true,
        });
        createdCount = created.count;
    }

    return {
        batchId: batch.id,
        stagedRowCount: createdCount,
        duplicateRowCount: uniqueRows.length - createdCount,
    };
};

export type ImportBatchStatusView = {
    batchId: string;
    importMode: ImportMode;
    status: ImportBatchStatus;
    sourceFileName: string;
    createdAt: Date;
    committedAt: Date | null;
    errorMessage: string | null;
    rowCounts: {
        total: number;
        staged: number;
        committed: number;
        failed: number;
    };
    rowErrors: Array<{
        sheetName: string;
        rowIndex: number;
        errorMessage: string | null;
    }>;
};

export const getImportBatchStatusForUser = async (
    userId: string,
    entityId: string,
    batchId: string,
): Promise<ImportBatchStatusView | null> => {
    const batch = await prisma.importBatch.findFirst({
        where: {
            id: batchId,
            userId,
            entityId,
        },
        select: {
            id: true,
            importMode: true,
            status: true,
            sourceFileName: true,
            createdAt: true,
            committedAt: true,
            errorMessage: true,
        },
    });

    if (!batch) {
        return null;
    }

    const grouped = await prisma.importRow.groupBy({
        by: ["status"],
        where: {
            batchId: batch.id,
        },
        _count: {
            _all: true,
        },
    });

    const staged = grouped.find((entry) => entry.status === ImportRowStatus.STAGED)?._count._all ?? 0;
    const committed = grouped.find((entry) => entry.status === ImportRowStatus.COMMITTED)?._count._all ?? 0;
    const failed = grouped.find((entry) => entry.status === ImportRowStatus.FAILED)?._count._all ?? 0;

    const rowErrors = await prisma.importRow.findMany({
        where: {
            batchId: batch.id,
            status: ImportRowStatus.FAILED,
        },
        select: {
            sheetName: true,
            rowIndex: true,
            errorMessage: true,
        },
        orderBy: [
            { sheetName: "asc" },
            { rowIndex: "asc" },
        ],
    });

    return {
        batchId: batch.id,
        importMode: batch.importMode,
        status: batch.status,
        sourceFileName: batch.sourceFileName,
        createdAt: batch.createdAt,
        committedAt: batch.committedAt,
        errorMessage: batch.errorMessage,
        rowCounts: {
            total: staged + committed + failed,
            staged,
            committed,
            failed,
        },
        rowErrors,
    };
};
