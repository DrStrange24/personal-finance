import { revalidatePath } from "next/cache";
import Card from "react-bootstrap/Card";
import CardBody from "react-bootstrap/CardBody";
import AddCreditAccountModal from "./add-credit-account-modal";
import CreditAccountTable from "./credit-account-table";
import { ensureFinanceBootstrap } from "@/lib/finance/bootstrap";
import { formatPhp, parseMoneyInput } from "@/lib/finance/money";
import { getAuthenticatedEntitySession } from "@/lib/server-session";
import { prisma } from "@/lib/prisma";

type CreditAccountActionResult = {
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

export default async function CreditPage() {
    const session = await getAuthenticatedEntitySession();
    await ensureFinanceBootstrap(session.userId, session.activeEntity.id);

    const createCreditAccountAction = async (formData: FormData): Promise<CreditAccountActionResult> => {
        "use server";

        const actionSession = await getAuthenticatedEntitySession();
        const name = parseRequiredName(formData.get("name"));
        const creditLimitResult = parseMoneyInput(formData.get("creditLimitAmount"), true);

        if (
            !name
            || !creditLimitResult.ok
            || creditLimitResult.value === null
        ) {
            return { ok: false, message: "Please provide valid credit account details." };
        }

        try {
            await prisma.creditAccount.create({
                data: {
                    userId: actionSession.userId,
                    name,
                    creditLimitAmount: creditLimitResult.value,
                    currentBalanceAmount: 0,
                },
            });

            revalidatePath("/credit");
            return { ok: true, message: "Credit account created successfully." };
        } catch {
            return { ok: false, message: "Could not create credit account. Please try again." };
        }
    };

    const updateCreditAccountAction = async (formData: FormData): Promise<CreditAccountActionResult> => {
        "use server";

        const actionSession = await getAuthenticatedEntitySession();
        const id = typeof formData.get("id") === "string" ? String(formData.get("id")).trim() : "";
        const name = parseRequiredName(formData.get("name"));
        const creditLimitResult = parseMoneyInput(formData.get("creditLimitAmount"), true);

        if (
            !id
            || !name
            || !creditLimitResult.ok
            || creditLimitResult.value === null
        ) {
            return { ok: false, message: "Please provide valid credit account details." };
        }

        const existing = await prisma.creditAccount.findFirst({
            where: {
                id,
                userId: actionSession.userId,
                isArchived: false,
            },
        });

        if (!existing) {
            return { ok: false, message: "Credit account not found." };
        }

        try {
            await prisma.creditAccount.update({
                where: { id: existing.id },
                data: {
                    name,
                    creditLimitAmount: creditLimitResult.value,
                },
            });

            revalidatePath("/credit");
            return { ok: true, message: "Credit account updated successfully." };
        } catch {
            return { ok: false, message: "Could not update credit account. Please try again." };
        }
    };

    const archiveCreditAccountAction = async (formData: FormData): Promise<CreditAccountActionResult> => {
        "use server";

        const actionSession = await getAuthenticatedEntitySession();
        const id = typeof formData.get("id") === "string" ? String(formData.get("id")).trim() : "";

        if (!id) {
            return { ok: false, message: "Missing credit account id." };
        }

        try {
            const archived = await prisma.creditAccount.updateMany({
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
                return { ok: false, message: "Credit account not found or already archived." };
            }

            revalidatePath("/credit");
            return { ok: true, message: "Credit account archived successfully." };
        } catch {
            return { ok: false, message: "Could not archive credit account. Please try again." };
        }
    };

    const accounts = await prisma.creditAccount.findMany({
        where: {
            userId: session.userId,
            isArchived: false,
        },
        orderBy: [{ createdAt: "desc" }],
    });

    const creditRows = accounts.map((account) => ({
        id: account.id,
        name: account.name,
        creditLimitAmount: Number(account.creditLimitAmount),
        currentBalanceAmount: Number(account.currentBalanceAmount),
        createdAtLabel: account.createdAt.toISOString().slice(0, 10),
    }));

    const totalLimitPhp = creditRows.reduce((sum, account) => sum + account.creditLimitAmount, 0);
    const totalUsedPhp = creditRows.reduce((sum, account) => sum + account.currentBalanceAmount, 0);
    const totalRemainingPhp = totalLimitPhp - totalUsedPhp;

    return (
        <section className="d-grid gap-4">
            <header className="d-grid gap-2">
                <p className="m-0 text-uppercase small" style={{ letterSpacing: "0.3em", color: "var(--color-kicker-tertiary)" }}>Credit</p>
                <h2 className="m-0 fs-2 fw-semibold" style={{ color: "var(--color-text-strong)" }}>Credit Management</h2>
                <p className="m-0 small" style={{ color: "var(--color-text-muted)" }}>
                    Manage your credit card accounts, balances, and account lifecycle in one place.
                </p>
            </header>

            <div className="d-grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                <Card className="pf-surface-card">
                    <CardBody className="d-grid gap-1">
                        <small className="text-uppercase" style={{ letterSpacing: "0.08em", color: "var(--color-text-muted)" }}>Cards</small>
                        <p className="m-0 fs-5 fw-semibold">{creditRows.length}</p>
                    </CardBody>
                </Card>
                <Card className="pf-surface-card">
                    <CardBody className="d-grid gap-1">
                        <small className="text-uppercase" style={{ letterSpacing: "0.08em", color: "var(--color-text-muted)" }}>Total Limit</small>
                        <p className="m-0 fs-5 fw-semibold">{formatPhp(totalLimitPhp)}</p>
                    </CardBody>
                </Card>
                <Card className="pf-surface-card">
                    <CardBody className="d-grid gap-1">
                        <small className="text-uppercase" style={{ letterSpacing: "0.08em", color: "var(--color-text-muted)" }}>Total Used</small>
                        <p className="m-0 fs-5 fw-semibold text-danger">{formatPhp(totalUsedPhp)}</p>
                    </CardBody>
                </Card>
                <Card className="pf-surface-card">
                    <CardBody className="d-grid gap-1">
                        <small className="text-uppercase" style={{ letterSpacing: "0.08em", color: "var(--color-text-muted)" }}>Total Remaining</small>
                        <p className={`m-0 fs-5 fw-semibold ${totalRemainingPhp >= 0 ? "text-success" : "text-danger"}`}>
                            {formatPhp(totalRemainingPhp)}
                        </p>
                    </CardBody>
                </Card>
            </div>

            <AddCreditAccountModal createCreditAccountAction={createCreditAccountAction} />

            <CreditAccountTable
                accounts={creditRows}
                updateCreditAccountAction={updateCreditAccountAction}
                archiveCreditAccountAction={archiveCreditAccountAction}
            />
        </section>
    );
}
