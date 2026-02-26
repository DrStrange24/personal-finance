import {
    AdjustmentReasonCode,
    ImportBatchStatus,
    ImportMode,
    ImportRowStatus,
    LoanDirection,
    LoanStatus,
    Prisma,
    TransactionKind,
    WalletAccountType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
    postFinanceTransactionInTx,
    reconcileWalletBalanceWithAdjustmentInTx,
    syncBudgetEnvelopeAvailableForImportInTx,
    syncLoanSnapshotForImportInTx,
} from "@/lib/finance/posting-engine";
import type { ImportRowPayload } from "@/lib/import/workbook";

type TxClient = Prisma.TransactionClient;

type ImportRowRecord = {
    id: string;
    sheetName: string;
    rowIndex: number;
    idempotencyKey: string;
    payloadJson: Prisma.JsonValue;
};

type CommitResultCounters = {
    walletAccountsUpserted: number;
    budgetEnvelopesUpserted: number;
    incomeStreamsUpserted: number;
    loansUpserted: number;
    monthlyOverviewRowsInserted: number;
};

export type CommitImportBatchResult = {
    batchId: string;
    status: "COMMITTED" | "NO_OP";
    importMode: ImportMode;
    rowCounts: {
        total: number;
        staged: number;
        committed: number;
        failed: number;
    };
    result: CommitResultCounters;
};

class ImportRowCommitError extends Error {
    rowId: string;
    sheetName: string;
    rowIndex: number;

    constructor(row: Pick<ImportRowRecord, "id" | "sheetName" | "rowIndex">, message: string) {
        super(message);
        this.name = "ImportRowCommitError";
        this.rowId = row.id;
        this.sheetName = row.sheetName;
        this.rowIndex = row.rowIndex;
    }
}

const inferWalletType = (name: string) => {
    const lowered = name.toLowerCase();
    if (lowered.includes("gcash") || lowered.includes("coins") || lowered.includes("maya")) {
        return WalletAccountType.E_WALLET;
    }
    if (lowered.includes("bank") || lowered.includes("bdo") || lowered.includes("wise")) {
        return WalletAccountType.BANK;
    }
    if (lowered.includes("credit") || lowered.includes("atome")) {
        return WalletAccountType.CREDIT_CARD;
    }
    return WalletAccountType.CASH;
};

const ensureObject = (value: Prisma.JsonValue): Record<string, unknown> => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("Row payload is not a valid object.");
    }
    return value as Record<string, unknown>;
};

const asString = (value: unknown, field: string) => {
    if (typeof value !== "string") {
        throw new Error(`Payload field '${field}' must be a string.`);
    }
    return value;
};

const asNullableString = (value: unknown, field: string) => {
    if (value === null || value === undefined) {
        return null;
    }
    if (typeof value !== "string") {
        throw new Error(`Payload field '${field}' must be a string or null.`);
    }
    return value;
};

const asNumber = (value: unknown, field: string) => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error(`Payload field '${field}' must be a finite number.`);
    }
    return value;
};

const asNullableNumber = (value: unknown, field: string) => {
    if (value === null || value === undefined) {
        return null;
    }
    return asNumber(value, field);
};

const parseImportRowPayload = (value: Prisma.JsonValue): ImportRowPayload => {
    const payload = ensureObject(value);
    const rowType = asString(payload.rowType, "rowType");

    switch (rowType) {
        case "wallet":
            return {
                rowType: "wallet",
                name: asString(payload.name, "name"),
                amountPhp: asNumber(payload.amountPhp, "amountPhp"),
                initialInvestmentPhp: asNullableNumber(payload.initialInvestmentPhp, "initialInvestmentPhp"),
                remarks: asNullableString(payload.remarks, "remarks"),
            };
        case "statistics":
            return {
                rowType: "statistics",
                entryDateIso: asString(payload.entryDateIso, "entryDateIso"),
                walletAmountPhp: asNumber(payload.walletAmountPhp, "walletAmountPhp"),
                remarks: asNullableString(payload.remarks, "remarks"),
            };
        case "income":
            return {
                rowType: "income",
                name: asString(payload.name, "name"),
                amountPhp: asNumber(payload.amountPhp, "amountPhp"),
                remarks: asNullableString(payload.remarks, "remarks"),
            };
        case "budget":
            return {
                rowType: "budget",
                name: asString(payload.name, "name"),
                monthlyAmountPhp: asNullableNumber(payload.monthlyAmountPhp, "monthlyAmountPhp"),
                percentBase: asNullableNumber(payload.percentBase, "percentBase"),
                payTo: asNullableString(payload.payTo, "payTo"),
                budgetBalancePhp: asNullableNumber(payload.budgetBalancePhp, "budgetBalancePhp"),
                remarks: asNullableString(payload.remarks, "remarks"),
            };
        case "loan":
            return {
                rowType: "loan",
                itemName: asString(payload.itemName, "itemName"),
                pricePhp: asNullableNumber(payload.pricePhp, "pricePhp"),
                monthlyPhp: asNullableNumber(payload.monthlyPhp, "monthlyPhp"),
                paidPhp: asNullableNumber(payload.paidPhp, "paidPhp"),
                remainingPhp: asNullableNumber(payload.remainingPhp, "remainingPhp"),
                paidStatus: asNullableString(payload.paidStatus, "paidStatus"),
                payTo: asNullableString(payload.payTo, "payTo"),
            };
        case "transaction":
            return {
                rowType: "transaction",
                postedAtIso: asString(payload.postedAtIso, "postedAtIso"),
                kind: asString(payload.kind, "kind"),
                amountPhp: asNumber(payload.amountPhp, "amountPhp"),
                walletName: asString(payload.walletName, "walletName"),
                targetWalletName: asNullableString(payload.targetWalletName, "targetWalletName"),
                budgetName: asNullableString(payload.budgetName, "budgetName"),
                incomeName: asNullableString(payload.incomeName, "incomeName"),
                loanItemName: asNullableString(payload.loanItemName, "loanItemName"),
                loanCounterparty: asNullableString(payload.loanCounterparty, "loanCounterparty"),
                remarks: asNullableString(payload.remarks, "remarks"),
                externalId: asNullableString(payload.externalId, "externalId"),
                adjustmentReasonCode: asNullableString(payload.adjustmentReasonCode, "adjustmentReasonCode"),
            };
        default:
            throw new Error(`Unsupported rowType '${rowType}'.`);
    }
};

const getBatchRowCounts = async (batchId: string) => {
    const grouped = await prisma.importRow.groupBy({
        by: ["status"],
        where: {
            batchId,
        },
        _count: {
            _all: true,
        },
    });

    const staged = grouped.find((entry) => entry.status === ImportRowStatus.STAGED)?._count._all ?? 0;
    const committed = grouped.find((entry) => entry.status === ImportRowStatus.COMMITTED)?._count._all ?? 0;
    const failed = grouped.find((entry) => entry.status === ImportRowStatus.FAILED)?._count._all ?? 0;

    return {
        total: staged + committed + failed,
        staged,
        committed,
        failed,
    };
};

const commitWalletRowInTx = async (
    tx: TxClient,
    userId: string,
    entityId: string,
    batchId: string,
    row: ImportRowRecord,
    payload: Extract<ImportRowPayload, { rowType: "wallet" }>,
    result: CommitResultCounters,
) => {
    const existingWallet = await tx.walletAccount.findFirst({
        where: {
            userId,
            entityId,
            name: payload.name,
            isArchived: false,
        },
    });

    const isInvestmentEntry = (payload.initialInvestmentPhp ?? 0) > 0;
    if (isInvestmentEntry) {
        const existingInvestment = await tx.investment.findFirst({
            where: {
                userId,
                entityId,
                name: payload.name,
                isArchived: false,
            },
        });

        const initialInvestmentPhp = new Prisma.Decimal(payload.initialInvestmentPhp ?? payload.amountPhp);
        const value = new Prisma.Decimal(payload.amountPhp);
        if (existingInvestment) {
            await tx.investment.update({
                where: { id: existingInvestment.id },
                data: {
                    initialInvestmentPhp,
                    value,
                    remarks: payload.remarks,
                },
            });
        } else {
            await tx.investment.create({
                data: {
                    userId,
                    entityId,
                    name: payload.name,
                    initialInvestmentPhp,
                    value,
                    remarks: payload.remarks,
                },
            });
        }

        if (existingWallet && existingWallet.type === WalletAccountType.ASSET) {
            await tx.walletAccount.update({
                where: { id: existingWallet.id },
                data: {
                    isArchived: true,
                },
            });
        }

        result.walletAccountsUpserted += 1;
        return;
    }

    const walletType = inferWalletType(payload.name);
    const wallet = existingWallet
        ? await tx.walletAccount.update({
            where: { id: existingWallet.id },
            data: {
                type: walletType,
            },
        })
        : await tx.walletAccount.create({
            data: {
                userId,
                entityId,
                name: payload.name,
                type: walletType,
                currentBalanceAmount: 0,
            },
        });

    await reconcileWalletBalanceWithAdjustmentInTx(tx, {
        userId,
        entityId,
        actorUserId: userId,
        walletAccountId: wallet.id,
        targetBalancePhp: payload.amountPhp,
        reasonCode: AdjustmentReasonCode.IMPORT_BOOTSTRAP,
        remarks: "Wallet balance synchronized from workbook import.",
        externalId: `${row.idempotencyKey}:wallet-balance`,
        importBatchId: batchId,
    });

    result.walletAccountsUpserted += 1;
};

const commitBudgetRowInTx = async (
    tx: TxClient,
    userId: string,
    entityId: string,
    mode: ImportMode,
    payload: Extract<ImportRowPayload, { rowType: "budget" }>,
    result: CommitResultCounters,
) => {
    const existing = await tx.budgetEnvelope.findFirst({
        where: {
            userId,
            entityId,
            name: payload.name,
            isArchived: false,
        },
    });

    const monthlyTargetPhp = new Prisma.Decimal(payload.monthlyAmountPhp ?? 0);
    const remarks = payload.remarks;
    const envelope = existing
        ? await tx.budgetEnvelope.update({
            where: { id: existing.id },
            data: {
                monthlyTargetPhp,
                payTo: payload.payTo,
                remarks,
            },
        })
        : await tx.budgetEnvelope.create({
            data: {
                userId,
                entityId,
                name: payload.name,
                monthlyTargetPhp,
                availablePhp: 0,
                payTo: payload.payTo,
                remarks,
            },
        });

    if (mode === ImportMode.BALANCE_BOOTSTRAP && payload.budgetBalancePhp !== null) {
        await syncBudgetEnvelopeAvailableForImportInTx(tx, {
            userId,
            entityId,
            budgetEnvelopeId: envelope.id,
            targetAvailablePhp: payload.budgetBalancePhp,
        });
    }

    result.budgetEnvelopesUpserted += 1;
};

const commitIncomeRowInTx = async (
    tx: TxClient,
    userId: string,
    entityId: string,
    payload: Extract<ImportRowPayload, { rowType: "income" }>,
    result: CommitResultCounters,
) => {
    const existing = await tx.incomeStream.findFirst({
        where: {
            userId,
            entityId,
            name: payload.name,
        },
    });

    if (existing) {
        await tx.incomeStream.update({
            where: { id: existing.id },
            data: {
                defaultAmountPhp: payload.amountPhp,
                remarks: payload.remarks,
                isActive: true,
            },
        });
    } else {
        await tx.incomeStream.create({
            data: {
                userId,
                entityId,
                name: payload.name,
                defaultAmountPhp: payload.amountPhp,
                remarks: payload.remarks,
                isActive: true,
            },
        });
    }

    result.incomeStreamsUpserted += 1;
};

const commitLoanRowInTx = async (
    tx: TxClient,
    userId: string,
    entityId: string,
    payload: Extract<ImportRowPayload, { rowType: "loan" }>,
    result: CommitResultCounters,
) => {
    const existing = await tx.loanRecord.findFirst({
        where: {
            userId,
            entityId,
            itemName: payload.itemName,
            counterparty: payload.payTo,
        },
    });

    const principalPhp = new Prisma.Decimal(payload.pricePhp ?? 0);
    const paidToDatePhp = new Prisma.Decimal(payload.paidPhp ?? 0);
    const remainingPhp = new Prisma.Decimal(payload.remainingPhp ?? 0);
    const monthlyDuePhp = payload.monthlyPhp === null ? null : new Prisma.Decimal(payload.monthlyPhp);
    const status = remainingPhp.lte(0) || payload.paidStatus?.toLowerCase() === "paid"
        ? LoanStatus.PAID
        : LoanStatus.ACTIVE;

    const loan = existing
        ? await tx.loanRecord.update({
            where: { id: existing.id },
            data: {
                monthlyDuePhp,
            },
        })
        : await tx.loanRecord.create({
            data: {
                userId,
                entityId,
                direction: LoanDirection.YOU_OWE,
                itemName: payload.itemName,
                counterparty: payload.payTo,
                principalPhp,
                monthlyDuePhp,
                paidToDatePhp: 0,
                remainingPhp: principalPhp,
                status: principalPhp.lte(0) ? LoanStatus.PAID : LoanStatus.ACTIVE,
            },
        });

    await syncLoanSnapshotForImportInTx(tx, {
        userId,
        entityId,
        loanRecordId: loan.id,
        principalPhp: Number(principalPhp),
        paidToDatePhp: Number(paidToDatePhp),
        remainingPhp: Number(remainingPhp),
        status,
    });

    result.loansUpserted += 1;
};

const commitStatisticsRowInTx = async (
    tx: TxClient,
    userId: string,
    payload: Extract<ImportRowPayload, { rowType: "statistics" }>,
    result: CommitResultCounters,
) => {
    const entryDate = new Date(payload.entryDateIso);
    if (Number.isNaN(entryDate.valueOf())) {
        throw new Error("Invalid statistics entry date.");
    }

    const existing = await tx.monthlyOverviewEntry.findFirst({
        where: {
            userId,
            entryDate,
        },
    });

    if (!existing) {
        await tx.monthlyOverviewEntry.create({
            data: {
                userId,
                entryDate,
                walletAmount: payload.walletAmountPhp,
                remarks: payload.remarks,
            },
        });
        result.monthlyOverviewRowsInserted += 1;
    }
};

const toTransactionKind = (value: string) => {
    const normalized = value.trim().toUpperCase() as TransactionKind;
    if (Object.values(TransactionKind).includes(normalized)) {
        return normalized;
    }
    throw new Error(`Unsupported transaction kind '${value}'.`);
};

const toAdjustmentReasonCode = (value: string | null) => {
    if (!value) {
        return AdjustmentReasonCode.IMPORT_BOOTSTRAP;
    }

    const normalized = value.trim().toUpperCase() as AdjustmentReasonCode;
    if (Object.values(AdjustmentReasonCode).includes(normalized)) {
        return normalized;
    }
    throw new Error(`Unsupported adjustment reason code '${value}'.`);
};

const commitLedgerTransactionRowInTx = async (
    tx: TxClient,
    userId: string,
    entityId: string,
    batchId: string,
    row: ImportRowRecord,
    payload: Extract<ImportRowPayload, { rowType: "transaction" }>,
) => {
    const postedAt = new Date(payload.postedAtIso);
    if (Number.isNaN(postedAt.valueOf())) {
        throw new Error("Invalid transaction date.");
    }

    const kind = toTransactionKind(payload.kind);

    const sourceWallet = await tx.walletAccount.findFirst({
        where: {
            userId,
            entityId,
            name: payload.walletName,
            isArchived: false,
        },
        select: {
            id: true,
        },
    });
    if (!sourceWallet) {
        throw new Error(`Source wallet '${payload.walletName}' not found.`);
    }

    const targetWallet = payload.targetWalletName
        ? await tx.walletAccount.findFirst({
            where: {
                userId,
                entityId,
                name: payload.targetWalletName,
                isArchived: false,
            },
            select: {
                id: true,
            },
        })
        : null;
    if (payload.targetWalletName && !targetWallet) {
        throw new Error(`Target wallet '${payload.targetWalletName}' not found.`);
    }

    const budgetEnvelope = payload.budgetName
        ? await tx.budgetEnvelope.findFirst({
            where: {
                userId,
                entityId,
                name: payload.budgetName,
                isArchived: false,
            },
            select: {
                id: true,
            },
        })
        : null;
    if (payload.budgetName && !budgetEnvelope) {
        throw new Error(`Budget envelope '${payload.budgetName}' not found.`);
    }

    const incomeStream = payload.incomeName
        ? await tx.incomeStream.findFirst({
            where: {
                userId,
                entityId,
                name: payload.incomeName,
            },
            select: {
                id: true,
            },
        })
        : null;
    if (payload.incomeName && !incomeStream) {
        throw new Error(`Income stream '${payload.incomeName}' not found.`);
    }

    const loan = payload.loanItemName
        ? await tx.loanRecord.findFirst({
            where: {
                userId,
                entityId,
                itemName: payload.loanItemName,
                counterparty: payload.loanCounterparty,
            },
            select: {
                id: true,
            },
        })
        : null;
    if (payload.loanItemName && !loan) {
        throw new Error(`Loan '${payload.loanItemName}' not found.`);
    }

    await postFinanceTransactionInTx(tx, {
        userId,
        entityId,
        actorUserId: userId,
        kind,
        postedAt,
        amountPhp: payload.amountPhp,
        walletAccountId: sourceWallet.id,
        targetWalletAccountId: targetWallet?.id ?? null,
        budgetEnvelopeId: budgetEnvelope?.id ?? null,
        incomeStreamId: incomeStream?.id ?? null,
        loanRecordId: loan?.id ?? null,
        adjustmentReasonCode: kind === TransactionKind.ADJUSTMENT ? toAdjustmentReasonCode(payload.adjustmentReasonCode) : null,
        remarks: payload.remarks,
        externalId: payload.externalId ?? `${row.idempotencyKey}:ledger`,
        importBatchId: batchId,
    });
};

const commitImportRowInTx = async (
    tx: TxClient,
    userId: string,
    entityId: string,
    batchId: string,
    mode: ImportMode,
    row: ImportRowRecord,
    result: CommitResultCounters,
) => {
    const payload = parseImportRowPayload(row.payloadJson);

    if (mode === ImportMode.FULL_LEDGER) {
        if (payload.rowType !== "transaction") {
            throw new Error("FULL_LEDGER mode requires transaction rows.");
        }
        await commitLedgerTransactionRowInTx(tx, userId, entityId, batchId, row, payload);
        return;
    }

    if (payload.rowType === "transaction") {
        throw new Error("Transaction rows are only valid for FULL_LEDGER mode.");
    }

    switch (payload.rowType) {
        case "wallet":
            await commitWalletRowInTx(tx, userId, entityId, batchId, row, payload, result);
            return;
        case "budget":
            await commitBudgetRowInTx(tx, userId, entityId, mode, payload, result);
            return;
        case "income":
            await commitIncomeRowInTx(tx, userId, entityId, payload, result);
            return;
        case "loan":
            await commitLoanRowInTx(tx, userId, entityId, payload, result);
            return;
        case "statistics":
            await commitStatisticsRowInTx(tx, userId, payload, result);
            return;
        default:
            throw new Error("Unsupported import row type.");
    }
};

const defaultCounters = (): CommitResultCounters => ({
    walletAccountsUpserted: 0,
    budgetEnvelopesUpserted: 0,
    incomeStreamsUpserted: 0,
    loansUpserted: 0,
    monthlyOverviewRowsInserted: 0,
});

export const commitImportBatchForUser = async (
    userId: string,
    entityId: string,
    batchId: string,
): Promise<CommitImportBatchResult> => {
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
        },
    });

    if (!batch) {
        throw new Error("Import batch not found for the active entity.");
    }

    if (batch.status === ImportBatchStatus.COMMITTED) {
        return {
            batchId: batch.id,
            status: "NO_OP",
            importMode: batch.importMode,
            rowCounts: await getBatchRowCounts(batch.id),
            result: defaultCounters(),
        };
    }

    if (batch.status === ImportBatchStatus.COMMITTING) {
        throw new Error("Import batch is currently committing.");
    }

    const startCommit = await prisma.importBatch.updateMany({
        where: {
            id: batch.id,
            userId,
            entityId,
            status: {
                in: [ImportBatchStatus.STAGED, ImportBatchStatus.FAILED],
            },
        },
        data: {
            status: ImportBatchStatus.COMMITTING,
            errorMessage: null,
        },
    });

    if (startCommit.count === 0) {
        throw new Error("Import batch could not be moved to committing state.");
    }

    try {
        const txResult = await prisma.$transaction(async (tx) => {
            const rows = await tx.importRow.findMany({
                where: {
                    batchId: batch.id,
                    status: {
                        in: [ImportRowStatus.STAGED, ImportRowStatus.FAILED],
                    },
                },
                select: {
                    id: true,
                    sheetName: true,
                    rowIndex: true,
                    idempotencyKey: true,
                    payloadJson: true,
                },
                orderBy: [
                    { sheetName: "asc" },
                    { rowIndex: "asc" },
                ],
            });

            const result = defaultCounters();
            for (const row of rows) {
                try {
                    await commitImportRowInTx(tx, userId, entityId, batch.id, batch.importMode, row, result);
                    await tx.importRow.update({
                        where: { id: row.id },
                        data: {
                            status: ImportRowStatus.COMMITTED,
                            errorMessage: null,
                            committedAt: new Date(),
                        },
                    });
                } catch (error) {
                    const message = error instanceof Error ? error.message : "Unknown row commit failure.";
                    throw new ImportRowCommitError(row, message);
                }
            }

            await tx.importBatch.update({
                where: { id: batch.id },
                data: {
                    status: ImportBatchStatus.COMMITTED,
                    committedAt: new Date(),
                    errorMessage: null,
                },
            });

            return result;
        });

        return {
            batchId: batch.id,
            status: "COMMITTED",
            importMode: batch.importMode,
            rowCounts: await getBatchRowCounts(batch.id),
            result: txResult,
        };
    } catch (error) {
        let batchErrorMessage = "Import commit failed.";

        if (error instanceof ImportRowCommitError) {
            const rowFailureMessage = `${error.sheetName} row ${error.rowIndex}: ${error.message}`;
            batchErrorMessage = rowFailureMessage;
            await prisma.importRow.update({
                where: { id: error.rowId },
                data: {
                    status: ImportRowStatus.FAILED,
                    errorMessage: rowFailureMessage,
                },
            });
        } else if (error instanceof Error) {
            batchErrorMessage = error.message;
        }

        await prisma.importBatch.update({
            where: { id: batch.id },
            data: {
                status: ImportBatchStatus.FAILED,
                errorMessage: batchErrorMessage,
            },
        });

        throw new Error(batchErrorMessage);
    }
};
