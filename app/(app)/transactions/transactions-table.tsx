"use client";

import { useMemo, useState } from "react";
import { TransactionKind, WalletAccountType } from "@prisma/client";
import Button from "react-bootstrap/Button";
import Card from "react-bootstrap/Card";
import CardBody from "react-bootstrap/CardBody";
import Modal from "react-bootstrap/Modal";
import Table from "react-bootstrap/Table";
import ActionIconButton from "@/app/components/action-icon-button";
import ConfirmSubmitIconButton from "@/app/components/confirm-submit-icon-button";
import TransactionKindBadge from "@/app/components/finance/transaction-kind-badge";
import { useAppToast } from "@/app/components/toast-provider";
import { formatPhp } from "@/lib/finance/money";
import { transactionKindLabel } from "@/lib/finance/types";

type FormOption = {
    id: string;
    label: string;
    type?: WalletAccountType;
};

type TransactionRow = {
    id: string;
    postedAt: string;
    kind: TransactionKind;
    amountPhp: number;
    walletAccountId: string;
    walletName: string;
    targetWalletAccountId: string | null;
    targetWalletName: string | null;
    budgetEnvelopeId: string | null;
    budgetName: string | null;
    incomeStreamId: string | null;
    incomeName: string | null;
    loanRecordId: string | null;
    loanName: string | null;
    remarks: string | null;
};

type TransactionsTableProps = {
    transactions: TransactionRow[];
    wallets: FormOption[];
    budgets: FormOption[];
    incomeStreams: FormOption[];
    loanRecords: FormOption[];
    updateTransactionAction: (formData: FormData) => Promise<{ ok: boolean; message: string }>;
    deleteTransactionAction: (formData: FormData) => Promise<{ ok: boolean; message: string }>;
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
});

const negativeKinds = new Set<TransactionKind>([
    "EXPENSE",
    "BUDGET_ALLOCATION",
    "CREDIT_CARD_PAYMENT",
    "LOAN_REPAY",
]);

const allKinds: TransactionKind[] = [
    "INCOME",
    "EXPENSE",
    "BUDGET_ALLOCATION",
    "TRANSFER",
    "CREDIT_CARD_CHARGE",
    "CREDIT_CARD_PAYMENT",
    "LOAN_BORROW",
    "LOAN_REPAY",
];

const kindsRequiringBudget = new Set<TransactionKind>([
    "INCOME",
    "EXPENSE",
    "BUDGET_ALLOCATION",
    "CREDIT_CARD_CHARGE",
]);

const kindsRequiringTargetWallet = new Set<TransactionKind>([
    "TRANSFER",
    "CREDIT_CARD_PAYMENT",
]);

const kindsSupportingIncomeStream = new Set<TransactionKind>(["INCOME"]);
const kindsSupportingLoan = new Set<TransactionKind>(["LOAN_BORROW", "LOAN_REPAY"]);

export default function TransactionsTable({
    transactions,
    wallets,
    budgets,
    incomeStreams,
    loanRecords,
    updateTransactionAction,
    deleteTransactionAction,
}: TransactionsTableProps) {
    const [editState, setEditState] = useState<TransactionRow | null>(null);
    const [editKind, setEditKind] = useState<TransactionKind>("EXPENSE");
    const { showSuccess, showError } = useAppToast();

    const editRequiresBudget = kindsRequiringBudget.has(editKind);
    const editRequiresTargetWallet = kindsRequiringTargetWallet.has(editKind);
    const editSupportsIncomeStream = kindsSupportingIncomeStream.has(editKind);
    const editSupportsLoan = kindsSupportingLoan.has(editKind);
    const editWalletOptions = useMemo(() => {
        if (editKind === "CREDIT_CARD_CHARGE") {
            return wallets.filter((wallet) => wallet.type === WalletAccountType.CREDIT_CARD);
        }
        if (editKind === "CREDIT_CARD_PAYMENT") {
            return wallets.filter((wallet) => wallet.type !== WalletAccountType.CREDIT_CARD);
        }
        return wallets;
    }, [editKind, wallets]);
    const editTargetWalletOptions = useMemo(() => {
        if (editKind === "CREDIT_CARD_PAYMENT") {
            return wallets.filter((wallet) => wallet.type === WalletAccountType.CREDIT_CARD);
        }
        return wallets;
    }, [editKind, wallets]);
    const editWalletLabel = editKind === "CREDIT_CARD_PAYMENT"
        ? "Cash Wallet"
        : editKind === "CREDIT_CARD_CHARGE"
            ? "Credit Card Wallet"
            : "Wallet";
    const editTargetWalletLabel = editKind === "CREDIT_CARD_PAYMENT" ? "Credit Card Wallet" : "Target Wallet";

    const submitUpdateTransaction = async (formData: FormData) => {
        try {
            const result = await updateTransactionAction(formData);
            if (result.ok) {
                showSuccess("Transaction Updated", result.message);
            } else {
                showError("Update Failed", result.message);
            }
        } catch {
            showError("Update Failed", "Could not update transaction.");
        } finally {
            setEditState(null);
        }
    };

    const submitDeleteTransaction = async (formData: FormData) => {
        try {
            const result = await deleteTransactionAction(formData);
            if (result.ok) {
                showSuccess("Transaction Deleted", result.message);
            } else {
                showError("Delete Failed", result.message);
            }
        } catch {
            showError("Delete Failed", "Could not delete transaction.");
        }
    };

    return (
        <>
            <Card className="pf-surface-panel">
                <CardBody className="d-grid gap-3">
                    <div className="table-responsive">
                        <Table hover className="align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Kind</th>
                                    <th>Amount</th>
                                    <th>Wallet</th>
                                    <th>Target</th>
                                    <th>Budget</th>
                                    <th>Income</th>
                                    <th>Loan</th>
                                    <th>Remarks</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.length === 0 ? (
                                    <tr>
                                        <td colSpan={10} className="text-center py-4" style={{ color: "var(--color-text-muted)" }}>
                                            No transactions found.
                                        </td>
                                    </tr>
                                ) : (
                                    transactions.map((tx) => {
                                        const signed = negativeKinds.has(tx.kind)
                                            ? -Math.abs(tx.amountPhp)
                                            : Math.abs(tx.amountPhp);
                                        const amountLabel = signed < 0
                                            ? `(${formatPhp(Math.abs(signed))})`
                                            : formatPhp(signed);
                                        return (
                                            <tr key={tx.id}>
                                                <td>{dateFormatter.format(new Date(`${tx.postedAt}T00:00:00`))}</td>
                                                <td><TransactionKindBadge kind={tx.kind} /></td>
                                                <td className={signed < 0 ? "text-danger" : "text-success"}>{amountLabel}</td>
                                                <td>{tx.walletName}</td>
                                                <td>{tx.targetWalletName ?? "-"}</td>
                                                <td>{tx.budgetName ?? "-"}</td>
                                                <td>{tx.incomeName ?? "-"}</td>
                                                <td>{tx.loanName ?? "-"}</td>
                                                <td>{tx.remarks?.trim() || "-"}</td>
                                                <td>
                                                    <div className="d-flex align-items-center gap-2">
                                                        <ActionIconButton
                                                            action="edit"
                                                            label="Edit transaction"
                                                            onClick={() => {
                                                                setEditState(tx);
                                                                setEditKind(tx.kind);
                                                            }}
                                                        />
                                                        <form action={submitDeleteTransaction}>
                                                            <input type="hidden" name="id" value={tx.id} />
                                                            <ConfirmSubmitIconButton
                                                                action="delete"
                                                                label="Delete transaction"
                                                                type="submit"
                                                                confirmTitle="Delete Transaction"
                                                                confirmMessage="Delete this transaction? This will create reversal effects in linked balances."
                                                            />
                                                        </form>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </Table>
                    </div>
                </CardBody>
            </Card>

            <Modal show={editState !== null} onHide={() => setEditState(null)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Edit Transaction</Modal.Title>
                </Modal.Header>
                <form action={submitUpdateTransaction}>
                    <Modal.Body className="d-grid gap-3">
                        <input type="hidden" name="id" value={editState?.id ?? ""} />
                        <div className="d-grid gap-1">
                            <label htmlFor="edit-tx-kind" className="small fw-semibold">Kind</label>
                            <select
                                id="edit-tx-kind"
                                name="kind"
                                className="form-control"
                                value={editKind}
                                onChange={(event) => setEditKind(event.target.value as TransactionKind)}
                            >
                                {allKinds.map((value) => (
                                    <option key={value} value={value}>
                                        {transactionKindLabel[value]}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="d-grid gap-1">
                            <label htmlFor="edit-tx-posted-at" className="small fw-semibold">Date</label>
                            <input
                                id="edit-tx-posted-at"
                                type="date"
                                name="postedAt"
                                className="form-control"
                                defaultValue={editState?.postedAt ?? ""}
                                key={editState?.id ? `${editState.id}-posted-at` : "edit-posted-at-empty"}
                                required
                            />
                        </div>

                        <div className="d-grid gap-1">
                            <label htmlFor="edit-tx-amount" className="small fw-semibold">Amount (PHP)</label>
                            <input
                                id="edit-tx-amount"
                                type="number"
                                name="amountPhp"
                                className="form-control"
                                defaultValue={editState ? editState.amountPhp.toFixed(2) : ""}
                                key={editState?.id ? `${editState.id}-amount` : "edit-amount-empty"}
                                min="0.01"
                                step="0.01"
                                required
                            />
                        </div>

                        <div className="d-grid gap-1">
                            <label htmlFor="edit-tx-wallet" className="small fw-semibold">{editWalletLabel}</label>
                            <select
                                id="edit-tx-wallet"
                                name="walletAccountId"
                                className="form-control"
                                defaultValue={editState?.walletAccountId ?? ""}
                                key={editState?.id ? `${editState.id}-wallet` : "edit-wallet-empty"}
                                required
                            >
                                <option value="">Select wallet</option>
                                {editWalletOptions.map((wallet) => (
                                    <option key={wallet.id} value={wallet.id}>
                                        {wallet.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {editRequiresTargetWallet ? (
                            <div className="d-grid gap-1">
                                <label htmlFor="edit-tx-target-wallet" className="small fw-semibold">{editTargetWalletLabel}</label>
                                <select
                                    id="edit-tx-target-wallet"
                                    name="targetWalletAccountId"
                                    className="form-control"
                                    defaultValue={editState?.targetWalletAccountId ?? ""}
                                    key={editState?.id ? `${editState.id}-target-wallet` : "edit-target-wallet-empty"}
                                    required
                                >
                                    <option value="">Select target wallet</option>
                                    {editTargetWalletOptions.map((wallet) => (
                                        <option key={wallet.id} value={wallet.id}>
                                            {wallet.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ) : (
                            <input type="hidden" name="targetWalletAccountId" value="" />
                        )}

                        {editRequiresBudget ? (
                            <div className="d-grid gap-1">
                                <label htmlFor="edit-tx-budget" className="small fw-semibold">Budget Envelope</label>
                                <select
                                    id="edit-tx-budget"
                                    name="budgetEnvelopeId"
                                    className="form-control"
                                    defaultValue={editState?.budgetEnvelopeId ?? ""}
                                    key={editState?.id ? `${editState.id}-budget` : "edit-budget-empty"}
                                    required
                                >
                                    <option value="">Select budget envelope</option>
                                    {budgets.map((budget) => (
                                        <option key={budget.id} value={budget.id}>
                                            {budget.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ) : (
                            <input type="hidden" name="budgetEnvelopeId" value="" />
                        )}

                        {editSupportsIncomeStream && (
                            <div className="d-grid gap-1">
                                <label htmlFor="edit-tx-income-stream" className="small fw-semibold">Income Stream</label>
                                <select
                                    id="edit-tx-income-stream"
                                    name="incomeStreamId"
                                    className="form-control"
                                    defaultValue={editState?.incomeStreamId ?? ""}
                                    key={editState?.id ? `${editState.id}-income` : "edit-income-empty"}
                                >
                                    <option value="">Optional</option>
                                    {incomeStreams.map((stream) => (
                                        <option key={stream.id} value={stream.id}>
                                            {stream.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {editSupportsLoan && (
                            <div className="d-grid gap-1">
                                <label htmlFor="edit-tx-loan" className="small fw-semibold">Loan Record</label>
                                <select
                                    id="edit-tx-loan"
                                    name="loanRecordId"
                                    className="form-control"
                                    defaultValue={editState?.loanRecordId ?? ""}
                                    key={editState?.id ? `${editState.id}-loan` : "edit-loan-empty"}
                                >
                                    <option value="">Optional</option>
                                    {loanRecords.map((loan) => (
                                        <option key={loan.id} value={loan.id}>
                                            {loan.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="d-grid gap-1">
                            <label htmlFor="edit-tx-remarks" className="small fw-semibold">Remarks</label>
                            <textarea
                                id="edit-tx-remarks"
                                name="remarks"
                                className="form-control"
                                defaultValue={editState?.remarks ?? ""}
                                key={editState?.id ? `${editState.id}-remarks` : "edit-remarks-empty"}
                                rows={2}
                                placeholder="Optional"
                            />
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button type="button" variant="outline-secondary" onClick={() => setEditState(null)}>
                            Cancel
                        </Button>
                        <Button type="submit">Update</Button>
                    </Modal.Footer>
                </form>
            </Modal>
        </>
    );
}
