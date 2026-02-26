import { TransactionKind } from "@prisma/client";
import { revalidatePath } from "next/cache";
import Card from "react-bootstrap/Card";
import CardBody from "react-bootstrap/CardBody";
import Table from "react-bootstrap/Table";
import AddTransactionModal from "@/app/(app)/transactions/add-transaction-modal";
import MetricCard from "@/app/components/finance/metric-card";
import TransactionKindBadge from "@/app/components/finance/transaction-kind-badge";
import { ensureFinanceBootstrap } from "@/lib/finance/bootstrap";
import { getFinanceContextData } from "@/lib/finance/context";
import { mapBudgetFormOptions } from "@/lib/finance/form-options";
import { formatPhp } from "@/lib/finance/money";
import { postTransactionFromFormData } from "@/lib/finance/transaction-orchestration";
import { getDashboardSummary } from "@/lib/finance/queries";
import type { FinanceActionResult } from "@/lib/finance/types";
import { getAuthenticatedEntitySession } from "@/lib/server-session";
import { prisma } from "@/lib/prisma";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
});

export default async function DashboardPage() {
    const session = await getAuthenticatedEntitySession();
    const activeEntityId = session.activeEntity.id;
    await ensureFinanceBootstrap(session.userId, activeEntityId);

    const createTransactionAction = async (formData: FormData) => {
        "use server";

        const actionSession = await getAuthenticatedEntitySession();
        const result = await postTransactionFromFormData({
            userId: actionSession.userId,
            entityId: actionSession.activeEntity.id,
            actorUserId: actionSession.userId,
            formData,
        });
        if (!result.ok) {
            return result satisfies FinanceActionResult;
        }

        revalidatePath("/");
        revalidatePath("/dashboard");
        revalidatePath("/transactions");
        revalidatePath("/budget");
        revalidatePath("/loan");
        revalidatePath("/wallet");
        return { ok: true, message: "Transaction posted successfully." } satisfies FinanceActionResult;
    };

    const [summary, context, recentTransactions, creditAccounts] = await Promise.all([
        getDashboardSummary(session.userId, activeEntityId),
        getFinanceContextData(session.userId, activeEntityId),
        prisma.financeTransaction.findMany({
            where: {
                userId: session.userId,
                entityId: activeEntityId,
                isReversal: false,
                voidedAt: null,
            },
            include: {
                walletAccount: true,
                targetWalletAccount: true,
                budgetEnvelope: true,
            },
            orderBy: [{ postedAt: "desc" }, { createdAt: "desc" }],
            take: 12,
        }),
        prisma.creditAccount.findMany({
            where: {
                userId: session.userId,
                isArchived: false,
            },
            orderBy: { name: "asc" },
        }),
    ]);

    const walletOptions = context.wallets.map((wallet) => ({
        id: wallet.id,
        plainLabel: wallet.name,
        label: `${wallet.name} (${formatPhp(Number(wallet.currentBalanceAmount))})`,
        type: wallet.type,
    }));
    const budgetOptions = mapBudgetFormOptions(context.budgets);
    const incomeOptions = context.incomes.map((income) => ({
        id: income.id,
        label: income.name,
    }));
    const loanOptions = context.loans.map((loan) => ({
        id: loan.id,
        label: `${loan.itemName} (${formatPhp(Number(loan.remainingPhp))})`,
    }));
    const creditOptions = creditAccounts.map((credit) => ({
        id: `credit:${credit.id}`,
        label: `${credit.name} (${formatPhp(Number(credit.creditLimitAmount) - Number(credit.currentBalanceAmount))} remaining)`,
    }));

    return (
        <section className="d-grid gap-4">
            <header className="d-flex flex-wrap align-items-start justify-content-between gap-3">
                <div className="d-grid gap-2">
                    <p className="m-0 text-uppercase small" style={{ letterSpacing: "0.3em", color: "var(--color-kicker-primary)" }}>Main Page</p>
                    <h2 className="m-0 fs-2 fw-semibold" style={{ color: "var(--color-text-strong)" }}>Dashboard</h2>
                    <p className="m-0 small" style={{ color: "var(--color-text-muted)" }}>
                        Quick post flow for income, expenses, transfers, credit card movements, and loan movements.
                    </p>
                </div>
                <AddTransactionModal
                    wallets={walletOptions}
                    creditAccounts={creditOptions}
                    budgets={budgetOptions}
                    incomeStreams={incomeOptions}
                    loanRecords={loanOptions}
                    postTransactionAction={createTransactionAction}
                />
            </header>

            <div className="d-grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                <MetricCard label="Total Assets" value={formatPhp(summary.totalAssetsPhp)} />
                <MetricCard label="Total Investment" value={formatPhp(summary.totalInvestmentPhp)} />
                <MetricCard label="Wallet Balance" value={formatPhp(summary.totalWalletBalancePhp)} />
                <MetricCard label="Allocated Budget" value={formatPhp(summary.budgetAvailablePhp)} />
                <MetricCard label="Credit Card Debt" value={formatPhp(summary.totalCreditCardDebtPhp)} />
                <MetricCard label="Unallocated Budget" value={formatPhp(summary.unallocatedCashPhp)} />
                <MetricCard label="Total Monthly Income" value={formatPhp(summary.monthlyTotalIncomePhp)} />
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
        </section>
    );
}
