import { Prisma, TransactionKind, WalletAccountType } from "@prisma/client";
import {
    resolveBudgetAllocationEnvelopeEntityId,
    resolveBudgetAllocationTransactions,
    resolveFundingWalletAccountIdForBudgetAllocation,
} from "@/lib/finance/budget-allocation";
import { requireOwnedCreditAccount } from "@/lib/finance/entity-scoped-records";
import { parseIncomeDistributionForm, parseTransactionForm } from "@/lib/finance/form-parsers";
import {
    deleteFinanceTransactionWithReversal,
    postFinanceTransaction,
    postFinanceTransactionsBatch,
} from "@/lib/finance/posting-engine";
import type { FinanceActionResult } from "@/lib/finance/types";
import { prisma } from "@/lib/prisma";

type TransactionOrchestrationParams = {
    userId: string;
    entityId: string;
    actorUserId: string;
    formData: FormData;
};

type ResolvePostingEntityParams = {
    userId: string;
    formData: FormData;
};

type ValidParsedTransaction = {
    kind: TransactionKind;
    postedAt: Date;
    amountPhp: number;
    walletAccountId: string | null;
    budgetEnvelopeId: string | null;
    targetWalletAccountId: string | null;
    incomeStreamId: string | null;
    loanRecordId: string | null;
    remarks: string | null;
    recordOnly: boolean;
};

const resolveSourceWalletAccountId = async (
    userId: string,
    entityId: string,
    walletAccountId: string,
) => {
    if (!walletAccountId.startsWith("credit:")) {
        return walletAccountId;
    }

    const creditId = walletAccountId.slice("credit:".length);
    const creditAccount = await requireOwnedCreditAccount(prisma, userId, entityId, creditId);

    const existingCreditWallet = await prisma.walletAccount.findFirst({
        where: {
            userId,
            entityId,
            isArchived: false,
            type: WalletAccountType.CREDIT_CARD,
            name: creditAccount.name,
        },
        select: {
            id: true,
        },
    });

    if (existingCreditWallet) {
        return existingCreditWallet.id;
    }

    const createdWallet = await prisma.walletAccount.create({
        data: {
            userId,
            entityId,
            name: creditAccount.name,
            type: WalletAccountType.CREDIT_CARD,
            currentBalanceAmount: new Prisma.Decimal(0),
        },
        select: {
            id: true,
        },
    });

    return createdWallet.id;
};

const parseAndValidateBaseTransaction = (formData: FormData): ValidParsedTransaction => {
    const parsed = parseTransactionForm(formData);
    if (
        !parsed.ok
        || !parsed.kind
        || !parsed.postedAt
        || parsed.amountPhp === null
        || (parsed.kind !== TransactionKind.BUDGET_ALLOCATION && !parsed.walletAccountId)
    ) {
        throw new Error("Please provide valid transaction details.");
    }

    return {
        kind: parsed.kind,
        postedAt: parsed.postedAt,
        amountPhp: parsed.amountPhp,
        walletAccountId: parsed.walletAccountId,
        budgetEnvelopeId: parsed.budgetEnvelopeId ?? null,
        targetWalletAccountId: parsed.targetWalletAccountId ?? null,
        incomeStreamId: parsed.incomeStreamId ?? null,
        loanRecordId: parsed.loanRecordId ?? null,
        remarks: parsed.remarks ?? null,
        recordOnly: parsed.recordOnly,
    };
};

export const resolvePostingEntityIdFromFormData = async (
    params: ResolvePostingEntityParams,
): Promise<FinanceActionResult & { entityId?: string }> => {
    const walletAccountId = typeof params.formData.get("walletAccountId") === "string"
        ? String(params.formData.get("walletAccountId")).trim()
        : "";
    const kind = typeof params.formData.get("kind") === "string"
        ? String(params.formData.get("kind")).trim()
        : "";

    if (!walletAccountId) {
        if (kind === TransactionKind.BUDGET_ALLOCATION) {
            const budgetEnvelopeId = typeof params.formData.get("budgetEnvelopeId") === "string"
                ? String(params.formData.get("budgetEnvelopeId")).trim()
                : "";
            if (!budgetEnvelopeId) {
                return { ok: false, message: "Missing budget envelope." };
            }

            try {
                const entityId = await resolveBudgetAllocationEnvelopeEntityId(params.userId, budgetEnvelopeId);
                return {
                    ok: true,
                    message: "Entity resolved.",
                    entityId,
                };
            } catch (error) {
                return {
                    ok: false,
                    message: error instanceof Error ? error.message : "Budget envelope not found.",
                };
            }
        }
        return { ok: false, message: "Missing wallet account." };
    }

    if (walletAccountId.startsWith("credit:")) {
        const creditId = walletAccountId.slice("credit:".length);
        const creditAccount = await prisma.creditAccount.findFirst({
            where: {
                id: creditId,
                userId: params.userId,
                isArchived: false,
                entity: {
                    isArchived: false,
                },
            },
            select: {
                entityId: true,
            },
        });
        if (!creditAccount?.entityId) {
            return { ok: false, message: "Credit account not found." };
        }
        return {
            ok: true,
            message: "Entity resolved.",
            entityId: creditAccount.entityId,
        };
    }

    const wallet = await prisma.walletAccount.findFirst({
        where: {
            id: walletAccountId,
            userId: params.userId,
            isArchived: false,
            entity: {
                isArchived: false,
            },
        },
        select: {
            entityId: true,
        },
    });
    if (!wallet?.entityId) {
        return { ok: false, message: "Wallet account not found." };
    }

    return {
        ok: true,
        message: "Entity resolved.",
        entityId: wallet.entityId,
    };
};

export const postTransactionFromFormData = async (
    params: TransactionOrchestrationParams,
): Promise<FinanceActionResult> => {
    try {
        const parsed = parseAndValidateBaseTransaction(params.formData);
        const sourceWalletAccountId = parsed.walletAccountId
            ? await resolveSourceWalletAccountId(
                params.userId,
                params.entityId,
                parsed.walletAccountId,
            )
            : await resolveFundingWalletAccountIdForBudgetAllocation(params.userId, params.entityId);

        if (parsed.kind === TransactionKind.INCOME && !parsed.recordOnly) {
            const distribution = parseIncomeDistributionForm(params.formData);
            if (!distribution.ok) {
                return {
                    ok: false,
                    message: "Income distribution is invalid. Please provide unique budgets and valid amounts.",
                };
            }

            if (Math.abs(distribution.totalAmountPhp - parsed.amountPhp) > 0.009) {
                return {
                    ok: false,
                    message: "Income distribution total must match the income amount.",
                };
            }

            await postFinanceTransactionsBatch(
                distribution.rows.map((row) => ({
                    userId: params.userId,
                    entityId: params.entityId,
                    actorUserId: params.actorUserId,
                    kind: parsed.kind,
                    recordOnly: parsed.recordOnly,
                    postedAt: parsed.postedAt,
                    amountPhp: row.amountPhp,
                    walletAccountId: sourceWalletAccountId,
                    budgetEnvelopeId: row.budgetEnvelopeId,
                    targetWalletAccountId: parsed.targetWalletAccountId,
                    incomeStreamId: parsed.incomeStreamId,
                    loanRecordId: parsed.loanRecordId,
                    remarks: parsed.remarks,
                })),
            );
        } else if (parsed.kind === TransactionKind.BUDGET_ALLOCATION && parsed.budgetEnvelopeId) {
            const { transactions } = await resolveBudgetAllocationTransactions({
                userId: params.userId,
                entityId: params.entityId,
                actorUserId: params.actorUserId,
                postedAt: parsed.postedAt,
                requestedAmountPhp: parsed.amountPhp,
                walletAccountId: sourceWalletAccountId,
                budgetEnvelopeId: parsed.budgetEnvelopeId,
                remarks: parsed.remarks,
                recordOnly: parsed.recordOnly,
            });
            await postFinanceTransactionsBatch(transactions);
        } else {
            await postFinanceTransaction({
                userId: params.userId,
                entityId: params.entityId,
                actorUserId: params.actorUserId,
                kind: parsed.kind,
                recordOnly: parsed.recordOnly,
                postedAt: parsed.postedAt,
                amountPhp: parsed.amountPhp,
                walletAccountId: sourceWalletAccountId,
                budgetEnvelopeId: parsed.budgetEnvelopeId,
                targetWalletAccountId: parsed.targetWalletAccountId,
                incomeStreamId: parsed.incomeStreamId,
                loanRecordId: parsed.loanRecordId,
                remarks: parsed.remarks,
            });
        }
    } catch (error) {
        return {
            ok: false,
            message: error instanceof Error ? error.message : "Could not post transaction.",
        };
    }

    return {
        ok: true,
        message: "Transaction posted successfully.",
    };
};

export const updateTransactionFromFormData = async (
    params: TransactionOrchestrationParams & {
        transactionId: string;
        fallbackRecordOnly?: boolean;
    },
): Promise<FinanceActionResult> => {
    const createdTransactionIds: string[] = [];

    try {
        const parsed = parseAndValidateBaseTransaction(params.formData);
        const sourceWalletAccountId = parsed.walletAccountId
            ? await resolveSourceWalletAccountId(
                params.userId,
                params.entityId,
                parsed.walletAccountId,
            )
            : await resolveFundingWalletAccountIdForBudgetAllocation(params.userId, params.entityId);
        const effectiveRecordOnly = parsed.recordOnly || params.fallbackRecordOnly;

        if (parsed.kind === TransactionKind.BUDGET_ALLOCATION && parsed.budgetEnvelopeId) {
            const { transactions } = await resolveBudgetAllocationTransactions({
                userId: params.userId,
                entityId: params.entityId,
                actorUserId: params.actorUserId,
                postedAt: parsed.postedAt,
                requestedAmountPhp: parsed.amountPhp,
                walletAccountId: sourceWalletAccountId,
                budgetEnvelopeId: parsed.budgetEnvelopeId,
                remarks: parsed.remarks,
                recordOnly: effectiveRecordOnly,
            });
            const createdRows = await postFinanceTransactionsBatch(transactions);
            createdTransactionIds.push(...createdRows.map((row) => row.id));
        } else {
            const created = await postFinanceTransaction({
                userId: params.userId,
                entityId: params.entityId,
                actorUserId: params.actorUserId,
                kind: parsed.kind,
                recordOnly: effectiveRecordOnly,
                postedAt: parsed.postedAt,
                amountPhp: parsed.amountPhp,
                walletAccountId: sourceWalletAccountId,
                budgetEnvelopeId: parsed.budgetEnvelopeId,
                targetWalletAccountId: parsed.targetWalletAccountId,
                incomeStreamId: parsed.incomeStreamId,
                loanRecordId: parsed.loanRecordId,
                remarks: parsed.remarks,
            });
            createdTransactionIds.push(created.id);
        }

        await deleteFinanceTransactionWithReversal(
            params.userId,
            params.entityId,
            params.actorUserId,
            params.transactionId,
        );
    } catch (error) {
        if (createdTransactionIds.length > 0) {
            try {
                for (const createdId of createdTransactionIds.reverse()) {
                    await deleteFinanceTransactionWithReversal(
                        params.userId,
                        params.entityId,
                        params.actorUserId,
                        createdId,
                    );
                }
            } catch {
                return {
                    ok: false,
                    message: "Update failed and could not fully roll back. Please review balances.",
                };
            }
        }

        return {
            ok: false,
            message: error instanceof Error ? error.message : "Could not update transaction.",
        };
    }

    return {
        ok: true,
        message: "Transaction updated successfully.",
    };
};
