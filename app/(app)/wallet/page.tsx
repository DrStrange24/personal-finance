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

type WalletAccountActionResult = {
    ok: boolean;
    message: string;
};

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

export default async function WalletPage() {
    const session = await getAuthenticatedSession();
    await ensureFinanceBootstrap(session.userId);

    const createWalletAccountAction = async (formData: FormData): Promise<WalletAccountActionResult> => {
        "use server";

        const actionSession = await getAuthenticatedSession();
        const type = parseAccountType(formData.get("type"));
        const name = parseRequiredName(formData.get("name"));
        const balanceResult = parseMoneyInput(formData.get("currentBalanceAmount"), true);

        if (!type || type === WalletAccountType.ASSET || !name || !balanceResult.ok || balanceResult.value === null) {
            return { ok: false, message: "Please provide valid wallet account details." };
        }

        try {
            const account = await prisma.walletAccount.create({
                data: {
                    userId: actionSession.userId,
                    type,
                    name,
                    currentBalanceAmount: balanceResult.value,
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
            return { ok: true, message: "Wallet account created successfully." };
        } catch {
            return { ok: false, message: "Could not create wallet account. Please try again." };
        }
    };

    const updateWalletAccountAction = async (formData: FormData): Promise<WalletAccountActionResult> => {
        "use server";

        const actionSession = await getAuthenticatedSession();
        const id = typeof formData.get("id") === "string" ? String(formData.get("id")).trim() : "";
        const type = parseAccountType(formData.get("type"));
        const name = parseRequiredName(formData.get("name"));
        const balanceResult = parseMoneyInput(formData.get("currentBalanceAmount"), true);

        if (!id || !type || type === WalletAccountType.ASSET || !name || !balanceResult.ok || balanceResult.value === null) {
            return { ok: false, message: "Please provide valid wallet account details." };
        }

        const existing = await prisma.walletAccount.findFirst({
            where: {
                id,
                userId: actionSession.userId,
                isArchived: false,
            },
        });

        if (!existing) {
            return { ok: false, message: "Wallet account not found." };
        }

        try {
            await prisma.walletAccount.update({
                where: { id: existing.id },
                data: {
                    type,
                    name,
                    currentBalanceAmount: balanceResult.value,
                },
            });

            const delta = balanceResult.value - Number(existing.currentBalanceAmount);
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
            return { ok: true, message: "Wallet account updated successfully." };
        } catch {
            return { ok: false, message: "Could not update wallet account. Please try again." };
        }
    };

    const archiveWalletAccountAction = async (formData: FormData): Promise<WalletAccountActionResult> => {
        "use server";
        const actionSession = await getAuthenticatedSession();
        const id = typeof formData.get("id") === "string" ? String(formData.get("id")).trim() : "";

        if (!id) {
            return { ok: false, message: "Missing wallet account id." };
        }

        try {
            const archived = await prisma.walletAccount.updateMany({
                where: {
                    id,
                    userId: actionSession.userId,
                    isArchived: false,
                },
                data: {
                    isArchived: true,
                },
            });

            if (archived.count === 0) {
                return { ok: false, message: "Wallet account not found or already archived." };
            }

            revalidatePath("/wallet");
            revalidatePath("/dashboard");
            return { ok: true, message: "Wallet account archived successfully." };
        } catch {
            return { ok: false, message: "Could not archive wallet account. Please try again." };
        }
    };

    const accounts = await prisma.walletAccount.findMany({
        where: {
            userId: session.userId,
            isArchived: false,
            type: {
                in: [WalletAccountType.CASH, WalletAccountType.BANK, WalletAccountType.E_WALLET],
            },
        },
        orderBy: [{ type: "asc" }, { createdAt: "asc" }],
    });

    const visibleWalletTypes = [WalletAccountType.CASH, WalletAccountType.BANK, WalletAccountType.E_WALLET];
    const groupedAccounts = visibleWalletTypes.map((type) => ({
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
            currentBalanceAmount: Number(account.currentBalanceAmount),
        })),
    }));
    const accountTypeOptions = visibleWalletTypes
        .map((type) => ({
        value: type,
        label: walletAccountTypeLabel[type],
    }));

    const totalNonCredit = accounts
        .reduce((sum, account) => sum + Number(account.currentBalanceAmount), 0);

    return (
        <section className="d-grid gap-4">
            <header className="d-grid gap-2">
                <p className="m-0 text-uppercase small" style={{ letterSpacing: "0.3em", color: "var(--color-kicker-primary)" }}>Main Page</p>
                <h2 className="m-0 fs-2 fw-semibold" style={{ color: "var(--color-text-strong)" }}>Wallet Accounts</h2>
                <p className="m-0 small" style={{ color: "var(--color-text-muted)" }}>
                    Ledger-compatible accounts with cash, bank, e-wallet, and credit card support.
                </p>
            </header>

            <div className={styles.walletSummaryGrid}>
                <Card className="pf-surface-card">
                    <CardBody className="d-grid gap-1">
                        <small className="text-uppercase" style={{ letterSpacing: "0.08em", color: "var(--color-text-muted)" }}>Wallet Total</small>
                        <p className="m-0 fs-5 fw-semibold">{formatPhp(totalNonCredit)}</p>
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

