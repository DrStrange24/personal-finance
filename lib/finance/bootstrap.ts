import { Prisma, TransactionKind, WalletAccountType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SYSTEM_ENVELOPE_NAMES } from "@/lib/finance/constants";

const inferWalletAccountType = (name: string, legacyType: "CASH_WALLET" | "ASSET_HOLDING") => {
    if (legacyType === "ASSET_HOLDING") {
        return WalletAccountType.ASSET;
    }

    const lowered = name.toLowerCase();
    if (lowered.includes("gcash") || lowered.includes("coins") || lowered.includes("maya")) {
        return WalletAccountType.E_WALLET;
    }
    if (lowered.includes("bdo") || lowered.includes("bank") || lowered.includes("wise")) {
        return WalletAccountType.BANK;
    }

    return WalletAccountType.CASH;
};

export const ensureSystemEnvelopesForUser = async (userId: string) => {
    for (const name of SYSTEM_ENVELOPE_NAMES) {
        const existing = await prisma.budgetEnvelope.findFirst({
            where: {
                userId,
                name,
                isSystem: true,
                isArchived: false,
            },
        });

        if (!existing) {
            await prisma.budgetEnvelope.create({
                data: {
                    userId,
                    name,
                    isSystem: true,
                    monthlyTargetPhp: 0,
                    availablePhp: 0,
                    rolloverEnabled: true,
                    sortOrder: 9999,
                    remarks: "Auto-created system envelope.",
                },
            });
        }
    }
};

export const ensureFinanceBootstrap = async (userId: string) => {
    await ensureSystemEnvelopesForUser(userId);

    const walletAccountCount = await prisma.walletAccount.count({
        where: { userId },
    });

    if (walletAccountCount === 0) {
        const legacyWalletEntries = await prisma.walletEntry.findMany({
            where: {
                userId,
                isArchived: false,
            },
            orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
        });

        for (const legacyEntry of legacyWalletEntries) {
            const currentBalance = new Prisma.Decimal(legacyEntry.currentValuePhp);
            const walletAccount = await prisma.walletAccount.create({
                data: {
                    userId,
                    name: legacyEntry.name,
                    type: inferWalletAccountType(legacyEntry.name, legacyEntry.type),
                    currentBalancePhp: currentBalance,
                },
            });

            await prisma.financeTransaction.create({
                data: {
                    userId,
                    postedAt: new Date(),
                    kind: TransactionKind.ADJUSTMENT,
                    amountPhp: currentBalance,
                    walletAccountId: walletAccount.id,
                    countsTowardBudget: false,
                    remarks: `Opening balance imported from legacy wallet entry${legacyEntry.groupName ? ` (${legacyEntry.groupName})` : ""}.`,
                },
            });
        }
    }

    const budgetEnvelopeCount = await prisma.budgetEnvelope.count({
        where: {
            userId,
            isArchived: false,
            isSystem: false,
        },
    });

    if (budgetEnvelopeCount === 0) {
        await prisma.budgetEnvelope.create({
            data: {
                userId,
                name: "General",
                monthlyTargetPhp: 0,
                availablePhp: 0,
                rolloverEnabled: true,
                sortOrder: 1,
            },
        });
    }

    const incomeStreamCount = await prisma.incomeStream.count({
        where: { userId },
    });

    if (incomeStreamCount === 0) {
        await prisma.incomeStream.createMany({
            data: [
                {
                    userId,
                    name: "Income Stream 1",
                    defaultAmountPhp: 0,
                    remarks: "Default stream created during finance bootstrap.",
                },
                {
                    userId,
                    name: "Income Stream 2",
                    defaultAmountPhp: 0,
                    remarks: "Default stream created during finance bootstrap.",
                },
            ],
        });
    }
};
