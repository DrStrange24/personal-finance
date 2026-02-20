import { TransactionKind, WalletAccountType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import Card from "react-bootstrap/Card";
import CardBody from "react-bootstrap/CardBody";
import AddWalletAccountModal from "./add-wallet-account-modal";
import WalletAccountGrid from "./wallet-account-grid";
import styles from "./page.module.scss";
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
    const groupedAccountCards = groupedAccounts.map((group) => ({
        type: group.type,
        label: group.label,
        entries: group.entries.map((account) => ({
            id: account.id,
            type: account.type,
            name: account.name,
            currentBalancePhp: Number(account.currentBalancePhp),
            creditLimitPhp: account.creditLimitPhp === null ? null : Number(account.creditLimitPhp),
            statementClosingDay: account.statementClosingDay,
            statementDueDay: account.statementDueDay,
        })),
    }));
    const accountTypeOptions = Object.values(WalletAccountType).map((type) => ({
        value: type,
        label: walletAccountTypeLabel[type],
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

            <div className={styles.walletSummaryGrid}>
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

            <AddWalletAccountModal
                accountTypeOptions={accountTypeOptions}
                createWalletAccountAction={createWalletAccountAction}
            />

            <WalletAccountGrid
                groups={groupedAccountCards}
                accountTypeOptions={accountTypeOptions}
                updateWalletAccountAction={updateWalletAccountAction}
                archiveWalletAccountAction={archiveWalletAccountAction}
            />
        </section>
    );
}
