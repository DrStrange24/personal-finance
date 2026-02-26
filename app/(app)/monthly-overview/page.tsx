import Card from "react-bootstrap/Card";
import CardBody from "react-bootstrap/CardBody";
import type { Decimal } from "@prisma/client/runtime/library";
import { revalidatePath } from "next/cache";
import { getDashboardSummary } from "@/lib/finance/queries";
import { getAuthenticatedEntitySession } from "@/lib/server-session";
import { prisma } from "@/lib/prisma";
import MonthlyOverviewChartModal from "./chart-modal";
import MonthlyOverviewEntryTable from "./entry-table";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
});
const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "PHP",
});

type MonthlyOverviewRow = {
    id: string;
    entryDate: Date;
    walletAmount: Decimal | string | number;
    remarks: string | null;
};

type EntryActionResult = {
    ok: boolean;
    message: string;
};

const parseEntryDate = (value: FormDataEntryValue | null) => {
    if (typeof value !== "string" || value.trim().length === 0) {
        return null;
    }

    const parsedDate = new Date(`${value}T00:00:00`);
    if (Number.isNaN(parsedDate.valueOf())) {
        return null;
    }

    return parsedDate;
};

const parseWalletAmount = (value: FormDataEntryValue | null) => {
    if (typeof value !== "string" || value.trim().length === 0) {
        return null;
    }

    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) {
        return null;
    }

    return Math.round(amount * 100) / 100;
};

const parseRemarks = (value: FormDataEntryValue | null) => {
    if (typeof value !== "string") {
        return null;
    }

    const nextRemarks = value.trim();
    return nextRemarks.length === 0 ? null : nextRemarks;
};

export default async function MonthlyOverviewPage() {
    const session = await getAuthenticatedEntitySession();

    const createEntryAction = async (formData: FormData) => {
        "use server";

        const actionSession = await getAuthenticatedEntitySession();
        const entryDate = parseEntryDate(formData.get("entryDate"));
        const walletAmount = parseWalletAmount(formData.get("walletAmount"));
        const remarks = parseRemarks(formData.get("remarks"));

        if (!entryDate || walletAmount === null) {
            return { ok: false, message: "Please provide a valid date and wallet amount." } satisfies EntryActionResult;
        }

        try {
            if (prisma.monthlyOverviewEntry) {
                await prisma.monthlyOverviewEntry.create({
                    data: {
                        userId: actionSession.userId,
                        entryDate,
                        walletAmount,
                        remarks,
                    },
                });
            } else {
                await prisma.$executeRaw`
                    INSERT INTO "MonthlyOverviewEntry" ("userId", "entryDate", "walletAmount", "remarks", "updatedAt")
                    VALUES (${actionSession.userId}, ${entryDate}, ${walletAmount}, ${remarks}, NOW())
                `;
            }
        } catch {
            return { ok: false, message: "Could not create entry. Please try again." } satisfies EntryActionResult;
        }

        revalidatePath("/monthly-overview");
        return { ok: true, message: "Entry created successfully." } satisfies EntryActionResult;
    };

    const updateEntryAction = async (formData: FormData) => {
        "use server";

        const actionSession = await getAuthenticatedEntitySession();
        const entryId = formData.get("id");
        const entryDate = parseEntryDate(formData.get("entryDate"));
        const walletAmount = parseWalletAmount(formData.get("walletAmount"));
        const remarks = parseRemarks(formData.get("remarks"));

        if (typeof entryId !== "string" || entryId.trim().length === 0 || !entryDate || walletAmount === null) {
            return { ok: false, message: "Please provide valid entry details." } satisfies EntryActionResult;
        }

        let affectedRows = 0;
        try {
            if (prisma.monthlyOverviewEntry) {
                const result = await prisma.monthlyOverviewEntry.updateMany({
                    where: {
                        id: entryId,
                        userId: actionSession.userId,
                    },
                    data: {
                        entryDate,
                        walletAmount,
                        remarks,
                    },
                });
                affectedRows = result.count;
            } else {
                const result = await prisma.$executeRaw`
                    UPDATE "MonthlyOverviewEntry"
                    SET "entryDate" = ${entryDate}, "walletAmount" = ${walletAmount}, "remarks" = ${remarks}, "updatedAt" = NOW()
                    WHERE "id" = ${entryId} AND "userId" = ${actionSession.userId}
                `;
                affectedRows = Number(result);
            }
        } catch {
            return { ok: false, message: "Could not update entry. Please try again." } satisfies EntryActionResult;
        }

        if (affectedRows < 1) {
            return { ok: false, message: "Entry not found or access denied." } satisfies EntryActionResult;
        }

        revalidatePath("/monthly-overview");
        return { ok: true, message: "Entry updated successfully." } satisfies EntryActionResult;
    };

    const deleteEntryAction = async (formData: FormData) => {
        "use server";

        const actionSession = await getAuthenticatedEntitySession();
        const entryId = formData.get("id");

        if (typeof entryId !== "string" || entryId.trim().length === 0) {
            return { ok: false, message: "Invalid entry id." } satisfies EntryActionResult;
        }

        let affectedRows = 0;
        try {
            if (prisma.monthlyOverviewEntry) {
                const result = await prisma.monthlyOverviewEntry.deleteMany({
                    where: {
                        id: entryId,
                        userId: actionSession.userId,
                    },
                });
                affectedRows = result.count;
            } else {
                const result = await prisma.$executeRaw`
                    DELETE FROM "MonthlyOverviewEntry"
                    WHERE "id" = ${entryId} AND "userId" = ${actionSession.userId}
                `;
                affectedRows = Number(result);
            }
        } catch {
            return { ok: false, message: "Could not delete entry. Please try again." } satisfies EntryActionResult;
        }

        if (affectedRows < 1) {
            return { ok: false, message: "Entry not found or access denied." } satisfies EntryActionResult;
        }

        revalidatePath("/monthly-overview");
        return { ok: true, message: "Entry deleted successfully." } satisfies EntryActionResult;
    };

    const entries: MonthlyOverviewRow[] = prisma.monthlyOverviewEntry
        ? await prisma.monthlyOverviewEntry.findMany({
            where: { userId: session.userId },
            orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
        })
        : await prisma.$queryRaw<MonthlyOverviewRow[]>`
            SELECT "id", "entryDate", "walletAmount", "remarks"
            FROM "MonthlyOverviewEntry"
            WHERE "userId" = ${session.userId}
            ORDER BY "entryDate" DESC, "createdAt" DESC
        `;
    const summaryResult = await getDashboardSummary(session.userId, session.activeEntity.id)
        .then((data) => ({ ok: true as const, data }))
        .catch((error) => ({ ok: false as const, error }));
    const summary = summaryResult.ok ? summaryResult.data : null;
    if (!summaryResult.ok) {
        console.error(JSON.stringify({
            scope: "finance-kpi",
            level: "error",
            queryType: "monthly-overview-default-kpi",
            entityId: session.activeEntity.id,
            error: summaryResult.error instanceof Error ? summaryResult.error.message : "Unknown KPI error.",
        }));
    }

    const chartEntries = [...entries].reverse();
    const chartData = chartEntries.map((entry) => ({
        id: entry.id,
        dateLabel: dateFormatter.format(entry.entryDate),
        walletValue: Number(entry.walletAmount),
    }));
    const tableEntries = entries.map((entry) => ({
        id: entry.id,
        entryDateIso: entry.entryDate.toISOString().slice(0, 10),
        entryDateLabel: dateFormatter.format(entry.entryDate),
        walletAmount: Number(entry.walletAmount),
        walletAmountLabel: currencyFormatter.format(Number(entry.walletAmount)),
        remarks: entry.remarks ?? "",
    }));

    return (
        <section className="d-grid gap-4">
            <header className="d-grid gap-2">
                <p className="m-0 text-uppercase small" style={{ letterSpacing: "0.3em", color: "var(--color-kicker-tertiary)" }}>Planning</p>
                <h2 className="m-0 fs-2 fw-semibold" style={{ color: "var(--color-text-strong)" }}>Monthly Overview</h2>
                <p className="m-0 small" style={{ color: "var(--color-text-muted)" }}>
                    Review your historical wallet totals with notes.
                </p>
            </header>

            <Card className="pf-surface-panel">
                <CardBody>
                    <div className="mb-4">
                        <h3 className="fs-6 fw-semibold mb-3" style={{ color: "var(--color-text-strong)" }}>
                            Wallet Trend
                        </h3>
                        {chartEntries.length === 0 ? (
                            <p className="m-0" style={{ color: "var(--color-text-muted)" }}>
                                Add entries to display the chart.
                            </p>
                        ) : (
                            <MonthlyOverviewChartModal points={chartData} />
                        )}
                    </div>
                    <div className="table-responsive">
                        <MonthlyOverviewEntryTable
                            entries={tableEntries}
                            defaultWalletAmount={summary?.totalAssetsPhp ?? 0}
                            createEntryAction={createEntryAction}
                            updateEntryAction={updateEntryAction}
                            deleteEntryAction={deleteEntryAction}
                        />
                    </div>
                </CardBody>
            </Card>
        </section>
    );
}
