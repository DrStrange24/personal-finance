"use client";

import { useState } from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import ActionIconButton from "@/app/components/action-icon-button";
import { useAppToast } from "@/app/components/toast-provider";
import type { FinanceActionResult } from "@/lib/finance/types";

type FormOption = {
    id: string;
    label: string;
    defaultAmountPhp?: number | null;
};

type LoanTransactionModalProps = {
    title: string;
    triggerLabel: string;
    submitLabel: string;
    defaultKind: "LOAN_BORROW" | "LOAN_REPAY";
    submitAction: (formData: FormData) => Promise<FinanceActionResult>;
    wallets: FormOption[];
    loanRecords: FormOption[];
};

const todayIso = () => new Date().toISOString().slice(0, 10);
const getEmptyRepaymentRow = () => ({ loanRecordId: "", amountPhp: "" });

export default function LoanTransactionModal({
    title,
    triggerLabel,
    submitLabel,
    defaultKind,
    submitAction,
    wallets,
    loanRecords,
}: LoanTransactionModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [repaymentRows, setRepaymentRows] = useState([getEmptyRepaymentRow()]);
    const { showError, showSuccess } = useAppToast();

    const onSubmit = async (formData: FormData) => {
        if (defaultKind === "LOAN_REPAY") {
            const normalizedRows = repaymentRows
                .map((row) => ({
                    loanRecordId: row.loanRecordId.trim(),
                    amountPhp: Number(row.amountPhp),
                }))
                .filter((row) => row.loanRecordId.length > 0 || Number.isFinite(row.amountPhp));

            if (normalizedRows.length === 0) {
                showError("Post Failed", "Add at least one repayment item.");
                return;
            }

            const hasInvalidRow = normalizedRows.some((row) => row.loanRecordId.length === 0 || !Number.isFinite(row.amountPhp) || row.amountPhp <= 0);
            if (hasInvalidRow) {
                showError("Post Failed", "Each repayment item needs a loan record and amount greater than 0.");
                return;
            }

            const uniqueLoanCount = new Set(normalizedRows.map((row) => row.loanRecordId)).size;
            if (uniqueLoanCount !== normalizedRows.length) {
                showError("Post Failed", "Use each loan record only once per repayment post.");
                return;
            }

            formData.delete("repaymentLoanRecordId");
            formData.delete("repaymentAmountPhp");
            for (const row of normalizedRows) {
                formData.append("repaymentLoanRecordId", row.loanRecordId);
                formData.append("repaymentAmountPhp", row.amountPhp.toFixed(2));
            }
        }

        setIsSubmitting(true);
        try {
            const result = await submitAction(formData);
            if (result.ok) {
                showSuccess("Transaction Posted", result.message);
                setIsOpen(false);
                setRepaymentRows([getEmptyRepaymentRow()]);
                return;
            }

            showError("Post Failed", result.message);
        } catch {
            showError("Post Failed", "Could not post transaction.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <Button onClick={() => setIsOpen(true)}>{triggerLabel}</Button>

            <Modal show={isOpen} onHide={() => setIsOpen(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>{title}</Modal.Title>
                </Modal.Header>
                <form action={onSubmit}>
                    <Modal.Body className="d-grid gap-3">
                        <input type="hidden" name="kind" value={defaultKind} />

                        <div className="d-grid gap-1">
                            <label htmlFor={`${defaultKind}-posted-at`} className="small fw-semibold">Date</label>
                            <input
                                id={`${defaultKind}-posted-at`}
                                type="date"
                                name="postedAt"
                                className="form-control"
                                defaultValue={todayIso()}
                                required
                            />
                        </div>

                        {defaultKind === "LOAN_REPAY" ? (
                            <div className="d-grid gap-2">
                                <div className="d-flex align-items-center justify-content-between">
                                    <label className="small fw-semibold m-0">Repayment Items</label>
                                    <ActionIconButton
                                        action="add"
                                        label="Add repayment item"
                                        onClick={() => setRepaymentRows((rows) => [...rows, getEmptyRepaymentRow()])}
                                    />
                                </div>
                                {repaymentRows.map((row, index) => (
                                    <div key={`repayment-item-${index}`} className="d-grid gap-2" style={{ gridTemplateColumns: "1fr 170px auto" }}>
                                        <select
                                            className="form-control"
                                            value={row.loanRecordId}
                                            onChange={(event) => {
                                                const nextLoanRecordId = event.target.value;
                                                const selectedLoan = loanRecords.find((loan) => loan.id === nextLoanRecordId);
                                                const defaultAmount = selectedLoan?.defaultAmountPhp;
                                                const nextAmount = Number.isFinite(defaultAmount) && (defaultAmount ?? 0) > 0
                                                    ? Number(defaultAmount).toFixed(2)
                                                    : "";

                                                setRepaymentRows((rows) => rows.map((entry, entryIndex) => (
                                                    entryIndex === index
                                                        ? { ...entry, loanRecordId: nextLoanRecordId, amountPhp: nextAmount }
                                                        : entry
                                                )));
                                            }}
                                        >
                                            <option value="">Select loan record</option>
                                            {loanRecords.map((loan) => (
                                                <option key={loan.id} value={loan.id}>
                                                    {loan.label}
                                                </option>
                                            ))}
                                        </select>
                                        <input
                                            type="number"
                                            className="form-control"
                                            min="0.01"
                                            step="0.01"
                                            placeholder="Amount"
                                            value={row.amountPhp}
                                            onChange={(event) => setRepaymentRows((rows) => rows.map((entry, entryIndex) => (
                                                entryIndex === index ? { ...entry, amountPhp: event.target.value } : entry
                                            )))}
                                        />
                                        <ActionIconButton
                                            action="delete"
                                            label={`Remove repayment item ${index + 1}`}
                                            type="button"
                                            disabled={repaymentRows.length === 1}
                                            onClick={() => setRepaymentRows((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}
                                        />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="d-grid gap-1">
                                <label htmlFor={`${defaultKind}-amount`} className="small fw-semibold">Amount (PHP)</label>
                                <input
                                    id={`${defaultKind}-amount`}
                                    type="number"
                                    name="amountPhp"
                                    className="form-control"
                                    min="0.01"
                                    step="0.01"
                                    required
                                />
                            </div>
                        )}

                        <div className="d-grid gap-1">
                            <label htmlFor={`${defaultKind}-wallet`} className="small fw-semibold">Wallet</label>
                            <select id={`${defaultKind}-wallet`} name="walletAccountId" className="form-control" required>
                                <option value="">Select wallet</option>
                                {wallets.map((wallet) => (
                                    <option key={wallet.id} value={wallet.id}>
                                        {wallet.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {defaultKind === "LOAN_REPAY" ? <input type="hidden" name="loanRecordId" value="" /> : (
                            <div className="d-grid gap-1">
                                <label htmlFor={`${defaultKind}-loan`} className="small fw-semibold">Loan Record</label>
                                <select id={`${defaultKind}-loan`} name="loanRecordId" className="form-control" required>
                                    <option value="">Select loan record</option>
                                    {loanRecords.map((loan) => (
                                        <option key={loan.id} value={loan.id}>
                                            {loan.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="d-grid gap-1">
                            <label htmlFor={`${defaultKind}-remarks`} className="small fw-semibold">Remarks</label>
                            <textarea
                                id={`${defaultKind}-remarks`}
                                name="remarks"
                                className="form-control"
                                rows={2}
                                placeholder="Optional"
                            />
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button type="button" variant="outline-secondary" onClick={() => setIsOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? "Posting..." : submitLabel}
                        </Button>
                    </Modal.Footer>
                </form>
            </Modal>
        </>
    );
}
