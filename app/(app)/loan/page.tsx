import { LoanDirection, LoanStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import Button from "react-bootstrap/Button";
import Card from "react-bootstrap/Card";
import CardBody from "react-bootstrap/CardBody";
import Table from "react-bootstrap/Table";
import TransactionForm from "@/app/components/finance/transaction-form";
import { ensureFinanceBootstrap } from "@/lib/finance/bootstrap";
import { getFinanceContextData } from "@/lib/finance/context";
import { parseMoneyInput, parseOptionalText } from "@/lib/finance/money";
import { postFinanceTransaction } from "@/lib/finance/posting-engine";
import { getAuthenticatedSession } from "@/lib/server-session";
import { prisma } from "@/lib/prisma";

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
    const session = await getAuthenticatedSession();
    await ensureFinanceBootstrap(session.userId);

    const createLoanAction = async (formData: FormData) => {
        "use server";

        const actionSession = await getAuthenticatedSession();
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
            return;
        }

        const paidToDate = paidToDateResult.value ?? 0;
        const remaining = Math.max(0, principalResult.value - paidToDate);

        await prisma.loanRecord.create({
            data: {
                userId: actionSession.userId,
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

        revalidatePath("/loan");
    };

    const updateLoanStatusAction = async (formData: FormData) => {
        "use server";

        const actionSession = await getAuthenticatedSession();
        const id = typeof formData.get("id") === "string" ? String(formData.get("id")).trim() : "";
        const statusRaw = typeof formData.get("status") === "string" ? String(formData.get("status")).trim() : "";
        const remarksResult = parseOptionalText(formData.get("remarks"), 300);

        if (!id || !remarksResult.ok) {
            return;
        }

        const status = statusRaw === LoanStatus.WRITTEN_OFF
            ? LoanStatus.WRITTEN_OFF
            : statusRaw === LoanStatus.PAID
                ? LoanStatus.PAID
                : LoanStatus.ACTIVE;

        await prisma.loanRecord.updateMany({
            where: {
                id,
                userId: actionSession.userId,
            },
            data: {
                status,
                remarks: remarksResult.value,
            },
        });

        revalidatePath("/loan");
    };

    const postLoanRepaymentAction = async (formData: FormData) => {
        "use server";

        const actionSession = await getAuthenticatedSession();
        const postedAtRaw = formData.get("postedAt");
        const amountResult = parseMoneyInput(formData.get("amountPhp"), true);
        const walletAccountId = typeof formData.get("walletAccountId") === "string"
            ? String(formData.get("walletAccountId")).trim()
            : "";
        const loanRecordId = typeof formData.get("loanRecordId") === "string"
            ? String(formData.get("loanRecordId")).trim()
            : "";
        const remarksResult = parseOptionalText(formData.get("remarks"), 300);

        if (
            typeof postedAtRaw !== "string"
            || !amountResult.ok
            || amountResult.value === null
            || !walletAccountId
            || !loanRecordId
            || !remarksResult.ok
        ) {
            return { ok: false, message: "Please provide valid repayment details." };
        }

        const postedAt = new Date(`${postedAtRaw}T00:00:00`);
        if (Number.isNaN(postedAt.valueOf())) {
            return { ok: false, message: "Invalid date." };
        }

        try {
            await postFinanceTransaction({
                userId: actionSession.userId,
                kind: "LOAN_REPAY",
                postedAt,
                amountPhp: amountResult.value,
                walletAccountId,
                loanRecordId,
                remarks: remarksResult.value,
            });
        } catch (error) {
            return {
                ok: false,
                message: error instanceof Error ? error.message : "Could not post loan repayment.",
            };
        }

        revalidatePath("/loan");
        revalidatePath("/transactions");
        revalidatePath("/dashboard");
        return { ok: true, message: "Loan repayment posted successfully." };
    };

    const postLoanBorrowAction = async (formData: FormData) => {
        "use server";

        const actionSession = await getAuthenticatedSession();
        const postedAtRaw = formData.get("postedAt");
        const amountResult = parseMoneyInput(formData.get("amountPhp"), true);
        const walletAccountId = typeof formData.get("walletAccountId") === "string"
            ? String(formData.get("walletAccountId")).trim()
            : "";
        const loanRecordId = typeof formData.get("loanRecordId") === "string"
            ? String(formData.get("loanRecordId")).trim()
            : "";
        const remarksResult = parseOptionalText(formData.get("remarks"), 300);

        if (
            typeof postedAtRaw !== "string"
            || !amountResult.ok
            || amountResult.value === null
            || !walletAccountId
            || !loanRecordId
            || !remarksResult.ok
        ) {
            return { ok: false, message: "Please provide valid borrow details." };
        }

        const postedAt = new Date(`${postedAtRaw}T00:00:00`);
        if (Number.isNaN(postedAt.valueOf())) {
            return { ok: false, message: "Invalid date." };
        }

        try {
            await postFinanceTransaction({
                userId: actionSession.userId,
                kind: "LOAN_BORROW",
                postedAt,
                amountPhp: amountResult.value,
                walletAccountId,
                loanRecordId,
                remarks: remarksResult.value,
            });
        } catch (error) {
            return {
                ok: false,
                message: error instanceof Error ? error.message : "Could not post loan borrow transaction.",
            };
        }

        revalidatePath("/loan");
        revalidatePath("/transactions");
        revalidatePath("/dashboard");
        return { ok: true, message: "Loan borrow transaction posted successfully." };
    };

    const [context, loans] = await Promise.all([
        getFinanceContextData(session.userId),
        prisma.loanRecord.findMany({
            where: {
                userId: session.userId,
            },
            orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        }),
    ]);

    const walletOptions = context.wallets.map((wallet) => ({
        id: wallet.id,
        label: wallet.name,
    }));
    const loanOptions = loans.map((loan) => ({
        id: loan.id,
        label: `${loan.itemName} (${Number(loan.remainingPhp).toFixed(2)})`,
    }));
    const youOwe = loans.filter((loan) => loan.direction === LoanDirection.YOU_OWE);
    const youAreOwed = loans.filter((loan) => loan.direction === LoanDirection.YOU_ARE_OWED);

    return (
        <section className="d-grid gap-4">
            <header className="d-grid gap-2">
                <p className="m-0 text-uppercase small" style={{ letterSpacing: "0.3em", color: "var(--color-kicker-tertiary)" }}>Loan</p>
                <h2 className="m-0 fs-2 fw-semibold" style={{ color: "var(--color-text-strong)" }}>Loan Tracking</h2>
                <p className="m-0 small" style={{ color: "var(--color-text-muted)" }}>
                    Track both debts you owe and debts owed to you, including repayment movements in the ledger.
                </p>
            </header>

            <div className="d-grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
                <TransactionForm
                    submitAction={postLoanRepaymentAction}
                    wallets={walletOptions}
                    budgets={[]}
                    loanRecords={loanOptions}
                    includeKindSelect={false}
                    defaultKind="LOAN_REPAY"
                    title="Post Loan Repayment"
                    submitLabel="Post Repayment"
                />
                <TransactionForm
                    submitAction={postLoanBorrowAction}
                    wallets={walletOptions}
                    budgets={[]}
                    loanRecords={loanOptions}
                    includeKindSelect={false}
                    defaultKind="LOAN_BORROW"
                    title="Post Loan Borrow"
                    submitLabel="Post Borrow"
                />
            </div>

            <Card className="pf-surface-panel">
                <CardBody className="d-grid gap-3">
                    <h3 className="m-0 fs-6 fw-semibold">Add Loan Record</h3>
                    <form action={createLoanAction} className="d-grid gap-3">
                        <div className="d-grid gap-1">
                            <label htmlFor="loan-direction" className="small fw-semibold">Direction</label>
                            <select id="loan-direction" name="direction" className="form-control" defaultValue="YOU_OWE">
                                <option value="YOU_OWE">You Owe</option>
                                <option value="YOU_ARE_OWED">You Are Owed</option>
                            </select>
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="loan-item-name" className="small fw-semibold">Item / Loan Name</label>
                            <input id="loan-item-name" type="text" name="itemName" className="form-control" maxLength={120} required />
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="loan-counterparty" className="small fw-semibold">Counterparty</label>
                            <input id="loan-counterparty" type="text" name="counterparty" className="form-control" maxLength={120} />
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="loan-principal" className="small fw-semibold">Principal (PHP)</label>
                            <input id="loan-principal" type="number" name="principalPhp" className="form-control" min="0" step="0.01" required />
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="loan-monthly" className="small fw-semibold">Monthly Due (PHP)</label>
                            <input id="loan-monthly" type="number" name="monthlyDuePhp" className="form-control" min="0" step="0.01" />
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="loan-paid" className="small fw-semibold">Paid To Date (PHP)</label>
                            <input id="loan-paid" type="number" name="paidToDatePhp" className="form-control" min="0" step="0.01" />
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="loan-remarks" className="small fw-semibold">Remarks</label>
                            <textarea id="loan-remarks" name="remarks" className="form-control" rows={2} />
                        </div>
                        <Button type="submit">Create Loan</Button>
                    </form>
                </CardBody>
            </Card>

            <Card className="pf-surface-panel">
                <CardBody className="d-grid gap-4">
                    <div>
                        <h3 className="m-0 fs-6 fw-semibold">You Owe</h3>
                        <div className="table-responsive mt-2">
                            <Table hover className="align-middle mb-0">
                                <thead>
                                    <tr>
                                        <th>Item</th>
                                        <th>Counterparty</th>
                                        <th>Principal</th>
                                        <th>Paid</th>
                                        <th>Remaining</th>
                                        <th>Status</th>
                                        <th>Update</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {youOwe.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="text-center py-4" style={{ color: "var(--color-text-muted)" }}>
                                                No records.
                                            </td>
                                        </tr>
                                    ) : (
                                        youOwe.map((loan) => (
                                            <tr key={loan.id}>
                                                <td>{loan.itemName}</td>
                                                <td>{loan.counterparty?.trim() || "-"}</td>
                                                <td>{Number(loan.principalPhp).toFixed(2)}</td>
                                                <td>{Number(loan.paidToDatePhp).toFixed(2)}</td>
                                                <td className={Number(loan.remainingPhp) > 0 ? "text-danger" : "text-success"}>
                                                    {Number(loan.remainingPhp).toFixed(2)}
                                                </td>
                                                <td>{loan.status}</td>
                                                <td>
                                                    <form action={updateLoanStatusAction} className="d-flex align-items-center gap-2">
                                                        <input type="hidden" name="id" value={loan.id} />
                                                        <select
                                                            name="status"
                                                            className="form-control form-control-sm"
                                                            defaultValue={loan.status}
                                                            style={{ width: "8rem" }}
                                                        >
                                                            <option value="ACTIVE">ACTIVE</option>
                                                            <option value="PAID">PAID</option>
                                                            <option value="WRITTEN_OFF">WRITTEN_OFF</option>
                                                        </select>
                                                        <input
                                                            type="text"
                                                            name="remarks"
                                                            className="form-control form-control-sm"
                                                            defaultValue={loan.remarks ?? ""}
                                                            placeholder="Remarks"
                                                        />
                                                        <Button size="sm" type="submit" variant="outline-primary">Save</Button>
                                                    </form>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </Table>
                        </div>
                    </div>

                    <div>
                        <h3 className="m-0 fs-6 fw-semibold">You Are Owed</h3>
                        <div className="table-responsive mt-2">
                            <Table hover className="align-middle mb-0">
                                <thead>
                                    <tr>
                                        <th>Item</th>
                                        <th>Counterparty</th>
                                        <th>Principal</th>
                                        <th>Paid</th>
                                        <th>Remaining</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {youAreOwed.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="text-center py-4" style={{ color: "var(--color-text-muted)" }}>
                                                No records.
                                            </td>
                                        </tr>
                                    ) : (
                                        youAreOwed.map((loan) => (
                                            <tr key={loan.id}>
                                                <td>{loan.itemName}</td>
                                                <td>{loan.counterparty?.trim() || "-"}</td>
                                                <td>{Number(loan.principalPhp).toFixed(2)}</td>
                                                <td>{Number(loan.paidToDatePhp).toFixed(2)}</td>
                                                <td className={Number(loan.remainingPhp) > 0 ? "text-warning" : "text-success"}>
                                                    {Number(loan.remainingPhp).toFixed(2)}
                                                </td>
                                                <td>{loan.status}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </Table>
                        </div>
                    </div>
                </CardBody>
            </Card>
        </section>
    );
}
