import { TransactionKind } from "@prisma/client";
import { revalidatePath } from "next/cache";
import Card from "react-bootstrap/Card";
import CardBody from "react-bootstrap/CardBody";
import AddTransactionModal from "@/app/(app)/transactions/add-transaction-modal";
import RecentTransactionsTable from "@/app/(app)/dashboard/recent-transactions-table";
import ToggleableMetricCardGrid from "@/app/components/finance/toggleable-metric-card-grid";
import { ensureFinanceBootstrap } from "@/lib/finance/bootstrap";
import { getFinanceContextDataAcrossEntities } from "@/lib/finance/context";
import { mapBudgetFormOptions } from "@/lib/finance/form-options";
import { formatPhp } from "@/lib/finance/money";
import {
    postTransactionFromFormData,
    resolvePostingEntityIdFromFormData,
} from "@/lib/finance/transaction-orchestration";
import { getDashboardSummaryAcrossEntities } from "@/lib/finance/queries";
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
    await Promise.all(session.entities.map((entity) => ensureFinanceBootstrap(session.userId, entity.id)));

    const createTransactionAction = async (formData: FormData) => {
        "use server";

        const actionSession = await getAuthenticatedEntitySession();
        const entityResolution = await resolvePostingEntityIdFromFormData({
            userId: actionSession.userId,
            formData,
        });
        if (!entityResolution.ok || !entityResolution.entityId) {
            return entityResolution;
        }

        const result = await postTransactionFromFormData({
            userId: actionSession.userId,
            entityId: entityResolution.entityId,
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
        revalidatePath("/credit");
        revalidatePath("/loan");
        revalidatePath("/wallet");
        return { ok: true, message: "Transaction posted successfully." } satisfies FinanceActionResult;
    };

    const [summaryResult, context, recentTransactions, creditAccounts] = await Promise.all([
        getDashboardSummaryAcrossEntities(session.userId)
            .then((data) => ({ ok: true as const, data }))
            .catch((error) => ({ ok: false as const, error })),
        getFinanceContextDataAcrossEntities(session.userId),
        prisma.financeTransaction.findMany({
            where: {
                userId: session.userId,
                entity: {
                    isArchived: false,
                },
                isReversal: false,
                voidedAt: null,
            },
            include: {
                entity: true,
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
                entity: {
                    isArchived: false,
                },
            },
            include: {
                entity: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
            orderBy: { name: "asc" },
        }),
    ]);
    const summary = summaryResult.ok ? summaryResult.data : null;
    if (!summaryResult.ok) {
        console.error(JSON.stringify({
            scope: "finance-kpi",
            level: "error",
            queryType: "dashboard-summary",
            entityId: "ALL_ENTITIES",
            error: summaryResult.error instanceof Error ? summaryResult.error.message : "Unknown KPI error.",
        }));
    }

    const walletOptions = context.wallets.map((wallet) => ({
        id: wallet.id,
        plainLabel: wallet.name,
        label: `${wallet.name} (${wallet.entity?.name ?? "Entity"} | ${formatPhp(Number(wallet.currentBalanceAmount))})`,
        type: wallet.type,
    }));
    const budgetEntityById = new Map(context.budgets.map((budget) => [budget.id, budget.entity?.name ?? "Entity"]));
    const budgetOptions = mapBudgetFormOptions(context.budgets).map((budget) => ({
        ...budget,
        label: `${budget.label} (${budgetEntityById.get(budget.id) ?? "Entity"})`,
        targetLabel: `${budget.targetLabel} (${budgetEntityById.get(budget.id) ?? "Entity"})`,
    }));
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
        label: `${credit.name} (${credit.entity?.name ?? "Entity"} | ${formatPhp(Number(credit.creditLimitAmount) - Number(credit.currentBalanceAmount))} remaining)`,
    }));
    const metrics = [
        { id: "total-assets", label: "Total Assets", value: summary ? formatPhp(summary.totalAssetsPhp) : "-" },
        { id: "total-investment", label: "Total Investment", value: summary ? formatPhp(summary.totalInvestmentPhp) : "-" },
        { id: "wallet-balance", label: "Wallet Balance", value: summary ? formatPhp(summary.totalWalletBalancePhp) : "-" },
        { id: "allocated-budget", label: "Allocated Budget", value: summary ? formatPhp(summary.budgetAvailablePhp) : "-" },
        { id: "credit-card-debt", label: "Credit Card Debt", value: summary ? formatPhp(summary.totalCreditCardDebtPhp) : "-" },
        { id: "unallocated-budget", label: "Unallocated Budget", value: summary ? formatPhp(summary.unallocatedCashPhp) : "-" },
        { id: "total-monthly-income", label: "Total Monthly Income", value: summary ? formatPhp(summary.monthlyTotalIncomePhp) : "-" },
    ];
    const negativeKinds = new Set<TransactionKind>([
        "EXPENSE",
        "BUDGET_ALLOCATION",
        "CREDIT_CARD_PAYMENT",
        "LOAN_REPAY",
    ]);
    const recentTransactionRows = recentTransactions.map((transaction) => {
        const signedAmount = negativeKinds.has(transaction.kind)
            ? -Math.abs(Number(transaction.amountPhp))
            : Math.abs(Number(transaction.amountPhp));
        const amountLabel = signedAmount < 0
            ? `(${formatPhp(Math.abs(signedAmount))})`
            : formatPhp(signedAmount);

        return {
            id: transaction.id,
            postedAtLabel: dateFormatter.format(transaction.postedAt),
            kind: transaction.kind,
            amountLabel,
            amountClassName: signedAmount < 0 ? "text-danger" as const : "text-success" as const,
            entityName: transaction.entity?.name ?? "-",
            walletName: transaction.walletAccount.name,
            budgetName: transaction.budgetEnvelope?.name ?? "-",
            remarks: transaction.remarks?.trim() || "-",
        };
    });

    return (
        <section className="d-grid gap-4">
            <header className="d-flex flex-wrap align-items-start justify-content-between gap-3">
                <div className="d-grid gap-2">
                    <p className="m-0 text-uppercase small" style={{ letterSpacing: "0.3em", color: "var(--color-kicker-primary)" }}>Main Page</p>
                    <h2 className="m-0 fs-2 fw-semibold" style={{ color: "var(--color-text-strong)" }}>Dashboard</h2>
                    <p className="m-0 small" style={{ color: "var(--color-text-muted)" }}>
                        Cross-entity totals and latest transactions. New posts use the currently active entity.
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

            <ToggleableMetricCardGrid
                metrics={metrics}
                storageKey="pf-dashboard-metrics-hidden"
                hideAllLabel="Hide all amounts"
                showAllLabel="Show all amounts"
            />

            <Card className="pf-surface-panel">
                <CardBody className="d-grid gap-3">
                    <h3 className="m-0 fs-6 fw-semibold" style={{ color: "var(--color-text-strong)" }}>
                        Recent Transactions
                    </h3>
                    <RecentTransactionsTable rows={recentTransactionRows} storageKey="pf-dashboard-metrics-hidden" />
                </CardBody>
            </Card>
        </section>
    );
}
