import { TransactionKind } from "@prisma/client";
import { revalidatePath } from "next/cache";
import Button from "react-bootstrap/Button";
import Card from "react-bootstrap/Card";
import CardBody from "react-bootstrap/CardBody";
import Table from "react-bootstrap/Table";
import ConfirmSubmitButton from "@/app/components/confirm-submit-button";
import TransactionForm from "@/app/components/finance/transaction-form";
import TransactionKindBadge from "@/app/components/finance/transaction-kind-badge";
import { ensureFinanceBootstrap } from "@/lib/finance/bootstrap";
import { getFinanceContextData } from "@/lib/finance/context";
import { parseTransactionForm } from "@/lib/finance/form-parsers";
import { formatPhp } from "@/lib/finance/money";
import { deleteFinanceTransactionWithReversal, postFinanceTransaction } from "@/lib/finance/posting-engine";
import type { FinanceActionResult } from "@/lib/finance/types";
import { getAuthenticatedSession } from "@/lib/server-session";
import { prisma } from "@/lib/prisma";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
});

const negativeKinds = new Set<TransactionKind>([
    "EXPENSE",
    "BUDGET_ALLOCATION",
    "CREDIT_CARD_PAYMENT",
    "LOAN_REPAY",
]);

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

    const postTransactionAction = async (formData: FormData) => {
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
            return { ok: false, message: "Please provide valid transaction details." } satisfies FinanceActionResult;
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
            } satisfies FinanceActionResult;
        }

        revalidatePath("/transactions");
        revalidatePath("/dashboard");
        revalidatePath("/budget");
        return { ok: true, message: "Transaction posted successfully." } satisfies FinanceActionResult;
    };

    const deleteTransactionAction = async (formData: FormData) => {
        "use server";

        const actionSession = await getAuthenticatedSession();
        const id = typeof formData.get("id") === "string" ? String(formData.get("id")).trim() : "";
        if (!id) {
            return;
        }

        try {
            await deleteFinanceTransactionWithReversal(actionSession.userId, id);
        } catch {
            return;
        }

        revalidatePath("/transactions");
        revalidatePath("/dashboard");
        revalidatePath("/budget");
        revalidatePath("/loan");
        revalidatePath("/wallet");
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
        label: `${wallet.name} (${formatPhp(Number(wallet.currentBalancePhp))})`,
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

    return (
        <section className="d-grid gap-4">
            <header className="d-grid gap-2">
                <p className="m-0 text-uppercase small" style={{ letterSpacing: "0.3em", color: "var(--color-kicker-primary)" }}>Ledger</p>
                <h2 className="m-0 fs-2 fw-semibold" style={{ color: "var(--color-text-strong)" }}>Transactions</h2>
                <p className="m-0 small" style={{ color: "var(--color-text-muted)" }}>
                    Unified ledger with wallet, budget envelope, and transaction type tracking.
                </p>
            </header>

            <div className="d-grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
                <TransactionForm
                    submitAction={postTransactionAction}
                    wallets={walletOptions}
                    budgets={budgetOptions}
                    targetWallets={walletOptions}
                    incomeStreams={incomeOptions}
                    loanRecords={loanOptions}
                    includeKindSelect
                    title="Post Ledger Entry"
                    submitLabel="Post Entry"
                />

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
            </div>

            <Card className="pf-surface-panel">
                <CardBody className="d-grid gap-3">
                    <div className="table-responsive">
                        <Table hover className="align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Kind</th>
                                    <th>Amount</th>
                                    <th>Wallet</th>
                                    <th>Target</th>
                                    <th>Budget</th>
                                    <th>Income</th>
                                    <th>Loan</th>
                                    <th>Remarks</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.length === 0 ? (
                                    <tr>
                                        <td colSpan={10} className="text-center py-4" style={{ color: "var(--color-text-muted)" }}>
                                            No transactions found.
                                        </td>
                                    </tr>
                                ) : (
                                    transactions.map((tx) => {
                                        const signed = negativeKinds.has(tx.kind)
                                            ? -Math.abs(Number(tx.amountPhp))
                                            : Math.abs(Number(tx.amountPhp));
                                        const amountLabel = signed < 0
                                            ? `(${formatPhp(Math.abs(signed))})`
                                            : formatPhp(signed);
                                        return (
                                            <tr key={tx.id}>
                                                <td>{dateFormatter.format(tx.postedAt)}</td>
                                                <td><TransactionKindBadge kind={tx.kind} /></td>
                                                <td className={signed < 0 ? "text-danger" : "text-success"}>{amountLabel}</td>
                                                <td>{tx.walletAccount.name}</td>
                                                <td>{tx.targetWalletAccount?.name ?? "-"}</td>
                                                <td>{tx.budgetEnvelope?.name ?? "-"}</td>
                                                <td>{tx.incomeStream?.name ?? "-"}</td>
                                                <td>{tx.loanRecord?.itemName ?? "-"}</td>
                                                <td>{tx.remarks?.trim() || "-"}</td>
                                                <td>
                                                    <form action={deleteTransactionAction}>
                                                        <input type="hidden" name="id" value={tx.id} />
                                                        <ConfirmSubmitButton
                                                            type="submit"
                                                            size="sm"
                                                            variant="outline-danger"
                                                            confirmTitle="Delete Transaction"
                                                            confirmMessage="Delete this transaction? This will create reversal effects in linked balances."
                                                        >
                                                            Delete
                                                        </ConfirmSubmitButton>
                                                    </form>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </Table>
                    </div>
                </CardBody>
            </Card>
        </section>
    );
}
