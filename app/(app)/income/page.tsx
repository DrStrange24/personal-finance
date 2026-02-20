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
    if (normalized.length === 0 || normalized.length > 80) {
        return null;
    }
    return normalized;
};

export default async function IncomePage() {
    const session = await getAuthenticatedSession();
    await ensureFinanceBootstrap(session.userId);

    const createIncomeStreamAction = async (formData: FormData) => {
        "use server";
        const actionSession = await getAuthenticatedSession();

        const name = parseRequiredName(formData.get("name"));
        const defaultAmountResult = parseMoneyInput(formData.get("defaultAmountPhp"), true);
        const remarksResult = parseOptionalText(formData.get("remarks"), 300);

        if (!name || !defaultAmountResult.ok || defaultAmountResult.value === null || !remarksResult.ok) {
            return;
        }

        await prisma.incomeStream.create({
            data: {
                userId: actionSession.userId,
                name,
                defaultAmountPhp: defaultAmountResult.value,
                remarks: remarksResult.value,
            },
        });

        revalidatePath("/income");
        revalidatePath("/dashboard");
    };

    const updateIncomeStreamAction = async (formData: FormData) => {
        "use server";
        const actionSession = await getAuthenticatedSession();

        const id = typeof formData.get("id") === "string" ? String(formData.get("id")).trim() : "";
        const defaultAmountResult = parseMoneyInput(formData.get("defaultAmountPhp"), true);
        const remarksResult = parseOptionalText(formData.get("remarks"), 300);
        const isActive = formData.get("isActive") === "on";

        if (!id || !defaultAmountResult.ok || defaultAmountResult.value === null || !remarksResult.ok) {
            return;
        }

        await prisma.incomeStream.updateMany({
            where: {
                id,
                userId: actionSession.userId,
            },
            data: {
                defaultAmountPhp: defaultAmountResult.value,
                remarks: remarksResult.value,
                isActive,
            },
        });

        revalidatePath("/income");
        revalidatePath("/dashboard");
    };

    const postIncomeAction = async (formData: FormData) => {
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
        const incomeStreamId = typeof formData.get("incomeStreamId") === "string"
            ? String(formData.get("incomeStreamId")).trim()
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
            return { ok: false, message: "Please provide valid income details." };
        }

        const postedAt = new Date(`${postedAtRaw}T00:00:00`);
        if (Number.isNaN(postedAt.valueOf())) {
            return { ok: false, message: "Invalid income date." };
        }

        try {
            await postFinanceTransaction({
                userId: actionSession.userId,
                kind: "INCOME",
                postedAt,
                amountPhp: amountResult.value,
                walletAccountId,
                budgetEnvelopeId,
                incomeStreamId: incomeStreamId || null,
                remarks: remarksResult.value,
            });
        } catch (error) {
            return {
                ok: false,
                message: error instanceof Error ? error.message : "Could not post income.",
            };
        }

        revalidatePath("/income");
        revalidatePath("/dashboard");
        revalidatePath("/transactions");
        revalidatePath("/budget");
        return { ok: true, message: "Income posted successfully." };
    };

    const [context, streams] = await Promise.all([
        getFinanceContextData(session.userId),
        prisma.incomeStream.findMany({
            where: {
                userId: session.userId,
            },
            orderBy: [{ isActive: "desc" }, { name: "asc" }],
        }),
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
    const incomeOptions = streams
        .filter((stream) => stream.isActive)
        .map((stream) => ({
            id: stream.id,
            label: stream.name,
        }));

    return (
        <section className="d-grid gap-4">
            <header className="d-grid gap-2">
                <p className="m-0 text-uppercase small" style={{ letterSpacing: "0.3em", color: "var(--color-kicker-secondary)" }}>Income</p>
                <h2 className="m-0 fs-2 fw-semibold" style={{ color: "var(--color-text-strong)" }}>Income Streams</h2>
                <p className="m-0 small" style={{ color: "var(--color-text-muted)" }}>
                    Manage recurring income streams and post income into wallet + budget envelopes.
                </p>
            </header>

            <div className="d-grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
                <TransactionForm
                    submitAction={postIncomeAction}
                    wallets={walletOptions}
                    budgets={budgetOptions}
                    incomeStreams={incomeOptions}
                    includeKindSelect={false}
                    defaultKind="INCOME"
                    title="Post Income"
                    submitLabel="Post Income"
                />

                <Card className="pf-surface-panel">
                    <CardBody className="d-grid gap-3">
                        <h3 className="m-0 fs-6 fw-semibold">Add Income Stream</h3>
                        <form action={createIncomeStreamAction} className="d-grid gap-3">
                            <div className="d-grid gap-1">
                                <label htmlFor="income-name" className="small fw-semibold">Name</label>
                                <input id="income-name" type="text" name="name" className="form-control" maxLength={80} required />
                            </div>
                            <div className="d-grid gap-1">
                                <label htmlFor="income-default-amount" className="small fw-semibold">Default Amount (PHP)</label>
                                <input id="income-default-amount" type="number" name="defaultAmountPhp" className="form-control" step="0.01" min="0" required />
                            </div>
                            <div className="d-grid gap-1">
                                <label htmlFor="income-remarks" className="small fw-semibold">Remarks</label>
                                <textarea id="income-remarks" name="remarks" className="form-control" rows={2} placeholder="Optional" />
                            </div>
                            <Button type="submit">Create Stream</Button>
                        </form>
                    </CardBody>
                </Card>
            </div>

            <Card className="pf-surface-panel">
                <CardBody className="d-grid gap-3">
                    <h3 className="m-0 fs-6 fw-semibold">Current Streams</h3>
                    <div className="table-responsive">
                        <Table hover className="align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Default Amount</th>
                                    <th>Status</th>
                                    <th>Remarks</th>
                                    <th>Update</th>
                                </tr>
                            </thead>
                            <tbody>
                                {streams.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="text-center py-4" style={{ color: "var(--color-text-muted)" }}>
                                            No income streams yet.
                                        </td>
                                    </tr>
                                ) : (
                                    streams.map((stream) => (
                                        <tr key={stream.id}>
                                            <td>{stream.name}</td>
                                            <td>{Number(stream.defaultAmountPhp).toFixed(2)}</td>
                                            <td>{stream.isActive ? "Active" : "Inactive"}</td>
                                            <td style={{ maxWidth: "20rem" }}>{stream.remarks?.trim() || "-"}</td>
                                            <td>
                                                <form action={updateIncomeStreamAction} className="d-flex align-items-center gap-2">
                                                    <input type="hidden" name="id" value={stream.id} />
                                                    <input
                                                        type="number"
                                                        name="defaultAmountPhp"
                                                        className="form-control form-control-sm"
                                                        defaultValue={Number(stream.defaultAmountPhp).toFixed(2)}
                                                        min="0"
                                                        step="0.01"
                                                        style={{ width: "8rem" }}
                                                        required
                                                    />
                                                    <input
                                                        type="text"
                                                        name="remarks"
                                                        className="form-control form-control-sm"
                                                        defaultValue={stream.remarks ?? ""}
                                                        placeholder="Remarks"
                                                    />
                                                    <label className="small d-flex align-items-center gap-1 m-0">
                                                        <input type="checkbox" name="isActive" defaultChecked={stream.isActive} />
                                                        Active
                                                    </label>
                                                    <Button type="submit" size="sm" variant="outline-primary">Save</Button>
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
