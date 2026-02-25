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
import { parseIncomeDistributionForm, parseTransactionForm } from "@/lib/finance/form-parsers";
import { formatPhp } from "@/lib/finance/money";
import { deleteFinanceTransactionWithReversal, postFinanceTransaction } from "@/lib/finance/posting-engine";
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
            let sourceWalletAccountId = parsed.walletAccountId;
            if (sourceWalletAccountId.startsWith("credit:")) {
                const creditId = sourceWalletAccountId.slice("credit:".length);
                const creditAccount = await prisma.creditAccount.findFirst({
                    where: {
                        id: creditId,
                        userId: actionSession.userId,
                        isArchived: false,
                    },
                });

                if (!creditAccount) {
                    return { ok: false, message: "Credit account not found." } satisfies FinanceActionResult;
                }

                const existingCreditWallet = await prisma.walletAccount.findFirst({
                    where: {
                        userId: actionSession.userId,
                        isArchived: false,
                        type: "CREDIT_CARD",
                        name: creditAccount.name,
                    },
                });

                if (existingCreditWallet) {
                    sourceWalletAccountId = existingCreditWallet.id;
                } else {
                    const createdWallet = await prisma.walletAccount.create({
                        data: {
                            userId: actionSession.userId,
                            name: creditAccount.name,
                            type: "CREDIT_CARD",
                            currentBalanceAmount: creditAccount.currentBalanceAmount,
                        },
                    });
                    sourceWalletAccountId = createdWallet.id;
                }
            }

            if (parsed.kind === TransactionKind.INCOME) {
                const distribution = parseIncomeDistributionForm(formData);
                if (!distribution.ok) {
                    return {
                        ok: false,
                        message: "Income distribution is invalid. Please provide unique budgets and valid amounts.",
                    } satisfies FinanceActionResult;
                }

                if (Math.abs(distribution.totalAmountPhp - parsed.amountPhp) > 0.009) {
                    return {
                        ok: false,
                        message: "Income distribution total must match the income amount.",
                    } satisfies FinanceActionResult;
                }

                const createdIds: string[] = [];
                try {
                    for (const row of distribution.rows) {
                        const created = await postFinanceTransaction({
                            userId: actionSession.userId,
                            kind: parsed.kind,
                            postedAt: parsed.postedAt,
                            amountPhp: row.amountPhp,
                            walletAccountId: sourceWalletAccountId,
                            budgetEnvelopeId: row.budgetEnvelopeId,
                            targetWalletAccountId: parsed.targetWalletAccountId,
                            incomeStreamId: parsed.incomeStreamId,
                            loanRecordId: parsed.loanRecordId,
                            remarks: parsed.remarks,
                        });
                        createdIds.push(created.id);
                    }
                } catch (error) {
                    for (const createdId of createdIds) {
                        try {
                            await deleteFinanceTransactionWithReversal(actionSession.userId, createdId);
                        } catch {
                            return {
                                ok: false,
                                message: "Income posting failed and could not fully roll back. Please review balances.",
                            } satisfies FinanceActionResult;
                        }
                    }
                    throw error;
                }
            } else {
                await postFinanceTransaction({
                    userId: actionSession.userId,
                    kind: parsed.kind,
                    postedAt: parsed.postedAt,
                    amountPhp: parsed.amountPhp,
                    walletAccountId: sourceWalletAccountId,
                    budgetEnvelopeId: parsed.budgetEnvelopeId,
                    targetWalletAccountId: parsed.targetWalletAccountId,
                    incomeStreamId: parsed.incomeStreamId,
                    loanRecordId: parsed.loanRecordId,
                    remarks: parsed.remarks,
                });
            }
        } catch (error) {
            return {
                ok: false,
                message: error instanceof Error ? error.message : "Could not post transaction.",
            } satisfies FinanceActionResult;
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
        label: `${wallet.name} (${formatPhp(Number(wallet.currentBalanceAmount))})`,
        type: wallet.type,
    }));
    const budgetOptions = context.budgets
        .filter((budget) => !budget.isSystem)
        .map((budget) => ({
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
