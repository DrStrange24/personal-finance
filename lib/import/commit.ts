import {
    LoanDirection,
    LoanStatus,
    Prisma,
    TransactionKind,
    WalletAccountType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureFinanceBootstrap } from "@/lib/finance/bootstrap";
import type { ParsedWorkbook } from "@/lib/import/workbook";

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

export const commitWorkbookForUser = async (userId: string, entityId: string, workbook: ParsedWorkbook) => {
    await ensureFinanceBootstrap(userId, entityId);

    const result = {
        walletAccountsUpserted: 0,
        budgetEnvelopesUpserted: 0,
        incomeStreamsUpserted: 0,
        loansUpserted: 0,
        monthlyOverviewRowsInserted: 0,
    };

    for (const entry of workbook.wallet) {
        const existing = await prisma.walletAccount.findFirst({
            where: {
                userId,
                entityId,
                name: entry.name,
                isArchived: false,
            },
        });

        const isInvestmentEntry = (entry.initialInvestmentPhp ?? 0) > 0;

        if (isInvestmentEntry) {
            const existingInvestment = await prisma.investment.findFirst({
                where: {
                    userId,
                    name: entry.name,
                    isArchived: false,
                },
            });
            const initialInvestmentPhp = new Prisma.Decimal(entry.initialInvestmentPhp ?? entry.amountPhp);
            const value = new Prisma.Decimal(entry.amountPhp);

            if (existingInvestment) {
                await prisma.investment.update({
                    where: { id: existingInvestment.id },
                    data: {
                        initialInvestmentPhp,
                        value,
                        remarks: entry.remarks,
                    },
                });
            } else {
                await prisma.investment.create({
                    data: {
                        userId,
                        name: entry.name,
                        initialInvestmentPhp,
                        value,
                        remarks: entry.remarks,
                    },
                });
            }

            if (existing && existing.type === WalletAccountType.ASSET) {
                await prisma.walletAccount.update({
                    where: { id: existing.id },
                    data: {
                        isArchived: true,
                    },
                });
            }

            result.walletAccountsUpserted += 1;
            continue;
        }

        const type = inferWalletType(entry.name);
        const balance = new Prisma.Decimal(entry.amountPhp);

        if (existing) {
            await prisma.walletAccount.update({
                where: { id: existing.id },
                data: {
                    type,
                    currentBalanceAmount: balance,
                },
            });
        } else {
            const wallet = await prisma.walletAccount.create({
                data: {
                    userId,
                    entityId,
                    name: entry.name,
                    type,
                    currentBalanceAmount: balance,
                },
            });

            await prisma.financeTransaction.create({
                data: {
                    userId,
                    entityId,
                    kind: TransactionKind.ADJUSTMENT,
                    amountPhp: balance,
                    walletAccountId: wallet.id,
                    countsTowardBudget: false,
                    remarks: "Opening balance imported from workbook.",
                },
            });
        }

        result.walletAccountsUpserted += 1;
    }

    for (const entry of workbook.budget) {
        const existing = await prisma.budgetEnvelope.findFirst({
            where: {
                userId,
                entityId,
                name: entry.name,
                isArchived: false,
            },
        });

        const monthlyTargetPhp = new Prisma.Decimal(entry.monthlyAmountPhp ?? 0);
        const availablePhp = new Prisma.Decimal(entry.budgetBalancePhp ?? 0);
        const remarks = entry.remarks;

        if (existing) {
            await prisma.budgetEnvelope.update({
                where: { id: existing.id },
                data: {
                    monthlyTargetPhp,
                    availablePhp,
                    payTo: entry.payTo,
                    remarks,
                },
            });
        } else {
            await prisma.budgetEnvelope.create({
                data: {
                    userId,
                    entityId,
                    name: entry.name,
                    monthlyTargetPhp,
                    availablePhp,
                    payTo: entry.payTo,
                    remarks,
                },
            });
        }

        result.budgetEnvelopesUpserted += 1;
    }

    for (const entry of workbook.income) {
        const existing = await prisma.incomeStream.findFirst({
            where: {
                userId,
                entityId,
                name: entry.name,
            },
        });

        if (existing) {
            await prisma.incomeStream.update({
                where: { id: existing.id },
                data: {
                    defaultAmountPhp: entry.amountPhp,
                    remarks: entry.remarks,
                    isActive: true,
                },
            });
        } else {
            await prisma.incomeStream.create({
                data: {
                    userId,
                    entityId,
                    name: entry.name,
                    defaultAmountPhp: entry.amountPhp,
                    remarks: entry.remarks,
                    isActive: true,
                },
            });
        }

        result.incomeStreamsUpserted += 1;
    }

    for (const entry of workbook.loan) {
        const existing = await prisma.loanRecord.findFirst({
            where: {
                userId,
                entityId,
                itemName: entry.itemName,
                counterparty: entry.payTo,
            },
        });

        const principalPhp = new Prisma.Decimal(entry.pricePhp ?? 0);
        const paidToDatePhp = new Prisma.Decimal(entry.paidPhp ?? 0);
        const remainingPhp = new Prisma.Decimal(entry.remainingPhp ?? 0);
        const monthlyDuePhp = entry.monthlyPhp === null ? null : new Prisma.Decimal(entry.monthlyPhp);
        const status = remainingPhp.lte(0) || entry.paidStatus?.toLowerCase() === "paid"
            ? LoanStatus.PAID
            : LoanStatus.ACTIVE;

        if (existing) {
            await prisma.loanRecord.update({
                where: { id: existing.id },
                data: {
                    principalPhp,
                    paidToDatePhp,
                    remainingPhp,
                    monthlyDuePhp,
                    status,
                },
            });
        } else {
            await prisma.loanRecord.create({
                data: {
                    userId,
                    entityId,
                    direction: LoanDirection.YOU_OWE,
                    itemName: entry.itemName,
                    counterparty: entry.payTo,
                    principalPhp,
                    monthlyDuePhp,
                    paidToDatePhp,
                    remainingPhp,
                    status,
                },
            });
        }

        result.loansUpserted += 1;
    }

    for (const entry of workbook.statistics) {
        const existing = await prisma.monthlyOverviewEntry.findFirst({
            where: {
                userId,
                entryDate: entry.entryDate,
            },
        });

        if (!existing) {
            await prisma.monthlyOverviewEntry.create({
                data: {
                    userId,
                    entryDate: entry.entryDate,
                    walletAmount: entry.walletAmountPhp,
                    remarks: entry.remarks,
                },
            });
            result.monthlyOverviewRowsInserted += 1;
        }
    }

    return result;
};

