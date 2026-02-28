"use client";

import { TransactionKind } from "@prisma/client";
import Table from "react-bootstrap/Table";
import TransactionKindBadge from "@/app/components/finance/transaction-kind-badge";
import { useAmountVisibility } from "@/app/components/finance/use-amount-visibility";

type RecentTransactionRow = {
    id: string;
    postedAtLabel: string;
    kind: TransactionKind;
    amountLabel: string;
    amountClassName: "text-danger" | "text-success";
    entityName: string;
    walletName: string;
    budgetName: string;
    remarks: string;
};

type RecentTransactionsTableProps = {
    rows: RecentTransactionRow[];
    storageKey: string;
};

export default function RecentTransactionsTable({ rows, storageKey }: RecentTransactionsTableProps) {
    const { isHidden } = useAmountVisibility(storageKey);

    return (
        <div className="table-responsive">
            <Table hover className="align-middle mb-0">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Kind</th>
                        <th>Amount</th>
                        <th>Entity</th>
                        <th>Wallet</th>
                        <th>Budget</th>
                        <th>Remarks</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.length === 0 ? (
                        <tr>
                            <td colSpan={7} className="text-center py-4" style={{ color: "var(--color-text-muted)" }}>
                                No transactions yet.
                            </td>
                        </tr>
                    ) : (
                        rows.map((row) => (
                            <tr key={row.id}>
                                <td>{row.postedAtLabel}</td>
                                <td><TransactionKindBadge kind={row.kind} /></td>
                                <td className={row.amountClassName}>{isHidden ? "****" : row.amountLabel}</td>
                                <td>{row.entityName}</td>
                                <td>{row.walletName}</td>
                                <td>{row.budgetName}</td>
                                <td>{row.remarks}</td>
                            </tr>
                        ))
                    )}
                </tbody>
            </Table>
        </div>
    );
}
