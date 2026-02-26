import {
    AdjustmentReasonCode,
    BudgetEnvelopeSystemType,
    type BudgetEnvelope,
    type LoanRecord,
    LoanStatus,
    Prisma,
    TransactionKind,
    WalletAccountType,
} from "@prisma/client";
import { ensureCreditCardPaymentEnvelopeForWallet } from "@/lib/finance/credit-payment-envelope";
import { prisma } from "@/lib/prisma";
import { SYSTEM_ENVELOPES } from "@/lib/finance/constants";
import { isRecordOnlyTransaction, type TransactionFormInput } from "@/lib/finance/types";

type TxClient = Prisma.TransactionClient;

type PostTransactionParams = Omit<TransactionFormInput, "kind"> & {
    userId: string;
    entityId: string;
    actorUserId: string;
    kind: TransactionKind;
    recordOnly?: boolean;
    adjustmentReasonCode?: AdjustmentReasonCode | null;
    ccPaymentEnvelopeId?: string | null;
};

type PostOptions = {
    reverse?: boolean;
    reversedTransactionId?: string;
    includeArchivedReferences?: boolean;
};

type ResolvedPostingContext = {
    sourceWallet: {
        id: string;
        type: WalletAccountType;
        name: string;
        currentBalanceAmount: Prisma.Decimal;
    };
    targetWallet: {
        id: string;
        type: WalletAccountType;
        name: string;
        currentBalanceAmount: Prisma.Decimal;
    } | null;
    budgetEnvelope: {
        id: string;
        availablePhp: Prisma.Decimal;
    } | null;
    ccPaymentEnvelope: {
        id: string;
        availablePhp: Prisma.Decimal;
    } | null;
    loan: LoanRecord | null;
    incomeStreamId: string | null;
};

const transactionRules: Record<TransactionKind, {
    requiresBudget: boolean;
    requiresTargetWallet: boolean;
    requiresLoan: boolean;
    supportsRecordOnly: boolean;
}> = {
    INCOME: { requiresBudget: true, requiresTargetWallet: false, requiresLoan: false, supportsRecordOnly: true },
    EXPENSE: { requiresBudget: true, requiresTargetWallet: false, requiresLoan: false, supportsRecordOnly: true },
    BUDGET_ALLOCATION: { requiresBudget: true, requiresTargetWallet: false, requiresLoan: false, supportsRecordOnly: true },
    TRANSFER: { requiresBudget: false, requiresTargetWallet: true, requiresLoan: false, supportsRecordOnly: false },
    CREDIT_CARD_CHARGE: { requiresBudget: true, requiresTargetWallet: false, requiresLoan: false, supportsRecordOnly: true },
    CREDIT_CARD_PAYMENT: { requiresBudget: false, requiresTargetWallet: true, requiresLoan: false, supportsRecordOnly: false },
    LOAN_BORROW: { requiresBudget: false, requiresTargetWallet: false, requiresLoan: true, supportsRecordOnly: false },
    LOAN_REPAY: { requiresBudget: false, requiresTargetWallet: false, requiresLoan: true, supportsRecordOnly: false },
    ADJUSTMENT: { requiresBudget: false, requiresTargetWallet: false, requiresLoan: false, supportsRecordOnly: true },
};

const ensureEntityId = (entityId: string | null | undefined) => {
    if (!entityId || entityId.trim().length === 0) {
        throw new Error("entityId is required.");
    }
    return entityId;
};

const ensureActorUserId = (actorUserId: string | null | undefined) => {
    if (!actorUserId || actorUserId.trim().length === 0) {
        throw new Error("actorUserId is required.");
    }
    return actorUserId;
};

const normalizeRemarks = (remarks: string | null | undefined) => {
    const normalized = remarks?.trim() ?? "";
    return normalized.length > 0 ? normalized : null;
};

const ensureOwnedWallet = async (
    tx: TxClient,
    userId: string,
    entityId: string,
    walletId: string,
    includeArchived = false,
) => {
    const wallet = await tx.walletAccount.findFirst({
        where: {
            id: walletId,
            userId,
            entityId,
            ...(includeArchived ? {} : { isArchived: false }),
        },
        select: {
            id: true,
            type: true,
            name: true,
            currentBalanceAmount: true,
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
        select: {
            id: true,
            availablePhp: true,
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
        select: {
            id: true,
        },
    });

    if (!incomeStream) {
        throw new Error("Income stream not found.");
    }

    return incomeStream;
};

const ensureSystemEnvelope = async (
    tx: TxClient,
    userId: string,
    entityId: string,
    name: string,
): Promise<BudgetEnvelope> => {
    const systemTypeByName: Record<string, BudgetEnvelopeSystemType> = {
        [SYSTEM_ENVELOPES.transfer]: BudgetEnvelopeSystemType.TRANSFER,
        [SYSTEM_ENVELOPES.loanInflow]: BudgetEnvelopeSystemType.LOAN_INFLOW,
        [SYSTEM_ENVELOPES.loanPayment]: BudgetEnvelopeSystemType.LOAN_PAYMENT,
    };
    const systemType = systemTypeByName[name];
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
        if (existing.systemType !== systemType) {
            return tx.budgetEnvelope.update({
                where: { id: existing.id },
                data: {
                    systemType,
                },
            });
        }
        return existing;
    }

    return tx.budgetEnvelope.create({
        data: {
            userId,
            entityId,
            name,
            isSystem: true,
            systemType,
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
    includeArchived = false,
) => {
    if (kind === TransactionKind.TRANSFER) {
        return ensureSystemEnvelope(tx, userId, entityId, SYSTEM_ENVELOPES.transfer);
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

    return ensureOwnedEnvelope(tx, userId, entityId, budgetEnvelopeId, includeArchived);
};

const ensureOwnedCcPaymentEnvelope = async (
    tx: TxClient,
    userId: string,
    entityId: string,
    ccPaymentEnvelopeId: string,
    includeArchived = false,
) => {
    const envelope = await tx.budgetEnvelope.findFirst({
        where: {
            id: ccPaymentEnvelopeId,
            userId,
            entityId,
            isSystem: true,
            systemType: BudgetEnvelopeSystemType.CREDIT_CARD_PAYMENT,
            ...(includeArchived ? {} : { isArchived: false }),
        },
        select: {
            id: true,
            availablePhp: true,
        },
    });

    if (!envelope) {
        throw new Error("Credit card payment envelope not found.");
    }

    return envelope;
};

const resolveCreditWallet = (
    kind: TransactionKind,
    sourceWallet: ResolvedPostingContext["sourceWallet"],
    targetWallet: ResolvedPostingContext["targetWallet"],
) => {
    if (kind === TransactionKind.CREDIT_CARD_CHARGE) {
        if (sourceWallet.type !== WalletAccountType.CREDIT_CARD) {
            throw new Error("Credit card charge must use a credit card wallet.");
        }
        return sourceWallet;
    }

    if (kind === TransactionKind.CREDIT_CARD_PAYMENT) {
        if (!targetWallet) {
            throw new Error("Credit card wallet is required for payment.");
        }

        const sourceIsCredit = sourceWallet.type === WalletAccountType.CREDIT_CARD;
        const targetIsCredit = targetWallet.type === WalletAccountType.CREDIT_CARD;
        if (!sourceIsCredit && !targetIsCredit) {
            throw new Error("Credit card payment requires one credit card wallet.");
        }
        return sourceIsCredit ? sourceWallet : targetWallet;
    }

    return null;
};

const resolveCreditCardPaymentEnvelope = async (
    tx: TxClient,
    params: PostTransactionParams,
    context: Pick<ResolvedPostingContext, "sourceWallet" | "targetWallet">,
    includeArchived = false,
) => {
    if (
        params.kind !== TransactionKind.CREDIT_CARD_CHARGE
        && params.kind !== TransactionKind.CREDIT_CARD_PAYMENT
    ) {
        return null;
    }

    if (params.ccPaymentEnvelopeId) {
        return ensureOwnedCcPaymentEnvelope(
            tx,
            params.userId,
            params.entityId,
            params.ccPaymentEnvelopeId,
            includeArchived,
        );
    }

    const creditWallet = resolveCreditWallet(params.kind, context.sourceWallet, context.targetWallet);
    if (!creditWallet) {
        return null;
    }

    const envelope = await ensureCreditCardPaymentEnvelopeForWallet(tx, {
        id: creditWallet.id,
        userId: params.userId,
        entityId: params.entityId,
        type: creditWallet.type,
        name: creditWallet.name,
    });

    return {
        id: envelope.id,
        availablePhp: envelope.availablePhp,
    };
};

const resolveCountsTowardBudget = (kind: TransactionKind) => {
    return !(
        kind === TransactionKind.TRANSFER
        || kind === TransactionKind.CREDIT_CARD_PAYMENT
        || kind === TransactionKind.LOAN_REPAY
    );
};

const toDecimal = (value: number) => new Prisma.Decimal(value);

const decimalAbs = (value: Prisma.Decimal) => (value.lt(0) ? value.mul(-1) : value);

const assertNoNegativeForNonAdjustment = (kind: TransactionKind, amount: number) => {
    if (kind !== TransactionKind.ADJUSTMENT && amount <= 0) {
        throw new Error("Amount must be greater than 0.");
    }
    if (kind === TransactionKind.ADJUSTMENT && amount === 0) {
        throw new Error("Adjustment amount must not be 0.");
    }
};

const assertWalletCanDecrease = (
    wallet: { currentBalanceAmount: Prisma.Decimal; type: WalletAccountType },
    amount: Prisma.Decimal,
    message: string,
) => {
    if (wallet.type === WalletAccountType.CREDIT_CARD) {
        return;
    }
    if (new Prisma.Decimal(wallet.currentBalanceAmount).lt(amount)) {
        throw new Error(message);
    }
};

const assertEnvelopeCanDecrease = (
    envelope: { availablePhp: Prisma.Decimal },
    amount: Prisma.Decimal,
    message: string,
) => {
    if (new Prisma.Decimal(envelope.availablePhp).lt(amount)) {
        throw new Error(message);
    }
};

const syncCreditAccountBalance = async (
    tx: TxClient,
    userId: string,
    entityId: string,
    walletName: string,
    nextBalance: Prisma.Decimal,
) => {
    await tx.creditAccount.updateMany({
        where: {
            userId,
            entityId,
            isArchived: false,
            name: walletName,
        },
        data: {
            currentBalanceAmount: nextBalance,
        },
    });
};

const updateWalletBalance = async (
    tx: TxClient,
    userId: string,
    entityId: string,
    wallet: { id: string; type: WalletAccountType; name: string },
    delta: Prisma.Decimal,
) => {
    const updated = await tx.walletAccount.update({
        where: { id: wallet.id },
        data: {
            currentBalanceAmount: {
                increment: delta,
            },
        },
        select: {
            id: true,
            currentBalanceAmount: true,
            type: true,
            name: true,
        },
    });

    if (updated.type === WalletAccountType.CREDIT_CARD) {
        await syncCreditAccountBalance(tx, userId, entityId, updated.name, updated.currentBalanceAmount);
    }

    return updated;
};

const updateEnvelopeBalance = async (tx: TxClient, envelopeId: string, delta: Prisma.Decimal) => {
    return tx.budgetEnvelope.update({
        where: { id: envelopeId },
        data: {
            availablePhp: {
                increment: delta,
            },
        },
        select: {
            id: true,
            availablePhp: true,
        },
    });
};

const updateLoan = async (
    tx: TxClient,
    loan: LoanRecord,
    remainingDelta: Prisma.Decimal,
    paidDelta: Prisma.Decimal,
) => {
    const nextRemainingRaw = new Prisma.Decimal(loan.remainingPhp).add(remainingDelta);
    const nextPaidRaw = new Prisma.Decimal(loan.paidToDatePhp).add(paidDelta);
    if (nextRemainingRaw.lt(0)) {
        throw new Error("Loan remaining balance cannot go below 0.");
    }
    if (nextPaidRaw.lt(0)) {
        throw new Error("Loan paid amount cannot go below 0.");
    }

    return tx.loanRecord.update({
        where: { id: loan.id },
        data: {
            remainingPhp: nextRemainingRaw,
            paidToDatePhp: nextPaidRaw,
            status: nextRemainingRaw.eq(0) ? LoanStatus.PAID : LoanStatus.ACTIVE,
        },
    });
};

const resolveContext = async (
    tx: TxClient,
    params: PostTransactionParams,
    options: PostOptions,
): Promise<ResolvedPostingContext> => {
    const includeArchived = options.includeArchivedReferences ?? false;

    if (!params.walletAccountId) {
        throw new Error("Wallet account is required.");
    }

    const sourceWallet = await ensureOwnedWallet(
        tx,
        params.userId,
        params.entityId,
        params.walletAccountId,
        includeArchived,
    );

    const targetWallet = params.targetWalletAccountId
        ? await ensureOwnedWallet(
            tx,
            params.userId,
            params.entityId,
            params.targetWalletAccountId,
            includeArchived,
        )
        : null;

    const budgetEnvelope = await resolveBudgetEnvelope(
        tx,
        params.userId,
        params.entityId,
        params.kind,
        params.budgetEnvelopeId,
        includeArchived,
    );
    const ccPaymentEnvelope = await resolveCreditCardPaymentEnvelope(
        tx,
        params,
        { sourceWallet, targetWallet },
        includeArchived,
    );

    const loan = params.loanRecordId
        ? await ensureOwnedLoan(tx, params.userId, params.entityId, params.loanRecordId)
        : null;

    const incomeStreamId = params.incomeStreamId
        ? (await ensureOwnedIncomeStream(tx, params.userId, params.entityId, params.incomeStreamId)).id
        : null;

    return {
        sourceWallet,
        targetWallet,
        budgetEnvelope,
        ccPaymentEnvelope,
        loan,
        incomeStreamId,
    };
};

const validateByRule = (
    params: PostTransactionParams,
    context: ResolvedPostingContext,
) => {
    const rule = transactionRules[params.kind];
    if (!rule) {
        throw new Error("Unsupported transaction kind.");
    }

    if (params.recordOnly && !rule.supportsRecordOnly) {
        throw new Error("Record-only mode is not supported for this transaction kind.");
    }

    if (rule.requiresBudget && !context.budgetEnvelope) {
        throw new Error("Budget envelope is required.");
    }

    if (rule.requiresTargetWallet && !context.targetWallet) {
        throw new Error("Target wallet is required for this transaction kind.");
    }

    if (rule.requiresLoan && !context.loan) {
        throw new Error("Loan record is required for this transaction kind.");
    }

    if (params.kind === TransactionKind.TRANSFER && context.targetWallet && context.targetWallet.id === context.sourceWallet.id) {
        throw new Error("Source and target wallets must be different.");
    }

    if (params.kind === TransactionKind.CREDIT_CARD_CHARGE && context.sourceWallet.type !== WalletAccountType.CREDIT_CARD) {
        throw new Error("Credit card charge must use a credit card wallet.");
    }
    if (params.kind === TransactionKind.CREDIT_CARD_CHARGE && !context.ccPaymentEnvelope) {
        throw new Error("Credit card payment envelope is required for charge.");
    }

    if (params.kind === TransactionKind.CREDIT_CARD_PAYMENT) {
        if (!context.targetWallet) {
            throw new Error("Credit card wallet is required for payment.");
        }

        const sourceIsCredit = context.sourceWallet.type === WalletAccountType.CREDIT_CARD;
        const targetIsCredit = context.targetWallet.type === WalletAccountType.CREDIT_CARD;
        if (!sourceIsCredit && !targetIsCredit) {
            throw new Error("Credit card payment requires one credit card wallet.");
        }
        if (sourceIsCredit && targetIsCredit) {
            throw new Error("Credit card payment requires one cash wallet and one credit card wallet.");
        }

        if (context.sourceWallet.id === context.targetWallet.id) {
            throw new Error("Source and target wallets must be different.");
        }
        if (!context.ccPaymentEnvelope) {
            throw new Error("Credit card payment envelope is required for payment.");
        }
    }

    if (params.kind === TransactionKind.ADJUSTMENT) {
        if (!params.adjustmentReasonCode) {
            throw new Error("Adjustment reason code is required.");
        }
        if (!normalizeRemarks(params.remarks)) {
            throw new Error("Adjustment remarks are required.");
        }
    }
};

const applyPostingEffects = async (
    tx: TxClient,
    params: PostTransactionParams,
    context: ResolvedPostingContext,
    amount: Prisma.Decimal,
    reverse: boolean,
) => {
    const direction = reverse ? -1 : 1;
    const amountAbs = decimalAbs(amount);
    const positive = amountAbs;
    const negative = amountAbs.mul(-1);

    switch (params.kind) {
        case TransactionKind.INCOME:
            if (!context.budgetEnvelope) {
                throw new Error("Budget envelope is required.");
            }
            if (reverse) {
                assertWalletCanDecrease(context.sourceWallet, positive, "Cannot reverse income because wallet balance would go negative.");
                assertEnvelopeCanDecrease(context.budgetEnvelope, positive, "Cannot reverse income because budget envelope would go negative.");
            }
            await updateWalletBalance(tx, params.userId, params.entityId, context.sourceWallet, direction === 1 ? positive : negative);
            await updateEnvelopeBalance(tx, context.budgetEnvelope.id, direction === 1 ? positive : negative);
            break;
        case TransactionKind.EXPENSE:
            if (!context.budgetEnvelope) {
                throw new Error("Budget envelope is required.");
            }
            if (!reverse) {
                assertWalletCanDecrease(context.sourceWallet, positive, "Insufficient wallet funds for expense.");
                assertEnvelopeCanDecrease(context.budgetEnvelope, positive, "Budget envelope cannot go below 0.");
            }
            await updateWalletBalance(tx, params.userId, params.entityId, context.sourceWallet, direction === 1 ? negative : positive);
            await updateEnvelopeBalance(tx, context.budgetEnvelope.id, direction === 1 ? negative : positive);
            break;
        case TransactionKind.BUDGET_ALLOCATION:
            if (!context.budgetEnvelope) {
                throw new Error("Budget envelope is required.");
            }
            if (!reverse) {
                assertWalletCanDecrease(context.sourceWallet, positive, "Insufficient wallet funds for budget allocation.");
            } else {
                assertEnvelopeCanDecrease(context.budgetEnvelope, positive, "Cannot reverse allocation because budget envelope would go negative.");
            }
            await updateWalletBalance(tx, params.userId, params.entityId, context.sourceWallet, direction === 1 ? negative : positive);
            await updateEnvelopeBalance(tx, context.budgetEnvelope.id, direction === 1 ? positive : negative);
            break;
        case TransactionKind.TRANSFER:
            if (!context.targetWallet) {
                throw new Error("Target wallet is required for transfer.");
            }
            if (!reverse) {
                assertWalletCanDecrease(context.sourceWallet, positive, "Insufficient wallet funds for transfer.");
            } else {
                assertWalletCanDecrease(context.targetWallet, positive, "Cannot reverse transfer because target wallet would go negative.");
            }
            await updateWalletBalance(tx, params.userId, params.entityId, context.sourceWallet, direction === 1 ? negative : positive);
            await updateWalletBalance(tx, params.userId, params.entityId, context.targetWallet, direction === 1 ? positive : negative);
            break;
        case TransactionKind.CREDIT_CARD_CHARGE: {
            if (!context.budgetEnvelope) {
                throw new Error("Budget envelope is required.");
            }
            if (!context.ccPaymentEnvelope) {
                throw new Error("Credit card payment envelope is required for charge.");
            }

            if (!reverse) {
                assertEnvelopeCanDecrease(context.budgetEnvelope, positive, "Budget envelope cannot go below 0.");
                const linkedCard = await tx.creditAccount.findFirst({
                    where: {
                        userId: params.userId,
                        entityId: params.entityId,
                        isArchived: false,
                        name: context.sourceWallet.name,
                    },
                    select: {
                        creditLimitAmount: true,
                        currentBalanceAmount: true,
                    },
                });
                if (linkedCard) {
                    const projected = new Prisma.Decimal(linkedCard.currentBalanceAmount).add(positive);
                    if (projected.gt(linkedCard.creditLimitAmount)) {
                        throw new Error("Credit card charge exceeds credit limit.");
                    }
                }
            } else {
                if (new Prisma.Decimal(context.sourceWallet.currentBalanceAmount).lt(positive)) {
                    throw new Error("Cannot reverse charge because credit card debt would go below 0.");
                }
                assertEnvelopeCanDecrease(
                    context.ccPaymentEnvelope,
                    positive,
                    "Cannot reverse charge because credit payment reserve would go below 0.",
                );
            }

            await updateWalletBalance(tx, params.userId, params.entityId, context.sourceWallet, direction === 1 ? positive : negative);
            await updateEnvelopeBalance(tx, context.budgetEnvelope.id, direction === 1 ? negative : positive);
            await updateEnvelopeBalance(tx, context.ccPaymentEnvelope.id, direction === 1 ? positive : negative);
            break;
        }
        case TransactionKind.CREDIT_CARD_PAYMENT: {
            if (!context.targetWallet) {
                throw new Error("Credit card wallet is required for payment.");
            }
            if (!context.ccPaymentEnvelope) {
                throw new Error("Credit card payment envelope is required for payment.");
            }

            const sourceIsCredit = context.sourceWallet.type === WalletAccountType.CREDIT_CARD;
            const creditWallet = sourceIsCredit ? context.sourceWallet : context.targetWallet;
            const cashWallet = sourceIsCredit ? context.targetWallet : context.sourceWallet;

            if (!reverse) {
                assertWalletCanDecrease(cashWallet, positive, "Insufficient cash wallet funds for credit card payment.");
                if (new Prisma.Decimal(creditWallet.currentBalanceAmount).lt(positive)) {
                    throw new Error("Credit card payment cannot exceed outstanding debt.");
                }
                assertEnvelopeCanDecrease(
                    context.ccPaymentEnvelope,
                    positive,
                    "Insufficient reserved cash in credit card payment envelope.",
                );
            } else {
                const linkedCard = await tx.creditAccount.findFirst({
                    where: {
                        userId: params.userId,
                        entityId: params.entityId,
                        isArchived: false,
                        name: creditWallet.name,
                    },
                    select: {
                        creditLimitAmount: true,
                        currentBalanceAmount: true,
                    },
                });
                if (linkedCard) {
                    const projected = new Prisma.Decimal(linkedCard.currentBalanceAmount).add(positive);
                    if (projected.gt(linkedCard.creditLimitAmount)) {
                        throw new Error("Cannot reverse payment because credit limit would be exceeded.");
                    }
                }
            }

            await updateWalletBalance(tx, params.userId, params.entityId, cashWallet, direction === 1 ? negative : positive);
            await updateWalletBalance(tx, params.userId, params.entityId, creditWallet, direction === 1 ? negative : positive);
            await updateEnvelopeBalance(tx, context.ccPaymentEnvelope.id, direction === 1 ? negative : positive);
            break;
        }
        case TransactionKind.LOAN_BORROW:
            if (!context.loan) {
                throw new Error("Loan record is required for borrow.");
            }
            if (context.loan.status === LoanStatus.WRITTEN_OFF) {
                throw new Error("Cannot borrow against a written-off loan.");
            }
            if (reverse && new Prisma.Decimal(context.loan.remainingPhp).lt(positive)) {
                throw new Error("Cannot reverse borrow because remaining principal would go below 0.");
            }
            await updateWalletBalance(tx, params.userId, params.entityId, context.sourceWallet, direction === 1 ? positive : negative);
            await updateLoan(tx, context.loan, direction === 1 ? positive : negative, new Prisma.Decimal(0));
            break;
        case TransactionKind.LOAN_REPAY:
            if (!context.loan) {
                throw new Error("Loan record is required for repayment.");
            }
            if (context.loan.status === LoanStatus.INACTIVE || context.loan.status === LoanStatus.WRITTEN_OFF) {
                throw new Error("Cannot repay an inactive or written-off loan.");
            }
            if (!reverse) {
                assertWalletCanDecrease(context.sourceWallet, positive, "Insufficient wallet funds for loan repayment.");
                if (new Prisma.Decimal(context.loan.remainingPhp).lt(positive)) {
                    throw new Error("Loan repayment cannot exceed remaining principal.");
                }
            } else if (new Prisma.Decimal(context.loan.paidToDatePhp).lt(positive)) {
                throw new Error("Cannot reverse repayment because paid amount would go below 0.");
            }

            await updateWalletBalance(tx, params.userId, params.entityId, context.sourceWallet, direction === 1 ? negative : positive);
            await updateLoan(tx, context.loan, direction === 1 ? negative : positive, direction === 1 ? positive : negative);
            break;
        case TransactionKind.ADJUSTMENT: {
            const effectiveDelta = reverse ? amount.mul(-1) : amount;
            if (effectiveDelta.lt(0)) {
                assertWalletCanDecrease(
                    context.sourceWallet,
                    decimalAbs(effectiveDelta),
                    "Adjustment would make wallet balance negative.",
                );
            }
            await updateWalletBalance(tx, params.userId, params.entityId, context.sourceWallet, effectiveDelta);
            break;
        }
        default:
            throw new Error("Unsupported transaction kind.");
    }
};

const postFinanceTransactionInTx = async (
    tx: TxClient,
    params: PostTransactionParams,
    options: PostOptions = {},
) => {
    const entityId = ensureEntityId(params.entityId);
    const actorUserId = ensureActorUserId(params.actorUserId);

    if (!Number.isFinite(params.amountPhp)) {
        throw new Error("Amount must be a valid number.");
    }

    assertNoNegativeForNonAdjustment(params.kind, params.amountPhp);

    const amount = toDecimal(params.amountPhp);
    const context = await resolveContext(tx, { ...params, entityId, actorUserId }, options);
    validateByRule(params, context);

    if (!params.recordOnly) {
        await applyPostingEffects(tx, params, context, amount, Boolean(options.reverse));
    }

    return tx.financeTransaction.create({
        data: {
            userId: params.userId,
            actorUserId,
            entityId,
            postedAt: params.postedAt ?? new Date(),
            kind: params.kind,
            amountPhp: amount,
            walletAccountId: context.sourceWallet.id,
            targetWalletAccountId: context.targetWallet?.id ?? null,
            budgetEnvelopeId: context.budgetEnvelope?.id ?? null,
            ccPaymentEnvelopeId: context.ccPaymentEnvelope?.id ?? null,
            incomeStreamId: context.incomeStreamId,
            loanRecordId: context.loan?.id ?? null,
            adjustmentReasonCode: params.kind === TransactionKind.ADJUSTMENT ? params.adjustmentReasonCode ?? null : null,
            isReversal: Boolean(options.reverse),
            reversedTransactionId: options.reversedTransactionId ?? null,
            countsTowardBudget: params.recordOnly || options.reverse ? false : resolveCountsTowardBudget(params.kind),
            remarks: normalizeRemarks(params.remarks),
        },
    });
};

export const postFinanceTransaction = async (params: PostTransactionParams) => {
    return prisma.$transaction((tx) => postFinanceTransactionInTx(tx, params));
};

export const postFinanceTransactionsBatch = async (paramsList: PostTransactionParams[]) => {
    if (paramsList.length === 0) {
        return [];
    }

    return prisma.$transaction(async (tx) => {
        const created = [];
        for (const params of paramsList) {
            created.push(await postFinanceTransactionInTx(tx, params));
        }
        return created;
    });
};

export const reconcileWalletBalanceWithAdjustment = async (params: {
    userId: string;
    entityId: string;
    actorUserId: string;
    walletAccountId: string;
    targetBalancePhp: number;
    remarks: string;
    reasonCode: AdjustmentReasonCode;
}) => {
    return prisma.$transaction(async (tx) => {
        const wallet = await ensureOwnedWallet(tx, params.userId, params.entityId, params.walletAccountId);
        const targetBalance = toDecimal(params.targetBalancePhp);
        const delta = targetBalance.sub(new Prisma.Decimal(wallet.currentBalanceAmount));

        if (delta.eq(0)) {
            return wallet;
        }

        await postFinanceTransactionInTx(tx, {
            userId: params.userId,
            entityId: params.entityId,
            actorUserId: params.actorUserId,
            kind: TransactionKind.ADJUSTMENT,
            amountPhp: Number(delta),
            walletAccountId: wallet.id,
            adjustmentReasonCode: params.reasonCode,
            remarks: params.remarks,
        });

        return tx.walletAccount.findUnique({
            where: { id: wallet.id },
        });
    });
};

export const syncBudgetEnvelopeAvailableForImport = async (params: {
    userId: string;
    entityId: string;
    budgetEnvelopeId: string;
    targetAvailablePhp: number;
}) => {
    return prisma.$transaction(async (tx) => {
        if (!Number.isFinite(params.targetAvailablePhp) || params.targetAvailablePhp < 0) {
            throw new Error("Target budget available amount must be greater than or equal to 0.");
        }

        const envelope = await ensureOwnedEnvelope(tx, params.userId, params.entityId, params.budgetEnvelopeId, true);
        const targetAvailable = toDecimal(params.targetAvailablePhp);
        const delta = targetAvailable.sub(new Prisma.Decimal(envelope.availablePhp));
        if (delta.eq(0)) {
            return envelope;
        }

        return updateEnvelopeBalance(tx, envelope.id, delta);
    });
};

export const syncLoanSnapshotForImport = async (params: {
    userId: string;
    entityId: string;
    loanRecordId: string;
    principalPhp: number;
    paidToDatePhp: number;
    remainingPhp: number;
    status: LoanStatus;
}) => {
    return prisma.$transaction(async (tx) => {
        const loan = await ensureOwnedLoan(tx, params.userId, params.entityId, params.loanRecordId);
        const principalPhp = toDecimal(params.principalPhp);
        const paidToDatePhp = toDecimal(params.paidToDatePhp);
        const remainingPhp = toDecimal(params.remainingPhp);

        if (principalPhp.lt(0) || paidToDatePhp.lt(0) || remainingPhp.lt(0)) {
            throw new Error("Loan amounts cannot be negative.");
        }

        return tx.loanRecord.update({
            where: { id: loan.id },
            data: {
                principalPhp,
                paidToDatePhp,
                remainingPhp,
                status: params.status,
            },
        });
    });
};

export const deleteFinanceTransactionWithReversal = async (
    userId: string,
    entityId: string,
    actorUserId: string,
    transactionId: string,
) => {
    const safeEntityId = ensureEntityId(entityId);
    const safeActorUserId = ensureActorUserId(actorUserId);

    return prisma.$transaction(async (tx) => {
        const transaction = await tx.financeTransaction.findFirst({
            where: {
                id: transactionId,
                userId,
                entityId: safeEntityId,
                isReversal: false,
            },
            include: {
                reversalTransaction: {
                    select: {
                        id: true,
                    },
                },
            },
        });

        if (!transaction) {
            throw new Error("Transaction not found.");
        }

        if (transaction.voidedAt) {
            throw new Error("Transaction is already voided.");
        }

        if (transaction.reversalTransaction) {
            throw new Error("Transaction already has a reversal entry.");
        }

        const remarksPrefix = normalizeRemarks(transaction.remarks);
        const reversalRemarks = remarksPrefix
            ? `Reversal of transaction ${transaction.id}: ${remarksPrefix}`
            : `Reversal of transaction ${transaction.id}.`;

        const reversalInput: PostTransactionParams = {
            userId,
            entityId: safeEntityId,
            actorUserId: safeActorUserId,
            kind: transaction.kind,
            recordOnly: isRecordOnlyTransaction(transaction),
            postedAt: transaction.postedAt,
            amountPhp: Number(transaction.amountPhp),
            walletAccountId: transaction.walletAccountId,
            budgetEnvelopeId: transaction.budgetEnvelopeId,
            ccPaymentEnvelopeId: transaction.ccPaymentEnvelopeId,
            targetWalletAccountId: transaction.targetWalletAccountId,
            incomeStreamId: transaction.incomeStreamId,
            loanRecordId: transaction.loanRecordId,
            remarks: reversalRemarks,
            adjustmentReasonCode:
                transaction.kind === TransactionKind.ADJUSTMENT
                    ? (transaction.adjustmentReasonCode ?? AdjustmentReasonCode.MANUAL_FIX)
                    : null,
        };

        const reversal = await postFinanceTransactionInTx(tx, reversalInput, {
            reverse: true,
            reversedTransactionId: transaction.id,
            includeArchivedReferences: true,
        });

        await tx.financeTransaction.update({
            where: {
                id: transaction.id,
            },
            data: {
                voidedAt: new Date(),
                voidedByUserId: safeActorUserId,
            },
        });

        return reversal;
    });
};
