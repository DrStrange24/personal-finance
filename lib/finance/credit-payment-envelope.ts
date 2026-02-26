import { BudgetEnvelopeSystemType, Prisma, WalletAccountType } from "@prisma/client";
import {
    CREDIT_CARD_PAYMENT_ENVELOPE_PREFIX,
    LEGACY_SHARED_CREDIT_PAYMENT_ENVELOPE_NAME,
} from "@/lib/finance/constants";
import { prisma } from "@/lib/prisma";

type PrismaClientLike = Prisma.TransactionClient | typeof prisma;

type CreditCardWalletInput = {
    id: string;
    userId: string;
    entityId: string;
    type: WalletAccountType;
    name: string;
};

export const buildCreditCardPaymentEnvelopeName = (walletName: string) => {
    return `${CREDIT_CARD_PAYMENT_ENVELOPE_PREFIX}${walletName}`;
};

const resolveLinkedCreditAccountId = async (
    db: PrismaClientLike,
    userId: string,
    entityId: string,
    walletName: string,
) => {
    const account = await db.creditAccount.findFirst({
        where: {
            userId,
            entityId,
            isArchived: false,
            name: walletName,
        },
        select: {
            id: true,
        },
    });
    return account?.id ?? null;
};

export const ensureCreditCardPaymentEnvelopeForWallet = async (
    db: PrismaClientLike,
    wallet: CreditCardWalletInput,
) => {
    if (wallet.type !== WalletAccountType.CREDIT_CARD) {
        throw new Error("Credit card payment envelope can only be linked to a credit card wallet.");
    }

    const linkedCreditAccountId = await resolveLinkedCreditAccountId(db, wallet.userId, wallet.entityId, wallet.name);
    const expectedName = buildCreditCardPaymentEnvelopeName(wallet.name);

    const linked = await db.budgetEnvelope.findFirst({
        where: {
            userId: wallet.userId,
            entityId: wallet.entityId,
            isSystem: true,
            isArchived: false,
            systemType: BudgetEnvelopeSystemType.CREDIT_CARD_PAYMENT,
            linkedWalletAccountId: wallet.id,
        },
    });

    if (linked) {
        if (
            linked.name !== expectedName
            || linked.linkedCreditAccountId !== linkedCreditAccountId
        ) {
            return db.budgetEnvelope.update({
                where: { id: linked.id },
                data: {
                    name: expectedName,
                    linkedCreditAccountId,
                },
            });
        }
        return linked;
    }

    const named = await db.budgetEnvelope.findFirst({
        where: {
            userId: wallet.userId,
            entityId: wallet.entityId,
            isSystem: true,
            isArchived: false,
            systemType: BudgetEnvelopeSystemType.CREDIT_CARD_PAYMENT,
            name: expectedName,
        },
    });

    if (named) {
        return db.budgetEnvelope.update({
            where: { id: named.id },
            data: {
                linkedWalletAccountId: wallet.id,
                linkedCreditAccountId,
            },
        });
    }

    const legacyShared = await db.budgetEnvelope.findFirst({
        where: {
            userId: wallet.userId,
            entityId: wallet.entityId,
            isSystem: true,
            isArchived: false,
            name: LEGACY_SHARED_CREDIT_PAYMENT_ENVELOPE_NAME,
        },
    });

    if (legacyShared && legacyShared.systemType !== BudgetEnvelopeSystemType.CREDIT_CARD_PAYMENT) {
        await db.budgetEnvelope.update({
            where: { id: legacyShared.id },
            data: {
                systemType: BudgetEnvelopeSystemType.CREDIT_CARD_PAYMENT,
            },
        });
    }

    return db.budgetEnvelope.create({
        data: {
            userId: wallet.userId,
            entityId: wallet.entityId,
            name: expectedName,
            isSystem: true,
            systemType: BudgetEnvelopeSystemType.CREDIT_CARD_PAYMENT,
            linkedWalletAccountId: wallet.id,
            linkedCreditAccountId,
            isArchived: false,
            monthlyTargetPhp: 0,
            availablePhp: 0,
            rolloverEnabled: true,
            sortOrder: 9999,
            remarks: "Auto-created per-card credit payment reserve envelope.",
        },
    });
};

export const ensureCreditCardPaymentEnvelopesForEntity = async (
    userId: string,
    entityId: string,
) => {
    const wallets = await prisma.walletAccount.findMany({
        where: {
            userId,
            entityId,
            isArchived: false,
            type: WalletAccountType.CREDIT_CARD,
        },
        select: {
            id: true,
            userId: true,
            entityId: true,
            type: true,
            name: true,
        },
    });

    for (const wallet of wallets) {
        await ensureCreditCardPaymentEnvelopeForWallet(prisma, {
            id: wallet.id,
            userId,
            entityId,
            type: wallet.type,
            name: wallet.name,
        });
    }
};
