import { EntityType, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type PerUserMigrationResult = {
    userId: string;
    entityId: string;
    createdEntity: boolean;
    walletsUpdated: number;
    budgetsUpdated: number;
    loansUpdated: number;
    incomeStreamsUpdated: number;
    transactionsUpdated: number;
};

type NullEntityCounts = {
    walletAccounts: number;
    budgetEnvelopes: number;
    loanRecords: number;
    incomeStreams: number;
    transactions: number;
};

const DEFAULT_ENTITY_NAME = "Personal";

const migrateUser = async (userId: string): Promise<PerUserMigrationResult> => {
    return prisma.$transaction(async (tx) => {
        const existingEntity = await tx.financeEntity.findFirst({
            where: {
                userId,
                name: DEFAULT_ENTITY_NAME,
                type: EntityType.PERSONAL,
                isArchived: false,
            },
            orderBy: [{ createdAt: "asc" }],
            select: { id: true },
        });

        const entityId = existingEntity?.id ?? (
            await tx.financeEntity.create({
                data: {
                    userId,
                    name: DEFAULT_ENTITY_NAME,
                    type: EntityType.PERSONAL,
                    isArchived: false,
                },
                select: { id: true },
            })
        ).id;

        const [wallets, budgets, loans, incomes, transactions] = await Promise.all([
            tx.walletAccount.updateMany({
                where: {
                    userId,
                    entityId: null,
                },
                data: {
                    entityId,
                },
            }),
            tx.budgetEnvelope.updateMany({
                where: {
                    userId,
                    entityId: null,
                },
                data: {
                    entityId,
                },
            }),
            tx.loanRecord.updateMany({
                where: {
                    userId,
                    entityId: null,
                },
                data: {
                    entityId,
                },
            }),
            tx.incomeStream.updateMany({
                where: {
                    userId,
                    entityId: null,
                },
                data: {
                    entityId,
                },
            }),
            tx.financeTransaction.updateMany({
                where: {
                    userId,
                    entityId: null,
                },
                data: {
                    entityId,
                },
            }),
        ]);

        return {
            userId,
            entityId,
            createdEntity: existingEntity === null,
            walletsUpdated: wallets.count,
            budgetsUpdated: budgets.count,
            loansUpdated: loans.count,
            incomeStreamsUpdated: incomes.count,
            transactionsUpdated: transactions.count,
        };
    });
};

const getNullEntityCounts = async (): Promise<NullEntityCounts> => {
    const [walletAccounts, budgetEnvelopes, loanRecords, incomeStreams, transactions] = await Promise.all([
        prisma.walletAccount.count({ where: { entityId: null } }),
        prisma.budgetEnvelope.count({ where: { entityId: null } }),
        prisma.loanRecord.count({ where: { entityId: null } }),
        prisma.incomeStream.count({ where: { entityId: null } }),
        prisma.financeTransaction.count({ where: { entityId: null } }),
    ]);

    return {
        walletAccounts,
        budgetEnvelopes,
        loanRecords,
        incomeStreams,
        transactions,
    };
};

const getTotalEntityCounts = async () => {
    const [walletAccounts, budgetEnvelopes, loanRecords, incomeStreams, transactions] = await Promise.all([
        prisma.walletAccount.count(),
        prisma.budgetEnvelope.count(),
        prisma.loanRecord.count(),
        prisma.incomeStream.count(),
        prisma.financeTransaction.count(),
    ]);

    return {
        walletAccounts,
        budgetEnvelopes,
        loanRecords,
        incomeStreams,
        transactions,
    };
};

const summarizeResults = (results: PerUserMigrationResult[]) => {
    return results.reduce(
        (summary, result) => ({
            usersProcessed: summary.usersProcessed + 1,
            entitiesCreated: summary.entitiesCreated + (result.createdEntity ? 1 : 0),
            walletsUpdated: summary.walletsUpdated + result.walletsUpdated,
            budgetsUpdated: summary.budgetsUpdated + result.budgetsUpdated,
            loansUpdated: summary.loansUpdated + result.loansUpdated,
            incomeStreamsUpdated: summary.incomeStreamsUpdated + result.incomeStreamsUpdated,
            transactionsUpdated: summary.transactionsUpdated + result.transactionsUpdated,
        }),
        {
            usersProcessed: 0,
            entitiesCreated: 0,
            walletsUpdated: 0,
            budgetsUpdated: 0,
            loansUpdated: 0,
            incomeStreamsUpdated: 0,
            transactionsUpdated: 0,
        },
    );
};

const main = async () => {
    const users = await prisma.user.findMany({
        select: { id: true },
        orderBy: [{ createdAt: "asc" }],
    });

    const results: PerUserMigrationResult[] = [];

    for (const user of users) {
        const result = await migrateUser(user.id);
        results.push(result);
        console.log(
            [
                `[entity-migration] user=${result.userId}`,
                `entity=${result.entityId}`,
                `createdEntity=${result.createdEntity}`,
                `wallets=${result.walletsUpdated}`,
                `budgets=${result.budgetsUpdated}`,
                `loans=${result.loansUpdated}`,
                `incomeStreams=${result.incomeStreamsUpdated}`,
                `transactions=${result.transactionsUpdated}`,
            ].join(" "),
        );
    }

    const summary = summarizeResults(results);
    console.log("[entity-migration] summary", summary);

    const nullCounts = await getNullEntityCounts();
    console.log("[entity-migration] null entityId counts", nullCounts);

    const hasNulls = Object.values(nullCounts).some((count) => count > 0);
    if (hasNulls) {
        throw new Error("Verification failed: one or more entity-scoped tables still have NULL entityId values.");
    }

    const totals = await getTotalEntityCounts();
    console.log("[entity-migration] final totals", totals);
    console.log("[entity-migration] verification passed");
};

main()
    .catch((error) => {
        console.error("[entity-migration] failed", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
