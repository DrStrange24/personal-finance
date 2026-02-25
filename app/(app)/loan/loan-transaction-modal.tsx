"use client";

import { useState } from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import { useAppToast } from "@/app/components/toast-provider";
import type { FinanceActionResult } from "@/lib/finance/types";

type FormOption = {
    id: string;
    label: string;
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
    const { showError, showSuccess } = useAppToast();

    const onSubmit = async (formData: FormData) => {
        setIsSubmitting(true);
        try {
            const result = await submitAction(formData);
            if (result.ok) {
                showSuccess("Transaction Posted", result.message);
                setIsOpen(false);
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
