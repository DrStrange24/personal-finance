import { revalidatePath } from "next/cache";
import Card from "react-bootstrap/Card";
import CardBody from "react-bootstrap/CardBody";
import AddInvestmentModal from "./add-investment-modal";
import InvestmentTable from "./investment-table";
import { ensureFinanceBootstrap } from "@/lib/finance/bootstrap";
import { formatPhp, parseMoneyInput, parseOptionalText } from "@/lib/finance/money";
import { getAuthenticatedSession } from "@/lib/server-session";
import { prisma } from "@/lib/prisma";

type InvestmentActionResult = {
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

export default async function InvestmentPage() {
    const session = await getAuthenticatedSession();
    await ensureFinanceBootstrap(session.userId);

    const createInvestmentAction = async (formData: FormData): Promise<InvestmentActionResult> => {
        "use server";
        const actionSession = await getAuthenticatedSession();

        const name = parseRequiredName(formData.get("name"));
        const initialResult = parseMoneyInput(formData.get("initialInvestmentPhp"), true);
        const currentResult = parseMoneyInput(formData.get("currentValuePhp"), true);
        const remarksResult = parseOptionalText(formData.get("remarks"), 300);

        if (!name || !initialResult.ok || initialResult.value === null || !currentResult.ok || currentResult.value === null || !remarksResult.ok) {
            return { ok: false, message: "Please provide valid investment details." };
        }

        try {
            await prisma.investment.create({
                data: {
                    userId: actionSession.userId,
                    name,
                    initialInvestmentPhp: initialResult.value,
                    currentValuePhp: currentResult.value,
                    remarks: remarksResult.value,
                },
            });

            revalidatePath("/investment");
            return { ok: true, message: "Investment created successfully." };
        } catch {
            return { ok: false, message: "Could not create investment. Please try again." };
        }
    };

    const updateInvestmentAction = async (formData: FormData): Promise<InvestmentActionResult> => {
        "use server";
        const actionSession = await getAuthenticatedSession();

        const id = typeof formData.get("id") === "string" ? String(formData.get("id")).trim() : "";
        const name = parseRequiredName(formData.get("name"));
        const initialResult = parseMoneyInput(formData.get("initialInvestmentPhp"), true);
        const currentResult = parseMoneyInput(formData.get("currentValuePhp"), true);
        const remarksResult = parseOptionalText(formData.get("remarks"), 300);

        if (!id || !name || !initialResult.ok || initialResult.value === null || !currentResult.ok || currentResult.value === null || !remarksResult.ok) {
            return { ok: false, message: "Please provide valid investment details." };
        }

        try {
            const updated = await prisma.investment.updateMany({
                where: {
                    id,
                    userId: actionSession.userId,
                    isArchived: false,
                },
                data: {
                    name,
                    initialInvestmentPhp: initialResult.value,
                    currentValuePhp: currentResult.value,
                    remarks: remarksResult.value,
                },
            });

            if (updated.count === 0) {
                return { ok: false, message: "Investment not found." };
            }

            revalidatePath("/investment");
            return { ok: true, message: "Investment updated successfully." };
        } catch {
            return { ok: false, message: "Could not update investment. Please try again." };
        }
    };

    const deleteInvestmentAction = async (formData: FormData): Promise<InvestmentActionResult> => {
        "use server";
        const actionSession = await getAuthenticatedSession();

        const id = typeof formData.get("id") === "string" ? String(formData.get("id")).trim() : "";
        if (!id) {
            return { ok: false, message: "Missing investment id." };
        }

        try {
            const archived = await prisma.investment.updateMany({
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
                return { ok: false, message: "Investment not found." };
            }

            revalidatePath("/investment");
            return { ok: true, message: "Investment deleted successfully." };
        } catch {
            return { ok: false, message: "Could not delete investment. Please try again." };
        }
    };

    const investments = await prisma.investment.findMany({
        where: {
            userId: session.userId,
            isArchived: false,
        },
        orderBy: [{ createdAt: "desc" }],
    });

    const investmentRows = investments.map((investment) => {
        const initialInvestmentPhp = Number(investment.initialInvestmentPhp);
        const currentValuePhp = Number(investment.currentValuePhp);

        return {
            id: investment.id,
            name: investment.name,
            initialInvestmentPhp,
            currentValuePhp,
            gainLossPhp: currentValuePhp - initialInvestmentPhp,
            remarks: investment.remarks,
        };
    });

    const totals = investmentRows.reduce((acc, row) => ({
        totalInitialPhp: acc.totalInitialPhp + row.initialInvestmentPhp,
        totalCurrentPhp: acc.totalCurrentPhp + row.currentValuePhp,
    }), {
        totalInitialPhp: 0,
        totalCurrentPhp: 0,
    });
    const totalGainLossPhp = totals.totalCurrentPhp - totals.totalInitialPhp;

    return (
        <section className="d-grid gap-4">
            <header className="d-grid gap-2">
                <p className="m-0 text-uppercase small" style={{ letterSpacing: "0.3em", color: "var(--color-kicker-secondary)" }}>Portfolio</p>
                <h2 className="m-0 fs-2 fw-semibold" style={{ color: "var(--color-text-strong)" }}>Investments</h2>
                <p className="m-0 small" style={{ color: "var(--color-text-muted)" }}>
                    Track each investment with initial amount, current value, and gain/loss.
                </p>
            </header>

            <div className="d-grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                <Card className="pf-surface-card">
                    <CardBody className="d-grid gap-1">
                        <small className="text-uppercase" style={{ letterSpacing: "0.08em", color: "var(--color-text-muted)" }}>Total Initial</small>
                        <p className="m-0 fs-5 fw-semibold">{formatPhp(totals.totalInitialPhp)}</p>
                    </CardBody>
                </Card>
                <Card className="pf-surface-card">
                    <CardBody className="d-grid gap-1">
                        <small className="text-uppercase" style={{ letterSpacing: "0.08em", color: "var(--color-text-muted)" }}>Total Current Value</small>
                        <p className="m-0 fs-5 fw-semibold">{formatPhp(totals.totalCurrentPhp)}</p>
                    </CardBody>
                </Card>
                <Card className="pf-surface-card">
                    <CardBody className="d-grid gap-1">
                        <small className="text-uppercase" style={{ letterSpacing: "0.08em", color: "var(--color-text-muted)" }}>Total Gain/Loss</small>
                        <p className={`m-0 fs-5 fw-semibold ${totalGainLossPhp >= 0 ? "text-success" : "text-danger"}`}>
                            {formatPhp(totalGainLossPhp)}
                        </p>
                    </CardBody>
                </Card>
            </div>

            <AddInvestmentModal createInvestmentAction={createInvestmentAction} />

            <InvestmentTable
                investments={investmentRows}
                updateInvestmentAction={updateInvestmentAction}
                deleteInvestmentAction={deleteInvestmentAction}
            />
        </section>
    );
}
