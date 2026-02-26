import { Prisma, TransactionKind, WalletAccountType } from "@prisma/client";
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

type ValidParsedTransaction = {
    kind: TransactionKind;
    postedAt: Date;
    amountPhp: number;
    walletAccountId: string;
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
        || !parsed.walletAccountId
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

export const postTransactionFromFormData = async (
    params: TransactionOrchestrationParams,
): Promise<FinanceActionResult> => {
    try {
        const parsed = parseAndValidateBaseTransaction(params.formData);
        const sourceWalletAccountId = await resolveSourceWalletAccountId(
            params.userId,
            params.entityId,
            parsed.walletAccountId,
        );

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
    let createdTransactionId: string | null = null;

    try {
        const parsed = parseAndValidateBaseTransaction(params.formData);
        const sourceWalletAccountId = await resolveSourceWalletAccountId(
            params.userId,
            params.entityId,
            parsed.walletAccountId,
        );

        const created = await postFinanceTransaction({
            userId: params.userId,
            entityId: params.entityId,
            actorUserId: params.actorUserId,
            kind: parsed.kind,
            recordOnly: parsed.recordOnly || params.fallbackRecordOnly,
            postedAt: parsed.postedAt,
            amountPhp: parsed.amountPhp,
            walletAccountId: sourceWalletAccountId,
            budgetEnvelopeId: parsed.budgetEnvelopeId,
            targetWalletAccountId: parsed.targetWalletAccountId,
            incomeStreamId: parsed.incomeStreamId,
            loanRecordId: parsed.loanRecordId,
            remarks: parsed.remarks,
        });
        createdTransactionId = created.id;

        await deleteFinanceTransactionWithReversal(
            params.userId,
            params.entityId,
            params.actorUserId,
            params.transactionId,
        );
    } catch (error) {
        if (createdTransactionId) {
            try {
                await deleteFinanceTransactionWithReversal(
                    params.userId,
                    params.entityId,
                    params.actorUserId,
                    createdTransactionId,
                );
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
