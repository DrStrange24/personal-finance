import { LoanDirection, LoanStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import Card from "react-bootstrap/Card";
import CardBody from "react-bootstrap/CardBody";
import AddLoanRecordModal from "./add-loan-record-modal";
import LoanRecordTable from "./loan-record-table";
import LoanTransactionModal from "./loan-transaction-modal";
import { ensureFinanceBootstrap } from "@/lib/finance/bootstrap";
import { getFinanceContextData } from "@/lib/finance/context";
import { formatPhp, parseMoneyInput, parseOptionalText } from "@/lib/finance/money";
import { deleteFinanceTransactionWithReversal, postFinanceTransaction } from "@/lib/finance/posting-engine";
import { getAuthenticatedEntitySession } from "@/lib/server-session";
import { prisma } from "@/lib/prisma";

type LoanActionResult = {
    ok: boolean;
    message: string;
};

const parseRequiredName = (value: FormDataEntryValue | null) => {
    if (typeof value !== "string") {
        return null;
    }
    const normalized = value.trim();
    if (normalized.length === 0 || normalized.length > 120) {
        return null;
    }
    return normalized;
};

export default async function LoanPage() {
    const session = await getAuthenticatedEntitySession();
    const activeEntityId = session.activeEntity.id;
    await ensureFinanceBootstrap(session.userId, activeEntityId);

    const createLoanAction = async (formData: FormData): Promise<LoanActionResult> => {
        "use server";

        const actionSession = await getAuthenticatedEntitySession();
        const directionRaw = formData.get("direction");
        const direction = directionRaw === "YOU_ARE_OWED" ? LoanDirection.YOU_ARE_OWED : LoanDirection.YOU_OWE;
        const itemName = parseRequiredName(formData.get("itemName"));
        const counterpartyResult = parseOptionalText(formData.get("counterparty"), 120);
        const principalResult = parseMoneyInput(formData.get("principalPhp"), true);
        const monthlyDueResult = parseMoneyInput(formData.get("monthlyDuePhp"), false);
        const paidToDateResult = parseMoneyInput(formData.get("paidToDatePhp"), false);
        const remarksResult = parseOptionalText(formData.get("remarks"), 300);

        if (
            !itemName
            || !counterpartyResult.ok
            || !principalResult.ok
            || principalResult.value === null
            || !monthlyDueResult.ok
            || !paidToDateResult.ok
            || !remarksResult.ok
        ) {
            return { ok: false, message: "Please provide valid loan details." };
        }

        const paidToDate = paidToDateResult.value ?? 0;
        const remaining = Math.max(0, principalResult.value - paidToDate);

        try {
            await prisma.loanRecord.create({
                data: {
                    userId: actionSession.userId,
                    entityId: actionSession.activeEntity.id,
                    direction,
                    itemName,
                    counterparty: counterpartyResult.value,
                    principalPhp: principalResult.value,
                    monthlyDuePhp: monthlyDueResult.value,
                    paidToDatePhp: paidToDate,
                    remainingPhp: remaining,
                    status: remaining <= 0 ? LoanStatus.PAID : LoanStatus.ACTIVE,
                    remarks: remarksResult.value,
                },
            });
        } catch {
            return { ok: false, message: "Could not create loan record. Please try again." };
        }

        revalidatePath("/loan");
        return { ok: true, message: "Loan record created successfully." };
    };

    const updateLoanStatusAction = async (formData: FormData): Promise<LoanActionResult> => {
        "use server";

        const actionSession = await getAuthenticatedEntitySession();
        const id = typeof formData.get("id") === "string" ? String(formData.get("id")).trim() : "";
        const statusRaw = typeof formData.get("status") === "string" ? String(formData.get("status")).trim() : "";
        const remarksResult = parseOptionalText(formData.get("remarks"), 300);

        if (!id || !remarksResult.ok) {
            return { ok: false, message: "Please provide valid loan update details." };
        }

        const status = statusRaw === LoanStatus.WRITTEN_OFF
            ? LoanStatus.WRITTEN_OFF
            : statusRaw === LoanStatus.PAID
                ? LoanStatus.PAID
                : LoanStatus.ACTIVE;

        try {
            const result = await prisma.loanRecord.updateMany({
                where: {
                    id,
                    userId: actionSession.userId,
                    entityId: actionSession.activeEntity.id,
                },
                data: {
                    status,
                    remarks: remarksResult.value,
                },
            });

            if (result.count === 0) {
                return { ok: false, message: "Loan record not found." };
            }
        } catch {
            return { ok: false, message: "Could not update loan record. Please try again." };
        }

        revalidatePath("/loan");
        return { ok: true, message: "Loan record updated successfully." };
    };

    const deleteLoanAction = async (formData: FormData): Promise<LoanActionResult> => {
        "use server";

        const actionSession = await getAuthenticatedEntitySession();
        const id = typeof formData.get("id") === "string" ? String(formData.get("id")).trim() : "";

        if (!id) {
            return { ok: false, message: "Missing loan record id." };
        }

        try {
            const result = await prisma.loanRecord.deleteMany({
                where: {
                    id,
                    userId: actionSession.userId,
                    entityId: actionSession.activeEntity.id,
                },
            });

            if (result.count === 0) {
                return { ok: false, message: "Loan record not found." };
            }
        } catch {
            return { ok: false, message: "Could not delete loan record. Please try again." };
        }

        revalidatePath("/loan");
        return { ok: true, message: "Loan record deleted successfully." };
    };

    const postLoanRepaymentAction = async (formData: FormData) => {
        "use server";

        const actionSession = await getAuthenticatedEntitySession();
        const postedAtRaw = formData.get("postedAt");
        const walletAccountId = typeof formData.get("walletAccountId") === "string"
            ? String(formData.get("walletAccountId")).trim()
            : "";
        const remarksResult = parseOptionalText(formData.get("remarks"), 300);
        const repaymentLoanRecordValues = formData.getAll("repaymentLoanRecordId");
        const repaymentAmountValues = formData.getAll("repaymentAmountPhp");

        if (
            typeof postedAtRaw !== "string"
            || !walletAccountId
            || !remarksResult.ok
        ) {
            return { ok: false, message: "Please provide valid repayment details." };
        }

        const postedAt = new Date(`${postedAtRaw}T00:00:00`);
        if (Number.isNaN(postedAt.valueOf())) {
            return { ok: false, message: "Invalid date." };
        }

        const repaymentItems: Array<{ loanRecordId: string; amountPhp: number }> = [];
        if (repaymentLoanRecordValues.length > 0 || repaymentAmountValues.length > 0) {
            if (repaymentLoanRecordValues.length !== repaymentAmountValues.length) {
                return { ok: false, message: "Invalid repayment items." };
            }

            for (let index = 0; index < repaymentLoanRecordValues.length; index += 1) {
                const loanValue = repaymentLoanRecordValues[index];
                const amountValue = repaymentAmountValues[index];
                const loanRecordId = typeof loanValue === "string" ? loanValue.trim() : "";
                const amountResult = parseMoneyInput(amountValue ?? null, true);

                if (!loanRecordId || !amountResult.ok || amountResult.value === null) {
                    return { ok: false, message: "Invalid repayment items." };
                }

                repaymentItems.push({
                    loanRecordId,
                    amountPhp: amountResult.value,
                });
            }

            if (new Set(repaymentItems.map((item) => item.loanRecordId)).size !== repaymentItems.length) {
                return { ok: false, message: "Duplicate loan records are not allowed." };
            }
        } else {
            const amountResult = parseMoneyInput(formData.get("amountPhp"), true);
            const loanRecordId = typeof formData.get("loanRecordId") === "string"
                ? String(formData.get("loanRecordId")).trim()
                : "";

            if (!amountResult.ok || amountResult.value === null || !loanRecordId) {
                return { ok: false, message: "Please provide valid repayment details." };
            }

            repaymentItems.push({
                loanRecordId,
                amountPhp: amountResult.value,
            });
        }

        const createdTransactionIds: string[] = [];
        try {
            for (const item of repaymentItems) {
                const created = await postFinanceTransaction({
                    userId: actionSession.userId,
                    entityId: actionSession.activeEntity.id,
                    kind: "LOAN_REPAY",
                    postedAt,
                    amountPhp: item.amountPhp,
                    walletAccountId,
                    loanRecordId: item.loanRecordId,
                    remarks: remarksResult.value,
                });
                createdTransactionIds.push(created.id);
            }
        } catch (error) {
            for (const transactionId of createdTransactionIds) {
                try {
                    await deleteFinanceTransactionWithReversal(
                        actionSession.userId,
                        actionSession.activeEntity.id,
                        transactionId,
                    );
                } catch {
                    // Best effort rollback if one of the batch items fails.
                }
            }

            return {
                ok: false,
                message: error instanceof Error ? error.message : "Could not post loan repayment.",
            };
        }

        revalidatePath("/loan");
        revalidatePath("/transactions");
        revalidatePath("/dashboard");
        return {
            ok: true,
            message: repaymentItems.length === 1
                ? "Loan repayment posted successfully."
                : `Posted ${repaymentItems.length} loan repayments successfully.`,
        };
    };

    const [context, loans] = await Promise.all([
        getFinanceContextData(session.userId, activeEntityId),
        prisma.loanRecord.findMany({
            where: {
                userId: session.userId,
                entityId: activeEntityId,
            },
            orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        }),
    ]);

    const walletOptions = context.wallets.map((wallet) => ({
        id: wallet.id,
        label: `${wallet.name} (${formatPhp(Number(wallet.currentBalanceAmount))})`,
    }));
    const loanOptions = loans
        .filter((loan) => loan.status !== LoanStatus.PAID)
        .map((loan) => ({
            id: loan.id,
            label: `${loan.itemName} (${formatPhp(Number(loan.remainingPhp))})`,
            defaultAmountPhp: loan.monthlyDuePhp === null ? null : Number(loan.monthlyDuePhp),
        }));
    const youOwe = loans
        .filter((loan) => loan.direction === LoanDirection.YOU_OWE)
        .map((loan) => ({
            id: loan.id,
            itemName: loan.itemName,
            counterparty: loan.counterparty,
            principalPhp: Number(loan.principalPhp),
            monthlyDuePhp: loan.monthlyDuePhp === null ? null : Number(loan.monthlyDuePhp),
            paidToDatePhp: Number(loan.paidToDatePhp),
            remainingPhp: Number(loan.remainingPhp),
            status: loan.status,
            remarks: loan.remarks,
        }));
    const youAreOwed = loans
        .filter((loan) => loan.direction === LoanDirection.YOU_ARE_OWED)
        .map((loan) => ({
            id: loan.id,
            itemName: loan.itemName,
            counterparty: loan.counterparty,
            principalPhp: Number(loan.principalPhp),
            monthlyDuePhp: loan.monthlyDuePhp === null ? null : Number(loan.monthlyDuePhp),
            paidToDatePhp: Number(loan.paidToDatePhp),
            remainingPhp: Number(loan.remainingPhp),
            status: loan.status,
            remarks: loan.remarks,
        }));

    return (
        <section className="d-grid gap-4">
            <header className="d-grid gap-2">
                <p className="m-0 text-uppercase small" style={{ letterSpacing: "0.3em", color: "var(--color-kicker-tertiary)" }}>Loan</p>
                <h2 className="m-0 fs-2 fw-semibold" style={{ color: "var(--color-text-strong)" }}>Loan Tracking</h2>
                <p className="m-0 small" style={{ color: "var(--color-text-muted)" }}>
                    Track both debts you owe and debts owed to you, including repayment movements in the ledger.
                </p>
            </header>

            <div className="d-flex flex-wrap gap-2 justify-content-end">
                <LoanTransactionModal
                    submitAction={postLoanRepaymentAction}
                    wallets={walletOptions}
                    loanRecords={loanOptions}
                    defaultKind="LOAN_REPAY"
                    title="Post Loan Repayment"
                    triggerLabel="Post Loan Repayment"
                    submitLabel="Post Repayment"
                />
                <AddLoanRecordModal createLoanAction={createLoanAction} />
            </div>

            <Card className="pf-surface-panel">
                <CardBody className="d-grid gap-4">
                    <LoanRecordTable
                        title="You Owe"
                        rows={youOwe}
                        remainingClassName="text-danger"
                        updateLoanAction={updateLoanStatusAction}
                        deleteLoanAction={deleteLoanAction}
                    />
                    <LoanRecordTable
                        title="You Are Owed"
                        rows={youAreOwed}
                        remainingClassName="text-warning"
                        updateLoanAction={updateLoanStatusAction}
                        deleteLoanAction={deleteLoanAction}
                    />
                </CardBody>
            </Card>
        </section>
    );
}
