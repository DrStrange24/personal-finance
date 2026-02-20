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
import { getBudgetStats } from "@/lib/finance/queries";
import { getAuthenticatedSession } from "@/lib/server-session";
import { prisma } from "@/lib/prisma";

const parseRequiredName = (value: FormDataEntryValue | null) => {
    if (typeof value !== "string") {
        return null;
    }
    const normalized = value.trim();
    if (normalized.length === 0 || normalized.length > 80) {
        return null;
    }
    return normalized;
};

export default async function BudgetPage() {
    const session = await getAuthenticatedSession();
    await ensureFinanceBootstrap(session.userId);

    const createBudgetEnvelopeAction = async (formData: FormData) => {
        "use server";

        const actionSession = await getAuthenticatedSession();
        const name = parseRequiredName(formData.get("name"));
        const monthlyTargetResult = parseMoneyInput(formData.get("monthlyTargetPhp"), true);
        const availableResult = parseMoneyInput(formData.get("availablePhp"), true);
        const payToResult = parseOptionalText(formData.get("payTo"), 80);
        const remarksResult = parseOptionalText(formData.get("remarks"), 300);

        if (
            !name
            || !monthlyTargetResult.ok
            || monthlyTargetResult.value === null
            || !availableResult.ok
            || availableResult.value === null
            || !payToResult.ok
            || !remarksResult.ok
        ) {
            return;
        }

        const maxSortOrder = await prisma.budgetEnvelope.aggregate({
            where: {
                userId: actionSession.userId,
                isSystem: false,
            },
            _max: {
                sortOrder: true,
            },
        });

        await prisma.budgetEnvelope.create({
            data: {
                userId: actionSession.userId,
                name,
                monthlyTargetPhp: monthlyTargetResult.value,
                availablePhp: availableResult.value,
                payTo: payToResult.value,
                remarks: remarksResult.value,
                sortOrder: (maxSortOrder._max.sortOrder ?? 0) + 1,
            },
        });

        revalidatePath("/budget");
        revalidatePath("/dashboard");
    };

    const updateBudgetEnvelopeAction = async (formData: FormData) => {
        "use server";

        const actionSession = await getAuthenticatedSession();
        const id = typeof formData.get("id") === "string" ? String(formData.get("id")).trim() : "";
        const monthlyTargetResult = parseMoneyInput(formData.get("monthlyTargetPhp"), true);
        const payToResult = parseOptionalText(formData.get("payTo"), 80);
        const remarksResult = parseOptionalText(formData.get("remarks"), 300);
        const rolloverEnabled = formData.get("rolloverEnabled") === "on";

        if (
            !id
            || !monthlyTargetResult.ok
            || monthlyTargetResult.value === null
            || !payToResult.ok
            || !remarksResult.ok
        ) {
            return;
        }

        await prisma.budgetEnvelope.updateMany({
            where: {
                id,
                userId: actionSession.userId,
                isSystem: false,
            },
            data: {
                monthlyTargetPhp: monthlyTargetResult.value,
                payTo: payToResult.value,
                remarks: remarksResult.value,
                rolloverEnabled,
            },
        });

        revalidatePath("/budget");
        revalidatePath("/dashboard");
    };

    const postBudgetAllocationAction = async (formData: FormData) => {
        "use server";
        const actionSession = await getAuthenticatedSession();

        const postedAtRaw = formData.get("postedAt");
        const amountResult = parseMoneyInput(formData.get("amountPhp"), true);
        const walletAccountId = typeof formData.get("walletAccountId") === "string"
            ? String(formData.get("walletAccountId")).trim()
            : "";
        const budgetEnvelopeId = typeof formData.get("budgetEnvelopeId") === "string"
            ? String(formData.get("budgetEnvelopeId")).trim()
            : "";
        const remarksResult = parseOptionalText(formData.get("remarks"), 300);

        if (
            typeof postedAtRaw !== "string"
            || !amountResult.ok
            || amountResult.value === null
            || !walletAccountId
            || !budgetEnvelopeId
            || !remarksResult.ok
        ) {
            return { ok: false, message: "Please provide valid budget allocation details." };
        }

        const postedAt = new Date(`${postedAtRaw}T00:00:00`);
        if (Number.isNaN(postedAt.valueOf())) {
            return { ok: false, message: "Invalid date." };
        }

        try {
            await postFinanceTransaction({
                userId: actionSession.userId,
                kind: "BUDGET_ALLOCATION",
                postedAt,
                amountPhp: amountResult.value,
                walletAccountId,
                budgetEnvelopeId,
                remarks: remarksResult.value,
            });
        } catch (error) {
            return {
                ok: false,
                message: error instanceof Error ? error.message : "Could not allocate budget.",
            };
        }

        revalidatePath("/budget");
        revalidatePath("/dashboard");
        revalidatePath("/transactions");
        return { ok: true, message: "Budget allocation posted successfully." };
    };

    const [context, budgetStats] = await Promise.all([
        getFinanceContextData(session.userId),
        getBudgetStats(session.userId),
    ]);

    const walletOptions = context.wallets.map((wallet) => ({
        id: wallet.id,
        label: wallet.name,
    }));
    const budgetOptions = context.budgets
        .filter((budget) => !budget.isSystem)
        .map((budget) => ({
            id: budget.id,
            label: budget.name,
        }));

    return (
        <section className="d-grid gap-4">
            <header className="d-grid gap-2">
                <p className="m-0 text-uppercase small" style={{ letterSpacing: "0.3em", color: "var(--color-kicker-tertiary)" }}>Budget</p>
                <h2 className="m-0 fs-2 fw-semibold" style={{ color: "var(--color-text-strong)" }}>Envelope Budgeting</h2>
                <p className="m-0 small" style={{ color: "var(--color-text-muted)" }}>
                    Fund envelopes from wallets, then let expenses deduct both wallet and envelope.
                </p>
            </header>

            <div className="d-grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
                <TransactionForm
                    submitAction={postBudgetAllocationAction}
                    wallets={walletOptions}
                    budgets={budgetOptions}
                    includeKindSelect={false}
                    defaultKind="BUDGET_ALLOCATION"
                    title="Allocate Budget"
                    submitLabel="Allocate"
                />

                <Card className="pf-surface-panel">
                    <CardBody className="d-grid gap-3">
                        <h3 className="m-0 fs-6 fw-semibold">Add Budget Envelope</h3>
                        <form action={createBudgetEnvelopeAction} className="d-grid gap-3">
                            <div className="d-grid gap-1">
                                <label htmlFor="budget-name" className="small fw-semibold">Name</label>
                                <input id="budget-name" type="text" name="name" className="form-control" maxLength={80} required />
                            </div>
                            <div className="d-grid gap-1">
                                <label htmlFor="budget-monthly-target" className="small fw-semibold">Monthly Target (PHP)</label>
                                <input id="budget-monthly-target" type="number" name="monthlyTargetPhp" className="form-control" min="0" step="0.01" required />
                            </div>
                            <div className="d-grid gap-1">
                                <label htmlFor="budget-available" className="small fw-semibold">Starting Available (PHP)</label>
                                <input id="budget-available" type="number" name="availablePhp" className="form-control" min="0" step="0.01" required />
                            </div>
                            <div className="d-grid gap-1">
                                <label htmlFor="budget-pay-to" className="small fw-semibold">Pay To</label>
                                <input id="budget-pay-to" type="text" name="payTo" className="form-control" maxLength={80} />
                            </div>
                            <div className="d-grid gap-1">
                                <label htmlFor="budget-remarks" className="small fw-semibold">Remarks</label>
                                <textarea id="budget-remarks" name="remarks" className="form-control" rows={2} />
                            </div>
                            <Button type="submit">Create Envelope</Button>
                        </form>
                    </CardBody>
                </Card>
            </div>

            <Card className="pf-surface-panel">
                <CardBody className="d-grid gap-3">
                    <h3 className="m-0 fs-6 fw-semibold">Envelopes</h3>
                    <div className="table-responsive">
                        <Table hover className="align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Target</th>
                                    <th>Available</th>
                                    <th>Spent (MTD)</th>
                                    <th>Remaining</th>
                                    <th>Pay To</th>
                                    <th>Update</th>
                                </tr>
                            </thead>
                            <tbody>
                                {budgetStats.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="text-center py-4" style={{ color: "var(--color-text-muted)" }}>
                                            No budget envelopes yet.
                                        </td>
                                    </tr>
                                ) : (
                                    budgetStats.map((budget) => (
                                        <tr key={budget.id}>
                                            <td>{budget.name}</td>
                                            <td>{Number(budget.monthlyTargetPhp).toFixed(2)}</td>
                                            <td>{Number(budget.availablePhp).toFixed(2)}</td>
                                            <td>{budget.spentPhp.toFixed(2)}</td>
                                            <td className={budget.remainingPhp < 0 ? "text-danger" : "text-success"}>
                                                {budget.remainingPhp.toFixed(2)}
                                            </td>
                                            <td>{budget.payTo?.trim() || "-"}</td>
                                            <td>
                                                <form action={updateBudgetEnvelopeAction} className="d-flex align-items-center gap-2">
                                                    <input type="hidden" name="id" value={budget.id} />
                                                    <input
                                                        type="number"
                                                        name="monthlyTargetPhp"
                                                        defaultValue={Number(budget.monthlyTargetPhp).toFixed(2)}
                                                        className="form-control form-control-sm"
                                                        min="0"
                                                        step="0.01"
                                                        required
                                                        style={{ width: "8rem" }}
                                                    />
                                                    <input
                                                        type="text"
                                                        name="payTo"
                                                        defaultValue={budget.payTo ?? ""}
                                                        className="form-control form-control-sm"
                                                        placeholder="Pay to"
                                                    />
                                                    <input
                                                        type="text"
                                                        name="remarks"
                                                        defaultValue={budget.remarks ?? ""}
                                                        className="form-control form-control-sm"
                                                        placeholder="Remarks"
                                                    />
                                                    <label className="small d-flex align-items-center gap-1 m-0">
                                                        <input type="checkbox" name="rolloverEnabled" defaultChecked={budget.rolloverEnabled} />
                                                        Rollover
                                                    </label>
                                                    <Button size="sm" type="submit" variant="outline-primary">Save</Button>
                                                </form>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </Table>
                    </div>
                </CardBody>
            </Card>
        </section>
    );
}
