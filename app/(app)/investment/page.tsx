import { revalidatePath } from "next/cache";
import Card from "react-bootstrap/Card";
import CardBody from "react-bootstrap/CardBody";
import AddInvestmentModal from "./add-investment-modal";
import InvestmentTable from "./investment-table";
import { ensureFinanceBootstrap } from "@/lib/finance/bootstrap";
import { getCoinsPhEstimatedValuePhp } from "@/lib/finance/coins-ph";
import {
    ensureUniqueActiveInvestmentName,
    listActiveInvestmentsByEntity,
    requireOwnedInvestment,
} from "@/lib/finance/entity-scoped-records";
import { formatPhp, parseMoneyInput, parseNumberInput, parseOptionalText } from "@/lib/finance/money";
import { getAuthenticatedEntitySession } from "@/lib/server-session";
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

const inferAssetSymbol = (name: string) => {
    const match = name.toUpperCase().match(/\b[A-Z]{2,10}\b/);
    return match?.[0] ?? "UNITS";
};

export default async function InvestmentPage() {
    const session = await getAuthenticatedEntitySession();
    const activeEntityId = session.activeEntity.id;
    await ensureFinanceBootstrap(session.userId, activeEntityId);

    const createInvestmentAction = async (formData: FormData): Promise<InvestmentActionResult> => {
        "use server";
        const actionSession = await getAuthenticatedEntitySession();

        const name = parseRequiredName(formData.get("name"));
        const initialResult = parseMoneyInput(formData.get("initialInvestmentPhp"), true);
        const valueResult = parseNumberInput(formData.get("value"), { required: true, allowNegative: false });
        const remarksResult = parseOptionalText(formData.get("remarks"), 300);

        if (
            !name
            || !initialResult.ok
            || initialResult.value === null
            || !valueResult.ok
            || valueResult.value === null
            || !remarksResult.ok
        ) {
            return { ok: false, message: "Please provide valid investment details." };
        }

        try {
            await ensureUniqueActiveInvestmentName(
                prisma,
                actionSession.userId,
                actionSession.activeEntity.id,
                name,
            );

            await prisma.investment.create({
                data: {
                    userId: actionSession.userId,
                    entityId: actionSession.activeEntity.id,
                    name,
                    initialInvestmentPhp: initialResult.value,
                    value: valueResult.value,
                    remarks: remarksResult.value,
                },
            });

            revalidatePath("/investment");
            return { ok: true, message: "Investment created successfully." };
        } catch (error) {
            return {
                ok: false,
                message: error instanceof Error ? error.message : "Could not create investment. Please try again.",
            };
        }
    };

    const updateInvestmentAction = async (formData: FormData): Promise<InvestmentActionResult> => {
        "use server";
        const actionSession = await getAuthenticatedEntitySession();

        const id = typeof formData.get("id") === "string" ? String(formData.get("id")).trim() : "";
        const name = parseRequiredName(formData.get("name"));
        const initialResult = parseMoneyInput(formData.get("initialInvestmentPhp"), true);
        const valueResult = parseNumberInput(formData.get("value"), { required: true, allowNegative: false });
        const remarksResult = parseOptionalText(formData.get("remarks"), 300);

        if (
            !id
            || !name
            || !initialResult.ok
            || initialResult.value === null
            || !valueResult.ok
            || valueResult.value === null
            || !remarksResult.ok
        ) {
            return { ok: false, message: "Please provide valid investment details." };
        }

        try {
            await requireOwnedInvestment(
                prisma,
                actionSession.userId,
                actionSession.activeEntity.id,
                id,
            );
            await ensureUniqueActiveInvestmentName(
                prisma,
                actionSession.userId,
                actionSession.activeEntity.id,
                name,
                id,
            );

            const updated = await prisma.investment.updateMany({
                where: {
                    id,
                    userId: actionSession.userId,
                    entityId: actionSession.activeEntity.id,
                    isArchived: false,
                },
                data: {
                    name,
                    initialInvestmentPhp: initialResult.value,
                    value: valueResult.value,
                    remarks: remarksResult.value,
                },
            });

            if (updated.count === 0) {
                return { ok: false, message: "Investment not found." };
            }

            revalidatePath("/investment");
            return { ok: true, message: "Investment updated successfully." };
        } catch (error) {
            return {
                ok: false,
                message: error instanceof Error ? error.message : "Could not update investment. Please try again.",
            };
        }
    };

    const deleteInvestmentAction = async (formData: FormData): Promise<InvestmentActionResult> => {
        "use server";
        const actionSession = await getAuthenticatedEntitySession();

        const id = typeof formData.get("id") === "string" ? String(formData.get("id")).trim() : "";
        if (!id) {
            return { ok: false, message: "Missing investment id." };
        }

        try {
            const archived = await prisma.investment.updateMany({
                where: {
                    id,
                    userId: actionSession.userId,
                    entityId: actionSession.activeEntity.id,
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
        } catch (error) {
            return {
                ok: false,
                message: error instanceof Error ? error.message : "Could not delete investment. Please try again.",
            };
        }
    };

    const investments = await listActiveInvestmentsByEntity(prisma, session.userId, activeEntityId);

    const estimatedValuePairs = await Promise.all(investments.map(async (investment) => {
        const symbol = inferAssetSymbol(investment.name);
        const estimatedPhpValue = await getCoinsPhEstimatedValuePhp(symbol, Number(investment.value));
        return [investment.id, { symbol, estimatedPhpValue }] as const;
    }));
    const estimatedById = new Map(estimatedValuePairs);

    const investmentRows = investments.map((investment) => {
        const initialInvestmentPhp = Number(investment.initialInvestmentPhp);
        const value = Number(investment.value);
        const estimation = estimatedById.get(investment.id);
        const estimatedPhpValue = estimation?.estimatedPhpValue ?? null;

        return {
            id: investment.id,
            name: investment.name,
            symbol: estimation?.symbol ?? "UNITS",
            initialInvestmentPhp,
            value,
            estimatedPhpValue,
            gainLossPhp: estimatedPhpValue === null ? null : estimatedPhpValue - initialInvestmentPhp,
            remarks: investment.remarks,
        };
    });

    const totals = investmentRows.reduce((acc, row) => ({
        totalInitialPhp: acc.totalInitialPhp + row.initialInvestmentPhp,
        totalEstimatedPhp: acc.totalEstimatedPhp + (row.estimatedPhpValue ?? 0),
    }), {
        totalInitialPhp: 0,
        totalEstimatedPhp: 0,
    });
    const totalGainLossPhp = totals.totalEstimatedPhp - totals.totalInitialPhp;

    return (
        <section className="d-grid gap-4">
            <header className="d-grid gap-2">
                <p className="m-0 text-uppercase small" style={{ letterSpacing: "0.3em", color: "var(--color-kicker-secondary)" }}>Portfolio</p>
                <h2 className="m-0 fs-2 fw-semibold" style={{ color: "var(--color-text-strong)" }}>Investments</h2>
                <p className="m-0 small" style={{ color: "var(--color-text-muted)" }}>
                    Track each investment with units and estimated PHP value from live market bids.
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
                        <small className="text-uppercase" style={{ letterSpacing: "0.08em", color: "var(--color-text-muted)" }}>Total Est. PHP Value</small>
                        <p className="m-0 fs-5 fw-semibold">{formatPhp(totals.totalEstimatedPhp)}</p>
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
