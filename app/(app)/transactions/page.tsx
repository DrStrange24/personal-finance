import { TransactionKind } from "@prisma/client";
import { revalidatePath } from "next/cache";
import Button from "react-bootstrap/Button";
import Card from "react-bootstrap/Card";
import CardBody from "react-bootstrap/CardBody";
import AddTransactionModal from "./add-transaction-modal";
import TransactionsTable from "./transactions-table";
import { ensureFinanceBootstrap } from "@/lib/finance/bootstrap";
import { getFinanceContextData } from "@/lib/finance/context";
import { listActiveCreditAccountsByEntity } from "@/lib/finance/entity-scoped-records";
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

type TransactionsPageProps = {
    searchParams?: Promise<{
        kind?: string;
        wallet?: string;
        q?: string;
    }>;
};

export default async function TransactionsPage({ searchParams }: TransactionsPageProps) {
    const session = await getAuthenticatedEntitySession();
    const activeEntityId = session.activeEntity.id;
    await ensureFinanceBootstrap(session.userId, activeEntityId);
    const params = (await searchParams) ?? {};
    const selectedKind = typeof params.kind === "string" ? params.kind.trim() : "";
    const selectedWalletId = typeof params.wallet === "string" ? params.wallet.trim() : "";
    const searchText = typeof params.q === "string" ? params.q.trim() : "";

    const postTransactionAction = async (formData: FormData): Promise<FinanceActionResult> => {
        "use server";

        const actionSession = await getAuthenticatedEntitySession();
        const result = await postTransactionFromFormData({
            userId: actionSession.userId,
            entityId: actionSession.activeEntity.id,
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
                entityId: actionSession.activeEntity.id,
                isReversal: false,
                voidedAt: null,
            },
            select: {
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

        const result = await updateTransactionFromFormData({
            userId: actionSession.userId,
            entityId: actionSession.activeEntity.id,
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

        try {
            await deleteFinanceTransactionWithReversal(
                actionSession.userId,
                actionSession.activeEntity.id,
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

    const [context, transactions, creditAccounts] = await Promise.all([
        getFinanceContextData(session.userId, activeEntityId),
        prisma.financeTransaction.findMany({
            where: {
                userId: session.userId,
                entityId: activeEntityId,
                isReversal: false,
                voidedAt: null,
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
        listActiveCreditAccountsByEntity(prisma, session.userId, activeEntityId),
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
                                    <option key={wallet.id} value={wallet.id}>{wallet.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="col-12 col-md-4">
                            <label htmlFor="filter-q" className="small fw-semibold mb-1">Remarks Search</label>
                            <input id="filter-q" type="text" name="q" className="form-control form-control-sm" defaultValue={searchText} />
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
        </section>
    );
}
