import { TransactionKind } from "@prisma/client";
import { revalidatePath } from "next/cache";
import Button from "react-bootstrap/Button";
import Card from "react-bootstrap/Card";
import CardBody from "react-bootstrap/CardBody";
import AddTransactionModal from "./add-transaction-modal";
import TransactionsTable from "./transactions-table";
import { ensureFinanceBootstrap } from "@/lib/finance/bootstrap";
import { getFinanceContextData } from "@/lib/finance/context";
import { parseTransactionForm } from "@/lib/finance/form-parsers";
import { formatPhp } from "@/lib/finance/money";
import { deleteFinanceTransactionWithReversal, postFinanceTransaction } from "@/lib/finance/posting-engine";
import type { FinanceActionResult } from "@/lib/finance/types";
import { getAuthenticatedSession } from "@/lib/server-session";
import { prisma } from "@/lib/prisma";

type TransactionsPageProps = {
    searchParams?: Promise<{
        kind?: string;
        wallet?: string;
        q?: string;
    }>;
};

export default async function TransactionsPage({ searchParams }: TransactionsPageProps) {
    const session = await getAuthenticatedSession();
    await ensureFinanceBootstrap(session.userId);
    const params = (await searchParams) ?? {};
    const selectedKind = typeof params.kind === "string" ? params.kind.trim() : "";
    const selectedWalletId = typeof params.wallet === "string" ? params.wallet.trim() : "";
    const searchText = typeof params.q === "string" ? params.q.trim() : "";

    const postTransactionAction = async (formData: FormData): Promise<FinanceActionResult> => {
        "use server";

        const actionSession = await getAuthenticatedSession();
        const parsed = parseTransactionForm(formData);

        if (
            !parsed.ok
            || !parsed.kind
            || !parsed.postedAt
            || parsed.amountPhp === null
            || !parsed.walletAccountId
        ) {
            return { ok: false, message: "Please provide valid transaction details." };
        }

        try {
            await postFinanceTransaction({
                userId: actionSession.userId,
                kind: parsed.kind,
                postedAt: parsed.postedAt,
                amountPhp: parsed.amountPhp,
                walletAccountId: parsed.walletAccountId,
                budgetEnvelopeId: parsed.budgetEnvelopeId,
                targetWalletAccountId: parsed.targetWalletAccountId,
                incomeStreamId: parsed.incomeStreamId,
                loanRecordId: parsed.loanRecordId,
                remarks: parsed.remarks,
            });
        } catch (error) {
            return {
                ok: false,
                message: error instanceof Error ? error.message : "Could not post transaction.",
            };
        }

        revalidatePath("/transactions");
        revalidatePath("/dashboard");
        revalidatePath("/budget");
        return { ok: true, message: "Transaction posted successfully." };
    };

    const updateTransactionAction = async (formData: FormData): Promise<FinanceActionResult> => {
        "use server";

        const actionSession = await getAuthenticatedSession();
        const oldTransactionId = typeof formData.get("id") === "string" ? String(formData.get("id")).trim() : "";
        if (!oldTransactionId) {
            return { ok: false, message: "Missing transaction id." };
        }

        const parsed = parseTransactionForm(formData);
        if (
            !parsed.ok
            || !parsed.kind
            || !parsed.postedAt
            || parsed.amountPhp === null
            || !parsed.walletAccountId
        ) {
            return { ok: false, message: "Please provide valid transaction details." };
        }

        let createdTransactionId: string | null = null;
        try {
            const created = await postFinanceTransaction({
                userId: actionSession.userId,
                kind: parsed.kind,
                postedAt: parsed.postedAt,
                amountPhp: parsed.amountPhp,
                walletAccountId: parsed.walletAccountId,
                budgetEnvelopeId: parsed.budgetEnvelopeId,
                targetWalletAccountId: parsed.targetWalletAccountId,
                incomeStreamId: parsed.incomeStreamId,
                loanRecordId: parsed.loanRecordId,
                remarks: parsed.remarks,
            });
            createdTransactionId = created.id;

            await deleteFinanceTransactionWithReversal(actionSession.userId, oldTransactionId);
        } catch (error) {
            if (createdTransactionId) {
                try {
                    await deleteFinanceTransactionWithReversal(actionSession.userId, createdTransactionId);
                } catch {
                    return { ok: false, message: "Update failed and could not fully roll back. Please review balances." };
                }
            }
            return {
                ok: false,
                message: error instanceof Error ? error.message : "Could not update transaction.",
            };
        }

        revalidatePath("/transactions");
        revalidatePath("/dashboard");
        revalidatePath("/budget");
        revalidatePath("/loan");
        revalidatePath("/wallet");
        return { ok: true, message: "Transaction updated successfully." };
    };

    const deleteTransactionAction = async (formData: FormData): Promise<FinanceActionResult> => {
        "use server";

        const actionSession = await getAuthenticatedSession();
        const id = typeof formData.get("id") === "string" ? String(formData.get("id")).trim() : "";
        if (!id) {
            return { ok: false, message: "Missing transaction id." };
        }

        try {
            await deleteFinanceTransactionWithReversal(actionSession.userId, id);
        } catch (error) {
            return {
                ok: false,
                message: error instanceof Error ? error.message : "Could not delete transaction.",
            };
        }

        revalidatePath("/transactions");
        revalidatePath("/dashboard");
        revalidatePath("/budget");
        revalidatePath("/loan");
        revalidatePath("/wallet");
        return { ok: true, message: "Transaction deleted successfully." };
    };

    const [context, transactions] = await Promise.all([
        getFinanceContextData(session.userId),
        prisma.financeTransaction.findMany({
            where: {
                userId: session.userId,
                ...(selectedKind ? { kind: selectedKind as TransactionKind } : {}),
                ...(selectedWalletId ? { walletAccountId: selectedWalletId } : {}),
                ...(searchText
                    ? {
                        remarks: {
                            contains: searchText,
                            mode: "insensitive",
                        },
                    }
                    : {}),
            },
            include: {
                walletAccount: true,
                targetWalletAccount: true,
                budgetEnvelope: true,
                incomeStream: true,
                loanRecord: true,
            },
            orderBy: [{ postedAt: "desc" }, { createdAt: "desc" }],
            take: 200,
        }),
    ]);

    const walletOptions = context.wallets.map((wallet) => ({
        id: wallet.id,
        label: `${wallet.name} (${formatPhp(Number(wallet.currentBalanceAmount))})`,
    }));
    const budgetOptions = context.budgets.map((budget) => ({
        id: budget.id,
        label: `${budget.name} (${formatPhp(Number(budget.availablePhp))})`,
    }));
    const incomeOptions = context.incomes.map((income) => ({
        id: income.id,
        label: income.name,
    }));
    const loanOptions = context.loans.map((loan) => ({
        id: loan.id,
        label: `${loan.itemName} (${formatPhp(Number(loan.remainingPhp))})`,
    }));
    const transactionRows = transactions.map((tx) => ({
        id: tx.id,
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

    return (
        <section className="d-grid gap-4">
            <header className="d-grid gap-2">
                <p className="m-0 text-uppercase small" style={{ letterSpacing: "0.3em", color: "var(--color-kicker-primary)" }}>Ledger</p>
                <h2 className="m-0 fs-2 fw-semibold" style={{ color: "var(--color-text-strong)" }}>Transactions</h2>
                <p className="m-0 small" style={{ color: "var(--color-text-muted)" }}>
                    Unified ledger with wallet, budget envelope, and transaction type tracking.
                </p>
            </header>

            <div className="d-flex justify-content-end">
                <AddTransactionModal
                    wallets={walletOptions}
                    budgets={budgetOptions}
                    incomeStreams={incomeOptions}
                    loanRecords={loanOptions}
                    postTransactionAction={postTransactionAction}
                />
            </div>

            <Card className="pf-surface-panel">
                <CardBody className="d-grid gap-3">
                    <h3 className="m-0 fs-6 fw-semibold" style={{ color: "var(--color-text-strong)" }}>
                        Filters
                    </h3>
                    <form method="GET" className="d-grid gap-3">
                        <div className="d-grid gap-1">
                            <label htmlFor="filter-kind" className="small fw-semibold">Kind</label>
                            <select id="filter-kind" name="kind" className="form-control" defaultValue={selectedKind}>
                                <option value="">All</option>
                                {Object.values(TransactionKind).map((kind) => (
                                    <option key={kind} value={kind}>{kind}</option>
                                ))}
                            </select>
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="filter-wallet" className="small fw-semibold">Wallet</label>
                            <select id="filter-wallet" name="wallet" className="form-control" defaultValue={selectedWalletId}>
                                <option value="">All</option>
                                {context.wallets.map((wallet) => (
                                    <option key={wallet.id} value={wallet.id}>{wallet.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="filter-q" className="small fw-semibold">Remarks Search</label>
                            <input id="filter-q" type="text" name="q" className="form-control" defaultValue={searchText} />
                        </div>
                        <div className="d-flex gap-2">
                            <Button type="submit" variant="primary">Apply</Button>
                            <Button type="button" variant="outline-secondary" href="/transactions">Reset</Button>
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
        </section>
    );
}

