import { revalidatePath } from "next/cache";
import { TransactionKind } from "@prisma/client";
import MetricCard from "@/app/components/finance/metric-card";
import AddIncomeStreamModal from "./add-income-stream-modal";
import IncomeStreamTable from "./income-stream-table";
import { ensureFinanceBootstrap } from "@/lib/finance/bootstrap";
import { formatPhp, parseMoneyInput, parseOptionalText } from "@/lib/finance/money";
import { getAuthenticatedEntitySession } from "@/lib/server-session";
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

type IncomeStreamActionResult = {
    ok: boolean;
    message: string;
};

export default async function IncomePage() {
    const session = await getAuthenticatedEntitySession();
    const activeEntityId = session.activeEntity.id;
    await ensureFinanceBootstrap(session.userId, activeEntityId);

    const createIncomeStreamAction = async (formData: FormData): Promise<IncomeStreamActionResult> => {
        "use server";
        const actionSession = await getAuthenticatedEntitySession();

        const name = parseRequiredName(formData.get("name"));
        const defaultAmountResult = parseMoneyInput(formData.get("defaultAmountPhp"), true);
        const remarksResult = parseOptionalText(formData.get("remarks"), 300);

        if (!name || !defaultAmountResult.ok || defaultAmountResult.value === null || !remarksResult.ok) {
            return { ok: false, message: "Please provide valid income stream details." };
        }

        try {
            await prisma.incomeStream.create({
                data: {
                    userId: actionSession.userId,
                    entityId: actionSession.activeEntity.id,
                    name,
                    defaultAmountPhp: defaultAmountResult.value,
                    remarks: remarksResult.value,
                },
            });

            revalidatePath("/income");
            revalidatePath("/dashboard");
            return { ok: true, message: "Income stream created successfully." };
        } catch {
            return { ok: false, message: "Could not create income stream. Please try again." };
        }
    };

    const updateIncomeStreamAction = async (formData: FormData): Promise<IncomeStreamActionResult> => {
        "use server";
        const actionSession = await getAuthenticatedEntitySession();

        const id = typeof formData.get("id") === "string" ? String(formData.get("id")).trim() : "";
        const defaultAmountResult = parseMoneyInput(formData.get("defaultAmountPhp"), true);
        const remarksResult = parseOptionalText(formData.get("remarks"), 300);
        const isActive = formData.get("isActive") === "on";

        if (!id || !defaultAmountResult.ok || defaultAmountResult.value === null || !remarksResult.ok) {
            return { ok: false, message: "Please provide valid income stream details." };
        }

        try {
            const updated = await prisma.incomeStream.updateMany({
                where: {
                    id,
                    userId: actionSession.userId,
                    entityId: actionSession.activeEntity.id,
                },
                data: {
                    defaultAmountPhp: defaultAmountResult.value,
                    remarks: remarksResult.value,
                    isActive,
                },
            });

            if (updated.count === 0) {
                return { ok: false, message: "Income stream not found." };
            }
        } catch (error) {
            return {
                ok: false,
                message: error instanceof Error ? error.message : "Could not update income stream.",
            };
        }

        revalidatePath("/income");
        revalidatePath("/dashboard");
        return { ok: true, message: "Income stream updated successfully." };
    };

    const deleteIncomeStreamAction = async (formData: FormData): Promise<IncomeStreamActionResult> => {
        "use server";
        const actionSession = await getAuthenticatedEntitySession();

        const id = typeof formData.get("id") === "string" ? String(formData.get("id")).trim() : "";
        if (!id) {
            return { ok: false, message: "Missing income stream id." };
        }

        try {
            const deleted = await prisma.incomeStream.deleteMany({
                where: {
                    id,
                    userId: actionSession.userId,
                    entityId: actionSession.activeEntity.id,
                },
            });

            if (deleted.count === 0) {
                return { ok: false, message: "Income stream not found." };
            }

            revalidatePath("/income");
            revalidatePath("/dashboard");
            revalidatePath("/transactions");
            return { ok: true, message: "Income stream deleted successfully." };
        } catch {
            return { ok: false, message: "Could not delete income stream. Please try again." };
        }
    };

    const streams = await prisma.incomeStream.findMany({
        where: {
            userId: session.userId,
            entityId: activeEntityId,
        },
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });

    const streamRows = streams.map((stream) => ({
        id: stream.id,
        name: stream.name,
        defaultAmountPhp: Number(stream.defaultAmountPhp),
        isActive: stream.isActive,
        remarks: stream.remarks,
    }));

    const sciTechWhere = {
        userId: session.userId,
        entityId: activeEntityId,
        kind: TransactionKind.INCOME,
        incomeStream: {
            is: {
                name: {
                    equals: "SciTech",
                    mode: "insensitive" as const,
                },
            },
        },
    };
    const [sciTechIncomeAggregate, sciTechLatestTransactions] = await Promise.all([
        prisma.financeTransaction.aggregate({
            where: sciTechWhere,
            _sum: {
                amountPhp: true,
            },
        }),
        prisma.financeTransaction.findMany({
            where: sciTechWhere,
            select: {
                amountPhp: true,
            },
            orderBy: [{ postedAt: "desc" }, { createdAt: "desc" }],
            take: 10,
        }),
    ]);
    const sciTechTotalIncomePhp = Number(sciTechIncomeAggregate._sum.amountPhp ?? 0);
    const sciTechLatestTotalPhp = sciTechLatestTransactions.reduce((sum, tx) => sum + Number(tx.amountPhp), 0);
    const sciTechAverageIncomePhp = sciTechLatestTransactions.length > 0 ? sciTechLatestTotalPhp / sciTechLatestTransactions.length : 0;

    return (
        <section className="d-grid gap-4">
            <header className="d-grid gap-2">
                <p className="m-0 text-uppercase small" style={{ letterSpacing: "0.3em", color: "var(--color-kicker-secondary)" }}>Income</p>
                <h2 className="m-0 fs-2 fw-semibold" style={{ color: "var(--color-text-strong)" }}>Income Streams</h2>
                <p className="m-0 small" style={{ color: "var(--color-text-muted)" }}>
                    Manage recurring income streams.
                </p>
            </header>

            <AddIncomeStreamModal createIncomeStreamAction={createIncomeStreamAction} />

            <div className="d-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
                <MetricCard
                    label="SciTech Income"
                    value={formatPhp(sciTechTotalIncomePhp)}
                    helper={`Average (latest 10): ${formatPhp(sciTechAverageIncomePhp)}`}
                />
            </div>

            <IncomeStreamTable
                streams={streamRows}
                updateIncomeStreamAction={updateIncomeStreamAction}
                deleteIncomeStreamAction={deleteIncomeStreamAction}
            />
        </section>
    );
}
