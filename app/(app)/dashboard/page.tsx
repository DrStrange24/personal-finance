import { TransactionKind } from "@prisma/client";
import { revalidatePath } from "next/cache";
import Card from "react-bootstrap/Card";
import CardBody from "react-bootstrap/CardBody";
import Table from "react-bootstrap/Table";
import MetricCard from "@/app/components/finance/metric-card";
import TransactionForm from "@/app/components/finance/transaction-form";
import TransactionKindBadge from "@/app/components/finance/transaction-kind-badge";
import WorkbookImportCard from "@/app/components/finance/import-workbook-card";
import { ensureFinanceBootstrap } from "@/lib/finance/bootstrap";
import { getFinanceContextData } from "@/lib/finance/context";
import { parseTransactionForm } from "@/lib/finance/form-parsers";
import { formatPhp } from "@/lib/finance/money";
import { postFinanceTransaction } from "@/lib/finance/posting-engine";
import { getDashboardSummary } from "@/lib/finance/queries";
import type { FinanceActionResult } from "@/lib/finance/types";
import { getAuthenticatedSession } from "@/lib/server-session";
import { prisma } from "@/lib/prisma";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
});

export default async function DashboardPage() {
    const session = await getAuthenticatedSession();
    await ensureFinanceBootstrap(session.userId);

    const createTransactionAction = async (formData: FormData) => {
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
            await ensureFinanceBootstrap(actionSession.userId);
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

        revalidatePath("/dashboard");
        revalidatePath("/transactions");
        revalidatePath("/budget");
        revalidatePath("/loan");
        revalidatePath("/wallet");
        return { ok: true, message: "Transaction posted successfully." } satisfies FinanceActionResult;
    };

    const [summary, context, recentTransactions, creditCards] = await Promise.all([
        getDashboardSummary(session.userId),
        getFinanceContextData(session.userId),
        prisma.financeTransaction.findMany({
            where: { userId: session.userId },
            include: {
                walletAccount: true,
                targetWalletAccount: true,
                budgetEnvelope: true,
            },
            orderBy: [{ postedAt: "desc" }, { createdAt: "desc" }],
            take: 12,
        }),
        prisma.walletAccount.findMany({
            where: {
                userId: session.userId,
                isArchived: false,
                type: "CREDIT_CARD",
            },
            orderBy: { name: "asc" },
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
    const targetWalletOptions = context.wallets.map((wallet) => ({
        id: wallet.id,
        label: wallet.name,
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
                <p className="m-0 text-uppercase small" style={{ letterSpacing: "0.3em", color: "var(--color-kicker-primary)" }}>Main Page</p>
                <h2 className="m-0 fs-2 fw-semibold" style={{ color: "var(--color-text-strong)" }}>Dashboard</h2>
                <p className="m-0 small" style={{ color: "var(--color-text-muted)" }}>
                    Quick post flow for income, expenses, transfers, credit card movements, and loan movements.
                </p>
            </header>

            <div className="d-grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                <MetricCard label="Wallet Balance" value={formatPhp(summary.totalWalletBalancePhp)} />
                <MetricCard label="Credit Card Debt" value={formatPhp(summary.totalCreditCardDebtPhp)} />
                <MetricCard label="Net Position" value={formatPhp(summary.netPositionPhp)} />
                <MetricCard label="Budget Available" value={formatPhp(summary.budgetAvailablePhp)} />
                <MetricCard label="Month Income" value={formatPhp(summary.monthIncomePhp)} />
                <MetricCard label="Month Expense" value={formatPhp(summary.monthExpensePhp)} />
                <MetricCard label="Month Net Cashflow" value={formatPhp(summary.monthNetCashflowPhp)} />
            </div>

            <div className="d-grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
                <TransactionForm
                    submitAction={createTransactionAction}
                    wallets={walletOptions}
                    budgets={budgetOptions}
                    targetWallets={targetWalletOptions}
                    incomeStreams={incomeOptions}
                    loanRecords={loanOptions}
                    includeKindSelect
                    title="Quick Transaction"
                    submitLabel="Post Transaction"
                />
                <WorkbookImportCard />
            </div>

            <Card className="pf-surface-panel">
                <CardBody className="d-grid gap-3">
                    <h3 className="m-0 fs-6 fw-semibold" style={{ color: "var(--color-text-strong)" }}>
                        Recent Transactions
                    </h3>
                    <div className="table-responsive">
                        <Table hover className="align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Kind</th>
                                    <th>Amount</th>
                                    <th>Wallet</th>
                                    <th>Budget</th>
                                    <th>Remarks</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentTransactions.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center py-4" style={{ color: "var(--color-text-muted)" }}>
                                            No transactions yet.
                                        </td>
                                    </tr>
                                ) : (
                                    recentTransactions.map((transaction) => {
                                        const negativeKinds = new Set<TransactionKind>([
                                            "EXPENSE",
                                            "BUDGET_ALLOCATION",
                                            "CREDIT_CARD_PAYMENT",
                                            "LOAN_REPAY",
                                        ]);
                                        const signedAmount = negativeKinds.has(transaction.kind)
                                            ? -Math.abs(Number(transaction.amountPhp))
                                            : Math.abs(Number(transaction.amountPhp));
                                        const amountLabel = signedAmount < 0
                                            ? `(${formatPhp(Math.abs(signedAmount))})`
                                            : formatPhp(signedAmount);
                                        return (
                                            <tr key={transaction.id}>
                                                <td>{dateFormatter.format(transaction.postedAt)}</td>
                                                <td><TransactionKindBadge kind={transaction.kind} /></td>
                                                <td className={signedAmount < 0 ? "text-danger" : "text-success"}>{amountLabel}</td>
                                                <td>{transaction.walletAccount.name}</td>
                                                <td>{transaction.budgetEnvelope?.name ?? "-"}</td>
                                                <td>{transaction.remarks?.trim() || "-"}</td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </Table>
                    </div>
                </CardBody>
            </Card>

            <Card className="pf-surface-panel">
                <CardBody className="d-grid gap-2">
                    <h3 className="m-0 fs-6 fw-semibold" style={{ color: "var(--color-text-strong)" }}>
                        Credit Cards
                    </h3>
                    {creditCards.length === 0 ? (
                        <p className="m-0 small" style={{ color: "var(--color-text-muted)" }}>
                            No credit card account yet. Add one in Wallet Accounts and use Credit Card Charge/Payment transactions.
                        </p>
                    ) : (
                        <div className="d-grid gap-2">
                            {creditCards.map((card) => (
                                <div key={card.id} className="d-flex justify-content-between align-items-center border rounded px-3 py-2">
                                    <div>
                                        <p className="m-0 fw-semibold">{card.name}</p>
                                        <p className="m-0 small" style={{ color: "var(--color-text-muted)" }}>
                                            Statement day: {card.statementClosingDay ?? "-"} | Due day: {card.statementDueDay ?? "-"}
                                        </p>
                                    </div>
                                    <p className="m-0 fw-semibold text-danger">{formatPhp(Number(card.currentBalancePhp))}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </CardBody>
            </Card>
        </section>
    );
}
