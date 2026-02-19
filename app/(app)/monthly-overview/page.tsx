import Card from "react-bootstrap/Card";
import CardBody from "react-bootstrap/CardBody";
import Table from "react-bootstrap/Table";
import type { Decimal } from "@prisma/client/runtime/library";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const dateFormatter = new Intl.DateTimeFormat("en-US");
const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
});

type MonthlyOverviewRow = {
    id: string;
    entryDate: Date;
    walletAmount: Decimal | string | number;
    remarks: string | null;
};

export default async function MonthlyOverviewPage() {
    const cookieStore = await cookies();
    const token = cookieStore.get("pf_session")?.value;
    const session = token ? verifySessionToken(token) : null;

    if (!session) {
        redirect("/login");
    }

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
                    <div className="table-responsive">
                        <Table hover className="align-middle mb-0">
                            <thead>
                                <tr>
                                    <th scope="col">Date</th>
                                    <th scope="col">Wallet</th>
                                    <th scope="col">Remarks</th>
                                </tr>
                            </thead>
                            <tbody>
                                {entries.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="text-center py-4" style={{ color: "var(--color-text-muted)" }}>
                                            No monthly overview entries yet.
                                        </td>
                                    </tr>
                                ) : (
                                    entries.map((entry) => (
                                        <tr key={entry.id}>
                                            <td>{dateFormatter.format(entry.entryDate)}</td>
                                            <td>{currencyFormatter.format(Number(entry.walletAmount))}</td>
                                            <td>{entry.remarks?.trim() || "-"}</td>
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
