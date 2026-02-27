import { prisma } from "@/lib/prisma";

export const NEEDS_WANTS_ENVELOPE_NAME = "Needs/Wants";

const normalizeMoney = (value: number) => Math.round(value * 100) / 100;

type ResolveBudgetAllocationTransactionsParams = {
    userId: string;
    entityId: string;
    actorUserId: string;
    postedAt: Date;
    requestedAmountPhp: number;
    walletAccountId: string;
    budgetEnvelopeId: string;
    remarks: string | null;
    recordOnly?: boolean;
};

type BudgetAllocationPosting = {
    userId: string;
    entityId: string;
    actorUserId: string;
    kind: "BUDGET_ALLOCATION";
    postedAt: Date;
    amountPhp: number;
    walletAccountId: string;
    budgetEnvelopeId: string;
    remarks: string | null;
    recordOnly?: boolean;
};

export const resolveBudgetAllocationEnvelopeEntityId = async (
    userId: string,
    budgetEnvelopeId: string,
) => {
    const envelope = await prisma.budgetEnvelope.findFirst({
        where: {
            id: budgetEnvelopeId,
            userId,
            isArchived: false,
            isSystem: false,
            entity: {
                isArchived: false,
            },
        },
        select: {
            entityId: true,
        },
    });

    if (!envelope?.entityId) {
        throw new Error("Budget envelope not found.");
    }

    return envelope.entityId;
};

export const resolveFundingWalletAccountIdForBudgetAllocation = async (
    userId: string,
    entityId: string,
) => {
    const wallet = await prisma.walletAccount.findFirst({
        where: {
            userId,
            entityId,
            isArchived: false,
            type: {
                notIn: ["CREDIT_CARD", "ASSET"],
            },
            entity: {
                isArchived: false,
            },
        },
        orderBy: [
            { currentBalanceAmount: "desc" },
            { createdAt: "asc" },
        ],
        select: {
            id: true,
        },
    });

    if (!wallet?.id) {
        throw new Error("No eligible wallet found for budget allocation.");
    }

    return wallet.id;
};

export const resolveBudgetAllocationTransactions = async (
    params: ResolveBudgetAllocationTransactionsParams,
): Promise<{ transactions: BudgetAllocationPosting[]; overflowAmountPhp: number }> => {
    const targetEnvelope = await prisma.budgetEnvelope.findFirst({
        where: {
            id: params.budgetEnvelopeId,
            userId: params.userId,
            entityId: params.entityId,
            isArchived: false,
            isSystem: false,
        },
        select: {
            id: true,
            name: true,
            availablePhp: true,
            maxAllocationPhp: true,
        },
    });

    if (!targetEnvelope) {
        throw new Error("Budget envelope not found.");
    }

    const shouldApplyMaxAllocation = !params.recordOnly
        && targetEnvelope.name !== NEEDS_WANTS_ENVELOPE_NAME
        && targetEnvelope.maxAllocationPhp !== null;

    const requestedAmountPhp = params.requestedAmountPhp;
    let primaryAmountPhp = requestedAmountPhp;
    let overflowAmountPhp = 0;

    if (shouldApplyMaxAllocation) {
        const availablePhp = Number(targetEnvelope.availablePhp);
        const maxAllocationPhp = Number(targetEnvelope.maxAllocationPhp);
        const remainingCapacityPhp = normalizeMoney(Math.max(0, maxAllocationPhp - availablePhp));
        primaryAmountPhp = normalizeMoney(Math.min(requestedAmountPhp, remainingCapacityPhp));
        overflowAmountPhp = normalizeMoney(requestedAmountPhp - primaryAmountPhp);
    }

    let overflowEnvelopeId: string | null = null;
    if (overflowAmountPhp > 0) {
        const needsWantsEnvelope = await prisma.budgetEnvelope.findFirst({
            where: {
                userId: params.userId,
                entityId: params.entityId,
                name: NEEDS_WANTS_ENVELOPE_NAME,
                isArchived: false,
                isSystem: false,
            },
            select: {
                id: true,
            },
        });

        if (!needsWantsEnvelope) {
            throw new Error(`Overflow budget requires an active "${NEEDS_WANTS_ENVELOPE_NAME}" envelope.`);
        }
        overflowEnvelopeId = needsWantsEnvelope.id;
    }

    const transactions: BudgetAllocationPosting[] = [
        ...(primaryAmountPhp > 0
            ? [{
                userId: params.userId,
                entityId: params.entityId,
                actorUserId: params.actorUserId,
                kind: "BUDGET_ALLOCATION" as const,
                postedAt: params.postedAt,
                amountPhp: primaryAmountPhp,
                walletAccountId: params.walletAccountId,
                budgetEnvelopeId: targetEnvelope.id,
                remarks: params.remarks,
                recordOnly: params.recordOnly,
            }]
            : []),
        ...(overflowAmountPhp > 0 && overflowEnvelopeId
            ? [{
                userId: params.userId,
                entityId: params.entityId,
                actorUserId: params.actorUserId,
                kind: "BUDGET_ALLOCATION" as const,
                postedAt: params.postedAt,
                amountPhp: overflowAmountPhp,
                walletAccountId: params.walletAccountId,
                budgetEnvelopeId: overflowEnvelopeId,
                remarks: params.remarks,
                recordOnly: params.recordOnly,
            }]
            : []),
    ];

    return {
        transactions,
        overflowAmountPhp,
    };
};
