import {
    type BudgetEnvelope,
    type LoanRecord,
    LoanStatus,
    Prisma,
    TransactionKind,
    WalletAccountType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SYSTEM_ENVELOPES } from "@/lib/finance/constants";
import { isRecordOnlyTransaction, type TransactionFormInput } from "@/lib/finance/types";

type TxClient = Prisma.TransactionClient;

type PostTransactionParams = Omit<TransactionFormInput, "kind"> & {
    userId: string;
    entityId: string;
    kind: TransactionKind;
    recordOnly?: boolean;
};

const ensureOwnedWallet = async (tx: TxClient, userId: string, entityId: string, walletId: string) => {
    const wallet = await tx.walletAccount.findFirst({
        where: {
            id: walletId,
            userId,
            entityId,
            isArchived: false,
        },
    });

    if (!wallet) {
        throw new Error("Wallet account not found.");
    }

    return wallet;
};

const ensureOwnedEnvelope = async (
    tx: TxClient,
    userId: string,
    entityId: string,
    envelopeId: string,
    includeArchived = false,
) => {
    const envelope = await tx.budgetEnvelope.findFirst({
        where: {
            id: envelopeId,
            userId,
            entityId,
            ...(includeArchived ? {} : { isArchived: false }),
        },
    });

    if (!envelope) {
        throw new Error("Budget envelope not found.");
    }

    return envelope;
};

const ensureOwnedLoan = async (tx: TxClient, userId: string, entityId: string, loanId: string) => {
    const loan = await tx.loanRecord.findFirst({
        where: {
            id: loanId,
            userId,
            entityId,
        },
    });

    if (!loan) {
        throw new Error("Loan record not found.");
    }

    return loan;
};

const ensureOwnedIncomeStream = async (tx: TxClient, userId: string, entityId: string, incomeStreamId: string) => {
    const incomeStream = await tx.incomeStream.findFirst({
        where: {
            id: incomeStreamId,
            userId,
            entityId,
        },
    });

    if (!incomeStream) {
        throw new Error("Income stream not found.");
    }

    return incomeStream;
};

const updateWalletBalance = async (tx: TxClient, walletId: string, delta: Prisma.Decimal) => {
    await tx.walletAccount.update({
        where: { id: walletId },
        data: {
            currentBalanceAmount: {
                increment: delta,
            },
        },
    });
};

const updateEnvelopeBalance = async (tx: TxClient, envelopeId: string, delta: Prisma.Decimal) => {
    await tx.budgetEnvelope.update({
        where: { id: envelopeId },
        data: {
            availablePhp: {
                increment: delta,
            },
        },
    });
};

const updateLoanForRepayment = async (tx: TxClient, loan: LoanRecord, amount: Prisma.Decimal) => {
    const nextPaid = new Prisma.Decimal(loan.paidToDatePhp).add(amount);
    const nextRemaining = new Prisma.Decimal(loan.remainingPhp).sub(amount);
    const normalizedRemaining = nextRemaining.lt(0) ? new Prisma.Decimal(0) : nextRemaining;

    await tx.loanRecord.update({
        where: { id: loan.id },
        data: {
            paidToDatePhp: nextPaid,
            remainingPhp: normalizedRemaining,
            status: normalizedRemaining.eq(0) ? LoanStatus.PAID : loan.status,
        },
    });
};

const updateLoanForBorrow = async (tx: TxClient, loan: LoanRecord, amount: Prisma.Decimal) => {
    const nextRemaining = new Prisma.Decimal(loan.remainingPhp).add(amount);
    await tx.loanRecord.update({
        where: { id: loan.id },
        data: {
            remainingPhp: nextRemaining,
            status: LoanStatus.ACTIVE,
        },
    });
};

const ensureSystemEnvelope = async (
    tx: TxClient,
    userId: string,
    entityId: string,
    name: string,
): Promise<BudgetEnvelope> => {
    const existing = await tx.budgetEnvelope.findFirst({
        where: {
            userId,
            entityId,
            name,
            isSystem: true,
            isArchived: false,
        },
    });

    if (existing) {
        return existing;
    }

    return tx.budgetEnvelope.create({
        data: {
            userId,
            entityId,
            name,
            isSystem: true,
            isArchived: false,
            monthlyTargetPhp: 0,
            availablePhp: 0,
            rolloverEnabled: true,
            sortOrder: 9999,
            remarks: "Auto-created system envelope for transaction accounting.",
        },
    });
};

const resolveBudgetEnvelope = async (
    tx: TxClient,
    userId: string,
    entityId: string,
    kind: TransactionKind,
    budgetEnvelopeId: string | null | undefined,
) => {
    if (kind === TransactionKind.TRANSFER) {
        return ensureSystemEnvelope(tx, userId, entityId, SYSTEM_ENVELOPES.transfer);
    }
    if (kind === TransactionKind.CREDIT_CARD_PAYMENT) {
        return ensureSystemEnvelope(tx, userId, entityId, SYSTEM_ENVELOPES.creditPayment);
    }
    if (kind === TransactionKind.LOAN_BORROW) {
        return ensureSystemEnvelope(tx, userId, entityId, SYSTEM_ENVELOPES.loanInflow);
    }
    if (kind === TransactionKind.LOAN_REPAY) {
        return ensureSystemEnvelope(tx, userId, entityId, SYSTEM_ENVELOPES.loanPayment);
    }
    if (!budgetEnvelopeId) {
        return null;
    }
    return ensureOwnedEnvelope(tx, userId, entityId, budgetEnvelopeId);
};

const resolveCountsTowardBudget = (kind: TransactionKind) => {
    return !(
        kind === TransactionKind.TRANSFER
        || kind === TransactionKind.CREDIT_CARD_PAYMENT
        || kind === TransactionKind.LOAN_REPAY
    );
};

const ensureEntityId = (entityId: string | null | undefined) => {
    if (!entityId || entityId.trim().length === 0) {
        throw new Error("entityId is required.");
    }
    return entityId;
};

export const postFinanceTransaction = async (params: PostTransactionParams) => {
    const entityId = ensureEntityId(params.entityId);

    if (!params.walletAccountId) {
        throw new Error("Wallet account is required.");
    }
    if (!Number.isFinite(params.amountPhp) || params.amountPhp <= 0) {
        throw new Error("Amount must be greater than 0.");
    }

    return prisma.$transaction(async (tx) => {
        const amount = new Prisma.Decimal(params.amountPhp);
        const negativeAmount = amount.mul(-1);
        const sourceWallet = await ensureOwnedWallet(tx, params.userId, entityId, params.walletAccountId);

        if (params.recordOnly) {
            const budgetEnvelope = params.budgetEnvelopeId
                ? await ensureOwnedEnvelope(tx, params.userId, entityId, params.budgetEnvelopeId)
                : null;
            const incomeStream = params.incomeStreamId
                ? await ensureOwnedIncomeStream(tx, params.userId, entityId, params.incomeStreamId)
                : null;

            return tx.financeTransaction.create({
                data: {
                    userId: params.userId,
                    entityId,
                    postedAt: params.postedAt ?? new Date(),
                    kind: params.kind,
                    amountPhp: amount,
                    walletAccountId: sourceWallet.id,
                    targetWalletAccountId: null,
                    budgetEnvelopeId: budgetEnvelope?.id ?? null,
                    incomeStreamId: incomeStream?.id ?? null,
                    loanRecordId: null,
                    countsTowardBudget: false,
                    remarks: params.remarks?.trim() || null,
                },
            });
        }

        const targetWallet = params.targetWalletAccountId
            ? await ensureOwnedWallet(tx, params.userId, entityId, params.targetWalletAccountId)
            : null;
        const budgetEnvelope = await resolveBudgetEnvelope(tx, params.userId, entityId, params.kind, params.budgetEnvelopeId);
        const loan = params.loanRecordId
            ? await ensureOwnedLoan(tx, params.userId, entityId, params.loanRecordId)
            : null;
        const incomeStream = params.incomeStreamId
            ? await ensureOwnedIncomeStream(tx, params.userId, entityId, params.incomeStreamId)
            : null;

        if (
            (params.kind === TransactionKind.INCOME
                || params.kind === TransactionKind.EXPENSE
                || params.kind === TransactionKind.BUDGET_ALLOCATION
                || params.kind === TransactionKind.CREDIT_CARD_CHARGE)
            && !budgetEnvelope
        ) {
            throw new Error("Budget envelope is required.");
        }

        if (params.kind === TransactionKind.TRANSFER && !targetWallet) {
            throw new Error("Target wallet is required for transfers.");
        }

        if (params.kind === TransactionKind.CREDIT_CARD_PAYMENT && !targetWallet) {
            throw new Error("Credit card wallet is required for payment.");
        }

        if (
            (params.kind === TransactionKind.CREDIT_CARD_CHARGE || params.kind === TransactionKind.CREDIT_CARD_PAYMENT)
            && sourceWallet.type !== WalletAccountType.CREDIT_CARD
            && (!targetWallet || targetWallet.type !== WalletAccountType.CREDIT_CARD)
        ) {
            throw new Error("Credit card transactions require a credit card wallet.");
        }

        if ((params.kind === TransactionKind.LOAN_BORROW || params.kind === TransactionKind.LOAN_REPAY) && !loan) {
            throw new Error("Loan record is required for this transaction.");
        }

        switch (params.kind) {
            case TransactionKind.INCOME:
                await updateWalletBalance(tx, sourceWallet.id, amount);
                await updateEnvelopeBalance(tx, budgetEnvelope!.id, amount);
                break;
            case TransactionKind.EXPENSE:
                await updateWalletBalance(tx, sourceWallet.id, negativeAmount);
                await updateEnvelopeBalance(tx, budgetEnvelope!.id, negativeAmount);
                break;
            case TransactionKind.BUDGET_ALLOCATION:
                await updateWalletBalance(tx, sourceWallet.id, negativeAmount);
                await updateEnvelopeBalance(tx, budgetEnvelope!.id, amount);
                break;
            case TransactionKind.TRANSFER:
                await updateWalletBalance(tx, sourceWallet.id, negativeAmount);
                await updateWalletBalance(tx, targetWallet!.id, amount);
                break;
            case TransactionKind.CREDIT_CARD_CHARGE:
                await updateWalletBalance(tx, sourceWallet.id, amount);
                await updateEnvelopeBalance(tx, budgetEnvelope!.id, negativeAmount);
                break;
            case TransactionKind.CREDIT_CARD_PAYMENT: {
                const creditWallet = sourceWallet.type === WalletAccountType.CREDIT_CARD ? sourceWallet : targetWallet!;
                const cashWallet = sourceWallet.type === WalletAccountType.CREDIT_CARD ? targetWallet! : sourceWallet;
                await updateWalletBalance(tx, cashWallet.id, negativeAmount);
                await updateWalletBalance(tx, creditWallet.id, negativeAmount);
                break;
            }
            case TransactionKind.LOAN_BORROW:
                await updateWalletBalance(tx, sourceWallet.id, amount);
                await updateLoanForBorrow(tx, loan!, amount);
                break;
            case TransactionKind.LOAN_REPAY:
                await updateWalletBalance(tx, sourceWallet.id, negativeAmount);
                await updateLoanForRepayment(tx, loan!, amount);
                break;
            case TransactionKind.ADJUSTMENT:
                await updateWalletBalance(tx, sourceWallet.id, amount);
                break;
            default:
                throw new Error("Unsupported transaction kind.");
        }

        return tx.financeTransaction.create({
            data: {
                userId: params.userId,
                entityId,
                postedAt: params.postedAt ?? new Date(),
                kind: params.kind,
                amountPhp: amount,
                walletAccountId: sourceWallet.id,
                targetWalletAccountId: targetWallet?.id ?? null,
                budgetEnvelopeId: budgetEnvelope?.id ?? null,
                incomeStreamId: incomeStream?.id ?? null,
                loanRecordId: loan?.id ?? null,
                countsTowardBudget: resolveCountsTowardBudget(params.kind),
                remarks: params.remarks?.trim() || null,
            },
        });
    });
};

export const deleteFinanceTransactionWithReversal = async (
    userId: string,
    entityId: string,
    transactionId: string,
) => {
    return prisma.$transaction(async (tx) => {
        const transaction = await tx.financeTransaction.findFirst({
            where: {
                id: transactionId,
                userId,
                entityId,
            },
            include: {
                loanRecord: true,
            },
        });

        if (!transaction) {
            throw new Error("Transaction not found.");
        }

        if (isRecordOnlyTransaction(transaction)) {
            await tx.financeTransaction.delete({
                where: { id: transaction.id },
            });
            return;
        }

        const amount = new Prisma.Decimal(transaction.amountPhp);
        const negativeAmount = amount.mul(-1);

        switch (transaction.kind) {
            case TransactionKind.INCOME:
                await updateWalletBalance(tx, transaction.walletAccountId, negativeAmount);
                if (transaction.budgetEnvelopeId) {
                    await updateEnvelopeBalance(tx, transaction.budgetEnvelopeId, negativeAmount);
                }
                break;
            case TransactionKind.EXPENSE:
                await updateWalletBalance(tx, transaction.walletAccountId, amount);
                if (transaction.budgetEnvelopeId) {
                    await updateEnvelopeBalance(tx, transaction.budgetEnvelopeId, amount);
                }
                break;
            case TransactionKind.BUDGET_ALLOCATION:
                await updateWalletBalance(tx, transaction.walletAccountId, amount);
                if (transaction.budgetEnvelopeId) {
                    await updateEnvelopeBalance(tx, transaction.budgetEnvelopeId, negativeAmount);
                }
                break;
            case TransactionKind.TRANSFER:
                await updateWalletBalance(tx, transaction.walletAccountId, amount);
                if (transaction.targetWalletAccountId) {
                    await updateWalletBalance(tx, transaction.targetWalletAccountId, negativeAmount);
                }
                break;
            case TransactionKind.CREDIT_CARD_CHARGE:
                await updateWalletBalance(tx, transaction.walletAccountId, negativeAmount);
                if (transaction.budgetEnvelopeId) {
                    await updateEnvelopeBalance(tx, transaction.budgetEnvelopeId, amount);
                }
                break;
            case TransactionKind.CREDIT_CARD_PAYMENT:
                await updateWalletBalance(tx, transaction.walletAccountId, amount);
                if (transaction.targetWalletAccountId) {
                    await updateWalletBalance(tx, transaction.targetWalletAccountId, amount);
                }
                break;
            case TransactionKind.LOAN_BORROW:
                await updateWalletBalance(tx, transaction.walletAccountId, negativeAmount);
                if (transaction.loanRecordId && transaction.loanRecord) {
                    const nextRemaining = new Prisma.Decimal(transaction.loanRecord.remainingPhp).sub(amount);
                    await tx.loanRecord.update({
                        where: { id: transaction.loanRecordId },
                        data: {
                            remainingPhp: nextRemaining.lt(0) ? new Prisma.Decimal(0) : nextRemaining,
                            status: nextRemaining.lte(0) ? LoanStatus.PAID : LoanStatus.ACTIVE,
                        },
                    });
                }
                break;
            case TransactionKind.LOAN_REPAY:
                await updateWalletBalance(tx, transaction.walletAccountId, amount);
                if (transaction.loanRecordId && transaction.loanRecord) {
                    const nextPaid = new Prisma.Decimal(transaction.loanRecord.paidToDatePhp).sub(amount);
                    const nextRemaining = new Prisma.Decimal(transaction.loanRecord.remainingPhp).add(amount);
                    await tx.loanRecord.update({
                        where: { id: transaction.loanRecordId },
                        data: {
                            paidToDatePhp: nextPaid.lt(0) ? new Prisma.Decimal(0) : nextPaid,
                            remainingPhp: nextRemaining,
                            status: LoanStatus.ACTIVE,
                        },
                    });
                }
                break;
            case TransactionKind.ADJUSTMENT:
                await updateWalletBalance(tx, transaction.walletAccountId, negativeAmount);
                break;
            default:
                throw new Error("Unsupported transaction kind.");
        }

        await tx.financeTransaction.delete({
            where: { id: transaction.id },
        });
    });
};
