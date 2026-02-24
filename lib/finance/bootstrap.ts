import { Prisma, TransactionKind, WalletAccountType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SYSTEM_ENVELOPE_NAMES } from "@/lib/finance/constants";

const assertFinancePrismaDelegates = () => {
    const client = prisma as unknown as Record<string, unknown>;
    const requiredDelegates = [
        "walletAccount",
        "investment",
        "incomeStream",
        "budgetEnvelope",
        "loanRecord",
        "financeTransaction",
    ];
    const missing = requiredDelegates.filter((delegate) => typeof client[delegate] === "undefined");

    if (missing.length > 0) {
        throw new Error(
            `Prisma client is out of date (missing delegates: ${missing.join(", ")}). `
            + "Run `npx prisma generate --no-engine` and restart the Next.js dev server.",
        );
    }
};

const inferWalletAccountType = (name: string) => {
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
    assertFinancePrismaDelegates();

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
    assertFinancePrismaDelegates();
    await ensureSystemEnvelopesForUser(userId);
    const prismaClient = prisma as Prisma.TransactionClient & {
        walletEntry?: {
            findMany: (args: {
                where: { userId: string; isArchived: boolean };
                orderBy: Array<{ type: "asc" | "desc" } | { sortOrder: "asc" | "desc" } | { createdAt: "asc" | "desc" }>;
            }) => Promise<Array<{
                type: "CASH_WALLET" | "ASSET_HOLDING";
                currentValuePhp: Prisma.Decimal | number | string;
                name: string;
                groupName: string | null;
            }>>;
        };
    };

    const walletAccountCount = await prisma.walletAccount.count({
        where: { userId },
    });

    if (walletAccountCount === 0) {
        const legacyWalletEntries = prismaClient.walletEntry
            ? await prismaClient.walletEntry.findMany({
                where: {
                    userId,
                    isArchived: false,
                },
                orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
            })
            : [];

        for (const legacyEntry of legacyWalletEntries) {
            const currentBalance = new Prisma.Decimal(legacyEntry.currentValuePhp);

            if (legacyEntry.type === "ASSET_HOLDING") {
                await prisma.investment.create({
                    data: {
                        userId,
                        name: legacyEntry.name,
                        initialInvestmentPhp: currentBalance,
                        currentValuePhp: currentBalance,
                        remarks: legacyEntry.groupName ? `Migrated from legacy wallet group: ${legacyEntry.groupName}` : null,
                    },
                });
                continue;
            }

            const walletAccount = await prisma.walletAccount.create({
                data: {
                    userId,
                    name: legacyEntry.name,
                    type: inferWalletAccountType(legacyEntry.name),
                    currentBalanceAmount: currentBalance,
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

