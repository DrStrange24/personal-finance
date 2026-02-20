import { TransactionKind, WalletAccountType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import Button from "react-bootstrap/Button";
import Card from "react-bootstrap/Card";
import CardBody from "react-bootstrap/CardBody";
import Table from "react-bootstrap/Table";
import { ensureFinanceBootstrap } from "@/lib/finance/bootstrap";
import { formatPhp, parseMoneyInput } from "@/lib/finance/money";
import { walletAccountTypeLabel } from "@/lib/finance/types";
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

const parseAccountType = (value: FormDataEntryValue | null): WalletAccountType | null => {
    if (typeof value !== "string") {
        return null;
    }
    const normalized = value.trim() as WalletAccountType;
    return Object.values(WalletAccountType).includes(normalized) ? normalized : null;
};

const parseOptionalDay = (value: FormDataEntryValue | null) => {
    if (typeof value !== "string" || value.trim().length === 0) {
        return null;
    }
    const parsed = Number(value.trim());
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 31) {
        return null;
    }
    return parsed;
};

export default async function WalletPage() {
    const session = await getAuthenticatedSession();
    await ensureFinanceBootstrap(session.userId);

    const createWalletAccountAction = async (formData: FormData) => {
        "use server";

        const actionSession = await getAuthenticatedSession();
        const type = parseAccountType(formData.get("type"));
        const name = parseRequiredName(formData.get("name"));
        const balanceResult = parseMoneyInput(formData.get("currentBalancePhp"), true);
        const creditLimitResult = parseMoneyInput(formData.get("creditLimitPhp"), false);
        const statementClosingDay = parseOptionalDay(formData.get("statementClosingDay"));
        const statementDueDay = parseOptionalDay(formData.get("statementDueDay"));

        if (!type || !name || !balanceResult.ok || balanceResult.value === null || !creditLimitResult.ok) {
            return;
        }

        const account = await prisma.walletAccount.create({
            data: {
                userId: actionSession.userId,
                type,
                name,
                currentBalancePhp: balanceResult.value,
                creditLimitPhp: type === WalletAccountType.CREDIT_CARD ? creditLimitResult.value : null,
                statementClosingDay: type === WalletAccountType.CREDIT_CARD ? statementClosingDay : null,
                statementDueDay: type === WalletAccountType.CREDIT_CARD ? statementDueDay : null,
            },
        });

        if (balanceResult.value > 0) {
            await prisma.financeTransaction.create({
                data: {
                    userId: actionSession.userId,
                    kind: TransactionKind.ADJUSTMENT,
                    amountPhp: balanceResult.value,
                    walletAccountId: account.id,
                    countsTowardBudget: false,
                    remarks: "Opening balance for new wallet account.",
                },
            });
        }

        revalidatePath("/wallet");
        revalidatePath("/dashboard");
    };

    const updateWalletAccountAction = async (formData: FormData) => {
        "use server";

        const actionSession = await getAuthenticatedSession();
        const id = typeof formData.get("id") === "string" ? String(formData.get("id")).trim() : "";
        const type = parseAccountType(formData.get("type"));
        const name = parseRequiredName(formData.get("name"));
        const balanceResult = parseMoneyInput(formData.get("currentBalancePhp"), true);
        const creditLimitResult = parseMoneyInput(formData.get("creditLimitPhp"), false);
        const statementClosingDay = parseOptionalDay(formData.get("statementClosingDay"));
        const statementDueDay = parseOptionalDay(formData.get("statementDueDay"));

        if (!id || !type || !name || !balanceResult.ok || balanceResult.value === null || !creditLimitResult.ok) {
            return;
        }

        const existing = await prisma.walletAccount.findFirst({
            where: {
                id,
                userId: actionSession.userId,
                isArchived: false,
            },
        });

        if (!existing) {
            return;
        }

        await prisma.walletAccount.update({
            where: { id: existing.id },
            data: {
                type,
                name,
                currentBalancePhp: balanceResult.value,
                creditLimitPhp: type === WalletAccountType.CREDIT_CARD ? creditLimitResult.value : null,
                statementClosingDay: type === WalletAccountType.CREDIT_CARD ? statementClosingDay : null,
                statementDueDay: type === WalletAccountType.CREDIT_CARD ? statementDueDay : null,
            },
        });

        const delta = balanceResult.value - Number(existing.currentBalancePhp);
        if (Math.abs(delta) > 0.0001) {
            await prisma.financeTransaction.create({
                data: {
                    userId: actionSession.userId,
                    kind: TransactionKind.ADJUSTMENT,
                    amountPhp: Math.abs(delta),
                    walletAccountId: existing.id,
                    countsTowardBudget: false,
                    remarks: `Balance override (${delta >= 0 ? "increase" : "decrease"}).`,
                },
            });
        }

        revalidatePath("/wallet");
        revalidatePath("/dashboard");
    };

    const archiveWalletAccountAction = async (formData: FormData) => {
        "use server";
        const actionSession = await getAuthenticatedSession();
        const id = typeof formData.get("id") === "string" ? String(formData.get("id")).trim() : "";

        if (!id) {
            return;
        }

        await prisma.walletAccount.updateMany({
            where: {
                id,
                userId: actionSession.userId,
                isArchived: false,
            },
            data: {
                isArchived: true,
            },
        });

        revalidatePath("/wallet");
        revalidatePath("/dashboard");
    };

    const accounts = await prisma.walletAccount.findMany({
        where: {
            userId: session.userId,
            isArchived: false,
        },
        orderBy: [{ type: "asc" }, { createdAt: "asc" }],
    });

    const groupedAccounts = Object.values(WalletAccountType).map((type) => ({
        type,
        label: walletAccountTypeLabel[type],
        entries: accounts.filter((account) => account.type === type),
    }));

    const totalNonCredit = accounts
        .filter((account) => account.type !== WalletAccountType.CREDIT_CARD)
        .reduce((sum, account) => sum + Number(account.currentBalancePhp), 0);
    const totalCreditDebt = accounts
        .filter((account) => account.type === WalletAccountType.CREDIT_CARD)
        .reduce((sum, account) => sum + Number(account.currentBalancePhp), 0);

    return (
        <section className="d-grid gap-4">
            <header className="d-grid gap-2">
                <p className="m-0 text-uppercase small" style={{ letterSpacing: "0.3em", color: "var(--color-kicker-primary)" }}>Main Page</p>
                <h2 className="m-0 fs-2 fw-semibold" style={{ color: "var(--color-text-strong)" }}>Wallet Accounts</h2>
                <p className="m-0 small" style={{ color: "var(--color-text-muted)" }}>
                    Ledger-compatible accounts with wallet, bank, e-wallet, asset, and credit card support.
                </p>
            </header>

            <div className="d-grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                <Card className="pf-surface-card">
                    <CardBody className="d-grid gap-1">
                        <small className="text-uppercase" style={{ letterSpacing: "0.08em", color: "var(--color-text-muted)" }}>Cash / Assets Total</small>
                        <p className="m-0 fs-5 fw-semibold">{formatPhp(totalNonCredit)}</p>
                    </CardBody>
                </Card>
                <Card className="pf-surface-card">
                    <CardBody className="d-grid gap-1">
                        <small className="text-uppercase" style={{ letterSpacing: "0.08em", color: "var(--color-text-muted)" }}>Credit Card Debt</small>
                        <p className="m-0 fs-5 fw-semibold text-danger">{formatPhp(totalCreditDebt)}</p>
                    </CardBody>
                </Card>
                <Card className="pf-surface-card">
                    <CardBody className="d-grid gap-1">
                        <small className="text-uppercase" style={{ letterSpacing: "0.08em", color: "var(--color-text-muted)" }}>Net Position</small>
                        <p className="m-0 fs-5 fw-semibold">{formatPhp(totalNonCredit - totalCreditDebt)}</p>
                    </CardBody>
                </Card>
            </div>

            <Card className="pf-surface-panel">
                <CardBody className="d-grid gap-3">
                    <h3 className="m-0 fs-6 fw-semibold">Add Wallet Account</h3>
                    <form action={createWalletAccountAction} className="d-grid gap-3">
                        <div className="d-grid gap-1">
                            <label htmlFor="wallet-type" className="small fw-semibold">Type</label>
                            <select id="wallet-type" name="type" className="form-control" defaultValue="CASH">
                                {Object.values(WalletAccountType).map((type) => (
                                    <option key={type} value={type}>{walletAccountTypeLabel[type]}</option>
                                ))}
                            </select>
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="wallet-name" className="small fw-semibold">Name</label>
                            <input id="wallet-name" type="text" name="name" className="form-control" maxLength={80} required />
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="wallet-balance" className="small fw-semibold">Current Balance (PHP)</label>
                            <input id="wallet-balance" type="number" name="currentBalancePhp" className="form-control" min="0" step="0.01" required />
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="wallet-credit-limit" className="small fw-semibold">Credit Limit (for credit card)</label>
                            <input id="wallet-credit-limit" type="number" name="creditLimitPhp" className="form-control" min="0" step="0.01" />
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="wallet-statement-close" className="small fw-semibold">Statement Closing Day (1-31)</label>
                            <input id="wallet-statement-close" type="number" name="statementClosingDay" className="form-control" min="1" max="31" />
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="wallet-statement-due" className="small fw-semibold">Statement Due Day (1-31)</label>
                            <input id="wallet-statement-due" type="number" name="statementDueDay" className="form-control" min="1" max="31" />
                        </div>
                        <Button type="submit">Create Account</Button>
                    </form>
                </CardBody>
            </Card>

            {groupedAccounts.map((group) => (
                <Card key={group.type} className="pf-surface-panel">
                    <CardBody className="d-grid gap-3">
                        <h3 className="m-0 fs-6 fw-semibold">{group.label}</h3>
                        <div className="table-responsive">
                            <Table hover className="align-middle mb-0">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Balance</th>
                                        <th>Credit Limit</th>
                                        <th>Statement</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {group.entries.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="text-center py-4" style={{ color: "var(--color-text-muted)" }}>
                                                No accounts in this group.
                                            </td>
                                        </tr>
                                    ) : (
                                        group.entries.map((account) => (
                                            <tr key={account.id}>
                                                <td>{account.name}</td>
                                                <td className={account.type === WalletAccountType.CREDIT_CARD ? "text-danger" : ""}>
                                                    {formatPhp(Number(account.currentBalancePhp))}
                                                </td>
                                                <td>{account.creditLimitPhp === null ? "-" : formatPhp(Number(account.creditLimitPhp))}</td>
                                                <td>
                                                    {account.statementClosingDay && account.statementDueDay
                                                        ? `${account.statementClosingDay} -> ${account.statementDueDay}`
                                                        : "-"}
                                                </td>
                                                <td>
                                                    <details>
                                                        <summary style={{ cursor: "pointer" }}>Edit</summary>
                                                        <form action={updateWalletAccountAction} className="d-grid gap-2 mt-2">
                                                            <input type="hidden" name="id" value={account.id} />
                                                            <select name="type" className="form-control form-control-sm" defaultValue={account.type}>
                                                                {Object.values(WalletAccountType).map((type) => (
                                                                    <option key={type} value={type}>{walletAccountTypeLabel[type]}</option>
                                                                ))}
                                                            </select>
                                                            <input type="text" name="name" className="form-control form-control-sm" defaultValue={account.name} required />
                                                            <input
                                                                type="number"
                                                                name="currentBalancePhp"
                                                                className="form-control form-control-sm"
                                                                defaultValue={Number(account.currentBalancePhp).toFixed(2)}
                                                                min="0"
                                                                step="0.01"
                                                                required
                                                            />
                                                            <input
                                                                type="number"
                                                                name="creditLimitPhp"
                                                                className="form-control form-control-sm"
                                                                defaultValue={account.creditLimitPhp === null ? "" : Number(account.creditLimitPhp).toFixed(2)}
                                                                min="0"
                                                                step="0.01"
                                                            />
                                                            <input
                                                                type="number"
                                                                name="statementClosingDay"
                                                                className="form-control form-control-sm"
                                                                defaultValue={account.statementClosingDay ?? ""}
                                                                min="1"
                                                                max="31"
                                                            />
                                                            <input
                                                                type="number"
                                                                name="statementDueDay"
                                                                className="form-control form-control-sm"
                                                                defaultValue={account.statementDueDay ?? ""}
                                                                min="1"
                                                                max="31"
                                                            />
                                                            <div className="d-flex gap-2">
                                                                <Button size="sm" type="submit" variant="outline-primary">Save</Button>
                                                            </div>
                                                        </form>
                                                        <form action={archiveWalletAccountAction} className="mt-2">
                                                            <input type="hidden" name="id" value={account.id} />
                                                            <Button size="sm" variant="outline-danger" type="submit">Archive</Button>
                                                        </form>
                                                    </details>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </Table>
                        </div>
                    </CardBody>
                </Card>
            ))}
        </section>
    );
}
