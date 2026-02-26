import { revalidatePath } from "next/cache";
import { BudgetEnvelopeSystemType } from "@prisma/client";
import Card from "react-bootstrap/Card";
import CardBody from "react-bootstrap/CardBody";
import AddCreditAccountModal from "./add-credit-account-modal";
import CreditAccountTable from "./credit-account-table";
import { ensureFinanceBootstrap } from "@/lib/finance/bootstrap";
import { buildCreditCardPaymentEnvelopeName } from "@/lib/finance/credit-payment-envelope";
import {
    ensureUniqueActiveCreditAccountName,
} from "@/lib/finance/entity-scoped-records";
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
    await Promise.all(session.entities.map((entity) => ensureFinanceBootstrap(session.userId, entity.id)));

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
            await ensureUniqueActiveCreditAccountName(
                prisma,
                actionSession.userId,
                actionSession.activeEntity.id,
                name,
            );

            await prisma.creditAccount.create({
                data: {
                    userId: actionSession.userId,
                    entityId: actionSession.activeEntity.id,
                    name,
                    creditLimitAmount: creditLimitResult.value,
                    currentBalanceAmount: 0,
                },
            });

            revalidatePath("/credit");
            return { ok: true, message: "Credit account created successfully." };
        } catch (error) {
            return {
                ok: false,
                message: error instanceof Error ? error.message : "Could not create credit account. Please try again.",
            };
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

        try {
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
            await ensureUniqueActiveCreditAccountName(
                prisma,
                actionSession.userId,
                existing.entityId,
                name,
                existing.id,
            );

            await prisma.creditAccount.update({
                where: { id: existing.id },
                data: {
                    name,
                    creditLimitAmount: creditLimitResult.value,
                },
            });

            revalidatePath("/credit");
            return { ok: true, message: "Credit account updated successfully." };
        } catch (error) {
            return {
                ok: false,
                message: error instanceof Error ? error.message : "Could not update credit account. Please try again.",
            };
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
        } catch (error) {
            return {
                ok: false,
                message: error instanceof Error ? error.message : "Could not archive credit account. Please try again.",
            };
        }
    };

    const [accounts, ccPaymentEnvelopes] = await Promise.all([
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
                        type: true,
                    },
                },
            },
            orderBy: { name: "asc" },
        }),
        prisma.budgetEnvelope.findMany({
            where: {
                userId: session.userId,
                isArchived: false,
                isSystem: true,
                systemType: BudgetEnvelopeSystemType.CREDIT_CARD_PAYMENT,
                entity: {
                    isArchived: false,
                },
            },
            select: {
                id: true,
                name: true,
                availablePhp: true,
                linkedCreditAccountId: true,
            },
        }),
    ]);
    const reserveByCreditAccountId = new Map<string, number>();
    const reserveByEnvelopeName = new Map<string, number>();
    for (const envelope of ccPaymentEnvelopes) {
        if (envelope.linkedCreditAccountId) {
            reserveByCreditAccountId.set(envelope.linkedCreditAccountId, Number(envelope.availablePhp));
        }
        reserveByEnvelopeName.set(envelope.name, Number(envelope.availablePhp));
    }

    const creditRows = accounts.map((account) => ({
        id: account.id,
        name: account.name,
        creditLimitAmount: Number(account.creditLimitAmount),
        currentBalanceAmount: Number(account.currentBalanceAmount),
        entityName: account.entity?.name ?? "-",
        paymentReservePhp: reserveByCreditAccountId.get(account.id)
            ?? reserveByEnvelopeName.get(buildCreditCardPaymentEnvelopeName(account.name))
            ?? 0,
        createdAtLabel: account.createdAt.toISOString().slice(0, 10),
    }));

    const totalLimitPhp = creditRows.reduce((sum, account) => sum + account.creditLimitAmount, 0);
    const totalUsedPhp = creditRows.reduce((sum, account) => sum + account.currentBalanceAmount, 0);
    const totalReservePhp = creditRows.reduce((sum, account) => sum + account.paymentReservePhp, 0);
    const totalRemainingPhp = totalLimitPhp - totalUsedPhp;

    return (
        <section className="d-grid gap-4">
            <header className="d-grid gap-2">
                <p className="m-0 text-uppercase small" style={{ letterSpacing: "0.3em", color: "var(--color-kicker-tertiary)" }}>Credit</p>
                <h2 className="m-0 fs-2 fw-semibold" style={{ color: "var(--color-text-strong)" }}>Credit Management</h2>
                <p className="m-0 small" style={{ color: "var(--color-text-muted)" }}>
                    Manage credit card accounts across all entities, with balances and lifecycle controls in one place.
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
                <Card className="pf-surface-card">
                    <CardBody className="d-grid gap-1">
                        <small className="text-uppercase" style={{ letterSpacing: "0.08em", color: "var(--color-text-muted)" }}>Reserved For Payment</small>
                        <p className="m-0 fs-5 fw-semibold">{formatPhp(totalReservePhp)}</p>
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
