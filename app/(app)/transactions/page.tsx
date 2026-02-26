import { Prisma, TransactionKind } from "@prisma/client";
import { revalidatePath } from "next/cache";
import Button from "react-bootstrap/Button";
import Card from "react-bootstrap/Card";
import CardBody from "react-bootstrap/CardBody";
import AddTransactionModal from "./add-transaction-modal";
import TransactionsTable from "./transactions-table";
import { ensureFinanceBootstrap } from "@/lib/finance/bootstrap";
import { getFinanceContextDataAcrossEntities } from "@/lib/finance/context";
import { mapBudgetFormOptions } from "@/lib/finance/form-options";
import { formatPhp } from "@/lib/finance/money";
import { deleteFinanceTransactionWithReversal } from "@/lib/finance/posting-engine";
import {
    postTransactionFromFormData,
    updateTransactionFromFormData,
} from "@/lib/finance/transaction-orchestration";
import { isRecordOnlyTransaction, type FinanceActionResult } from "@/lib/finance/types";
import { getAuthenticatedEntitySession } from "@/lib/server-session";
import { prisma } from "@/lib/prisma";

const TRANSACTIONS_PAGE_SIZE = 50;

type TransactionsPageProps = {
    searchParams?: Promise<{
        kind?: string;
        wallet?: string;
        q?: string;
        from?: string;
        to?: string;
        page?: string;
    }>;
};

const parsePositiveInt = (value: string | undefined, fallback: number) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) {
        return fallback;
    }
    return parsed;
};

const parseDateFilter = (value: string | undefined) => {
    if (!value) {
        return null;
    }
    const normalized = value.trim();
    if (!normalized) {
        return null;
    }
    const parsed = new Date(`${normalized}T00:00:00`);
    if (Number.isNaN(parsed.valueOf())) {
        return null;
    }
    return parsed;
};

export default async function TransactionsPage({ searchParams }: TransactionsPageProps) {
    const session = await getAuthenticatedEntitySession();
    await Promise.all(session.entities.map((entity) => ensureFinanceBootstrap(session.userId, entity.id)));
    const params = (await searchParams) ?? {};
    const selectedKind = typeof params.kind === "string" ? params.kind.trim() : "";
    const selectedWalletId = typeof params.wallet === "string" ? params.wallet.trim() : "";
    const searchText = typeof params.q === "string" ? params.q.trim() : "";
    const selectedFromDate = typeof params.from === "string" ? params.from.trim() : "";
    const selectedToDate = typeof params.to === "string" ? params.to.trim() : "";
    const requestedPage = parsePositiveInt(params.page, 1);

    const postTransactionAction = async (formData: FormData): Promise<FinanceActionResult> => {
        "use server";

        const actionSession = await getAuthenticatedEntitySession();
        const walletAccountId = typeof formData.get("walletAccountId") === "string" ? String(formData.get("walletAccountId")).trim() : "";
        if (!walletAccountId) {
            return { ok: false, message: "Missing wallet account." };
        }

        const sourceWallet = await prisma.walletAccount.findFirst({
            where: {
                id: walletAccountId,
                userId: actionSession.userId,
                isArchived: false,
                entity: {
                    isArchived: false,
                },
            },
            select: {
                entityId: true,
            },
        });
        if (!sourceWallet?.entityId) {
            return { ok: false, message: "Wallet account not found." };
        }

        const result = await postTransactionFromFormData({
            userId: actionSession.userId,
            entityId: sourceWallet.entityId,
            actorUserId: actionSession.userId,
            formData,
        });

        if (!result.ok) {
            return result;
        }

        revalidatePath("/transactions");
        revalidatePath("/dashboard");
        revalidatePath("/budget");
        revalidatePath("/credit");
        revalidatePath("/loan");
        revalidatePath("/wallet");
        return result;
    };

    const updateTransactionAction = async (formData: FormData): Promise<FinanceActionResult> => {
        "use server";

        const actionSession = await getAuthenticatedEntitySession();
        const oldTransactionId = typeof formData.get("id") === "string" ? String(formData.get("id")).trim() : "";
        if (!oldTransactionId) {
            return { ok: false, message: "Missing transaction id." };
        }

        const previousTransaction = await prisma.financeTransaction.findFirst({
            where: {
                id: oldTransactionId,
                userId: actionSession.userId,
                isReversal: false,
                voidedAt: null,
            },
            select: {
                entityId: true,
                kind: true,
                countsTowardBudget: true,
                targetWalletAccountId: true,
                budgetEnvelopeId: true,
                incomeStreamId: true,
                loanRecordId: true,
            },
        });

        if (!previousTransaction) {
            return { ok: false, message: "Transaction not found." };
        }
        if (!previousTransaction.entityId) {
            return { ok: false, message: "Transaction has no entity assignment." };
        }

        const result = await updateTransactionFromFormData({
            userId: actionSession.userId,
            entityId: previousTransaction.entityId,
            actorUserId: actionSession.userId,
            formData,
            transactionId: oldTransactionId,
            fallbackRecordOnly: isRecordOnlyTransaction(previousTransaction),
        });

        if (!result.ok) {
            return result;
        }

        revalidatePath("/transactions");
        revalidatePath("/dashboard");
        revalidatePath("/budget");
        revalidatePath("/credit");
        revalidatePath("/loan");
        revalidatePath("/wallet");
        return result;
    };

    const deleteTransactionAction = async (formData: FormData): Promise<FinanceActionResult> => {
        "use server";

        const actionSession = await getAuthenticatedEntitySession();
        const id = typeof formData.get("id") === "string" ? String(formData.get("id")).trim() : "";
        if (!id) {
            return { ok: false, message: "Missing transaction id." };
        }
        const existing = await prisma.financeTransaction.findFirst({
            where: {
                id,
                userId: actionSession.userId,
                isReversal: false,
                voidedAt: null,
            },
            select: {
                entityId: true,
            },
        });
        if (!existing?.entityId) {
            return { ok: false, message: "Transaction not found." };
        }

        try {
            await deleteFinanceTransactionWithReversal(
                actionSession.userId,
                existing.entityId,
                actionSession.userId,
                id,
            );
        } catch (error) {
            return {
                ok: false,
                message: error instanceof Error ? error.message : "Could not delete transaction.",
            };
        }

        revalidatePath("/transactions");
        revalidatePath("/dashboard");
        revalidatePath("/budget");
        revalidatePath("/credit");
        revalidatePath("/loan");
        revalidatePath("/wallet");
        return { ok: true, message: "Transaction deleted successfully." };
    };

    const postedAtFilter: Prisma.DateTimeFilter = {};
    const fromDate = parseDateFilter(selectedFromDate);
    const toDate = parseDateFilter(selectedToDate);
    if (fromDate) {
        postedAtFilter.gte = fromDate;
    }
    if (toDate) {
        const nextDate = new Date(toDate);
        nextDate.setDate(nextDate.getDate() + 1);
        postedAtFilter.lt = nextDate;
    }

    const transactionWhere: Prisma.FinanceTransactionWhereInput = {
        userId: session.userId,
        entity: {
            isArchived: false,
        },
        isReversal: false,
        voidedAt: null,
        ...(selectedKind ? { kind: selectedKind as TransactionKind } : {}),
        ...(selectedWalletId
            ? {
                OR: [
                    { walletAccountId: selectedWalletId },
                    { targetWalletAccountId: selectedWalletId },
                ],
            }
            : {}),
        ...(Object.keys(postedAtFilter).length > 0 ? { postedAt: postedAtFilter } : {}),
        ...(searchText
            ? {
                remarks: {
                    contains: searchText,
                    mode: "insensitive",
                },
            }
            : {}),
    };

    const fetchTransactionsPage = async () => {
        try {
            const totalTransactions = await prisma.financeTransaction.count({
                where: transactionWhere,
            });
            const totalPages = Math.max(1, Math.ceil(totalTransactions / TRANSACTIONS_PAGE_SIZE));
            const currentPage = Math.min(requestedPage, totalPages);
            const skip = (currentPage - 1) * TRANSACTIONS_PAGE_SIZE;
            const rows = await prisma.financeTransaction.findMany({
                where: transactionWhere,
                include: {
                    entity: true,
                    walletAccount: true,
                    targetWalletAccount: true,
                    budgetEnvelope: true,
                    incomeStream: true,
                    loanRecord: true,
                },
                orderBy: [{ postedAt: "desc" }, { createdAt: "desc" }],
                skip,
                take: TRANSACTIONS_PAGE_SIZE,
            });

            if (process.env.NODE_ENV !== "test") {
                console.info(JSON.stringify({
                    scope: "finance-query",
                    level: "info",
                    queryType: "transactions-list",
                    entityId: "ALL_ENTITIES",
                    details: {
                        page: currentPage,
                        pageSize: TRANSACTIONS_PAGE_SIZE,
                        totalTransactions,
                    },
                }));
            }

            return {
                rows,
                totalTransactions,
                totalPages,
                currentPage,
            };
        } catch (error) {
            if (process.env.NODE_ENV !== "test") {
                console.error(JSON.stringify({
                    scope: "finance-query",
                    level: "error",
                    queryType: "transactions-list",
                    entityId: "ALL_ENTITIES",
                    error: error instanceof Error ? error.message : "Unknown transactions query error.",
                }));
            }
            throw error;
        }
    };

    const [context, transactionPage, creditAccounts] = await Promise.all([
        getFinanceContextDataAcrossEntities(session.userId),
        fetchTransactionsPage(),
        prisma.creditAccount.findMany({
            where: {
                userId: session.userId,
                isArchived: false,
                entity: {
                    isArchived: false,
                },
            },
            orderBy: { name: "asc" },
        }),
    ]);
    const transactions = transactionPage.rows;

    const walletOptions = context.wallets.map((wallet) => ({
        id: wallet.id,
        plainLabel: wallet.name,
        label: `${wallet.name} (${wallet.entity?.name ?? "Entity"} | ${formatPhp(Number(wallet.currentBalanceAmount))})`,
        type: wallet.type,
    }));
    const budgetOptions = mapBudgetFormOptions(context.budgets);
    const incomeOptions = context.incomes.map((income) => ({
        id: income.id,
        label: `${income.name} (${income.entity?.name ?? "Entity"})`,
    }));
    const loanOptions = context.loans.map((loan) => ({
        id: loan.id,
        label: `${loan.itemName} (${loan.entity?.name ?? "Entity"} | ${formatPhp(Number(loan.remainingPhp))})`,
    }));
    const creditOptions = creditAccounts.map((credit) => ({
        id: `credit:${credit.id}`,
        label: `${credit.name} (${formatPhp(Number(credit.creditLimitAmount) - Number(credit.currentBalanceAmount))} remaining)`,
    }));
    const transactionRows = transactions.map((tx) => ({
        id: tx.id,
        entityName: tx.entity?.name ?? "-",
        postedAt: tx.postedAt.toISOString().slice(0, 10),
        kind: tx.kind,
        amountPhp: Number(tx.amountPhp),
        walletAccountId: tx.walletAccountId,
        walletName: tx.walletAccount.name,
        targetWalletAccountId: tx.targetWalletAccountId,
        targetWalletName: tx.targetWalletAccount?.name ?? null,
        budgetEnvelopeId: tx.budgetEnvelopeId,
        budgetName: tx.budgetEnvelope?.name ?? null,
        incomeStreamId: tx.incomeStreamId,
        incomeName: tx.incomeStream?.name ?? null,
        loanRecordId: tx.loanRecordId,
        loanName: tx.loanRecord?.itemName ?? null,
        remarks: tx.remarks,
    }));
    const makePageHref = (page: number) => {
        const params = new URLSearchParams();
        if (selectedKind) {
            params.set("kind", selectedKind);
        }
        if (selectedWalletId) {
            params.set("wallet", selectedWalletId);
        }
        if (searchText) {
            params.set("q", searchText);
        }
        if (selectedFromDate) {
            params.set("from", selectedFromDate);
        }
        if (selectedToDate) {
            params.set("to", selectedToDate);
        }
        params.set("page", String(page));
        return `/transactions?${params.toString()}`;
    };
    const hasPreviousPage = transactionPage.currentPage > 1;
    const hasNextPage = transactionPage.currentPage < transactionPage.totalPages;

    return (
        <section className="d-grid gap-4">
            <header className="d-grid gap-2">
                <p className="m-0 text-uppercase small" style={{ letterSpacing: "0.3em", color: "var(--color-kicker-primary)" }}>Ledger</p>
                <h2 className="m-0 fs-2 fw-semibold" style={{ color: "var(--color-text-strong)" }}>Transactions</h2>
                <p className="m-0 small" style={{ color: "var(--color-text-muted)" }}>
                    Unified ledger across all entities with wallet, budget envelope, and transaction type tracking.
                </p>
            </header>

            <div className="d-flex justify-content-end">
                <AddTransactionModal
                    wallets={walletOptions}
                    creditAccounts={creditOptions}
                    budgets={budgetOptions}
                    incomeStreams={incomeOptions}
                    loanRecords={loanOptions}
                    postTransactionAction={postTransactionAction}
                />
            </div>

            <Card className="pf-surface-panel">
                <CardBody className="d-grid gap-2">
                    <h3 className="m-0 fs-6 fw-semibold" style={{ color: "var(--color-text-strong)" }}>
                        Filters
                    </h3>
                    <form method="GET" className="row g-2 align-items-end">
                        <div className="col-12 col-md-3">
                            <label htmlFor="filter-kind" className="small fw-semibold mb-1">Kind</label>
                            <select id="filter-kind" name="kind" className="form-control form-control-sm" defaultValue={selectedKind}>
                                <option value="">All</option>
                                {Object.values(TransactionKind).map((kind) => (
                                    <option key={kind} value={kind}>{kind}</option>
                                ))}
                            </select>
                        </div>
                        <div className="col-12 col-md-3">
                            <label htmlFor="filter-wallet" className="small fw-semibold mb-1">Wallet</label>
                            <select id="filter-wallet" name="wallet" className="form-control form-control-sm" defaultValue={selectedWalletId}>
                                <option value="">All</option>
                                {context.wallets.map((wallet) => (
                                    <option key={wallet.id} value={wallet.id}>{`${wallet.name} (${wallet.entity?.name ?? "Entity"})`}</option>
                                ))}
                            </select>
                        </div>
                        <div className="col-12 col-md-4">
                            <label htmlFor="filter-q" className="small fw-semibold mb-1">Remarks Search</label>
                            <input id="filter-q" type="text" name="q" className="form-control form-control-sm" defaultValue={searchText} />
                        </div>
                        <div className="col-12 col-md-2">
                            <label htmlFor="filter-from" className="small fw-semibold mb-1">From</label>
                            <input id="filter-from" type="date" name="from" className="form-control form-control-sm" defaultValue={selectedFromDate} />
                        </div>
                        <div className="col-12 col-md-2">
                            <label htmlFor="filter-to" className="small fw-semibold mb-1">To</label>
                            <input id="filter-to" type="date" name="to" className="form-control form-control-sm" defaultValue={selectedToDate} />
                        </div>
                        <div className="col-12 col-md-2 d-flex gap-2">
                            <Button type="submit" variant="primary" size="sm">Apply</Button>
                            <Button type="button" variant="outline-secondary" href="/transactions" size="sm">Reset</Button>
                        </div>
                    </form>
                </CardBody>
            </Card>

            <TransactionsTable
                transactions={transactionRows}
                wallets={walletOptions}
                budgets={budgetOptions}
                incomeStreams={incomeOptions}
                loanRecords={loanOptions}
                updateTransactionAction={updateTransactionAction}
                deleteTransactionAction={deleteTransactionAction}
            />

            <Card className="pf-surface-panel">
                <CardBody className="d-flex flex-wrap align-items-center justify-content-between gap-3">
                    <p className="m-0 small" style={{ color: "var(--color-text-muted)" }}>
                        Page {transactionPage.currentPage} of {transactionPage.totalPages} ({transactionPage.totalTransactions} total transactions)
                    </p>
                    <div className="d-flex gap-2">
                        <Button
                            type="button"
                            variant="outline-secondary"
                            size="sm"
                            disabled={!hasPreviousPage}
                            href={hasPreviousPage ? makePageHref(transactionPage.currentPage - 1) : undefined}
                        >
                            Previous
                        </Button>
                        <Button
                            type="button"
                            variant="outline-secondary"
                            size="sm"
                            disabled={!hasNextPage}
                            href={hasNextPage ? makePageHref(transactionPage.currentPage + 1) : undefined}
                        >
                            Next
                        </Button>
                    </div>
                </CardBody>
            </Card>
        </section>
    );
}
