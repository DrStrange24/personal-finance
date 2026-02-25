"use client";

import { useState } from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import { useAppToast } from "@/app/components/toast-provider";

type LoanRecordActionResult = {
    ok: boolean;
    message: string;
};

type AddLoanRecordModalProps = {
    createLoanAction: (formData: FormData) => Promise<LoanRecordActionResult>;
};

export default function AddLoanRecordModal({ createLoanAction }: AddLoanRecordModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [principalPhp, setPrincipalPhp] = useState("");
    const [monthsToPay, setMonthsToPay] = useState("");
    const { showError, showSuccess } = useAppToast();
    const principalValue = Number(principalPhp);
    const monthsValue = Number(monthsToPay);
    const monthlyDueValue = Number.isFinite(principalValue)
        && principalValue > 0
        && Number.isFinite(monthsValue)
        && monthsValue > 0
        ? (principalValue / monthsValue).toFixed(2)
        : "";

    const onSubmit = async (formData: FormData) => {
        setIsSubmitting(true);
        try {
            const result = await createLoanAction(formData);
            if (result.ok) {
                showSuccess("Loan Record Created", result.message);
                setIsOpen(false);
                setPrincipalPhp("");
                setMonthsToPay("");
                return;
            }

            showError("Create Failed", result.message);
        } catch {
            showError("Create Failed", "Could not create loan record.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <Button
                onClick={() => {
                    setPrincipalPhp("");
                    setMonthsToPay("");
                    setIsOpen(true);
                }}
            >
                Add Loan Record
            </Button>

            <Modal show={isOpen} onHide={() => setIsOpen(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Add Loan Record</Modal.Title>
                </Modal.Header>
                <form action={onSubmit}>
                    <Modal.Body className="d-grid gap-3">
                        <div className="d-grid gap-1">
                            <label htmlFor="loan-direction" className="small fw-semibold">Direction</label>
                            <select id="loan-direction" name="direction" className="form-control" defaultValue="YOU_OWE">
                                <option value="YOU_OWE">You Owe</option>
                                <option value="YOU_ARE_OWED">You Are Owed</option>
                            </select>
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="loan-item-name" className="small fw-semibold">Item / Loan Name</label>
                            <input id="loan-item-name" type="text" name="itemName" className="form-control" maxLength={120} required />
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="loan-counterparty" className="small fw-semibold">Counterparty</label>
                            <input id="loan-counterparty" type="text" name="counterparty" className="form-control" maxLength={120} />
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="loan-principal" className="small fw-semibold">Principal (PHP)</label>
                            <input
                                id="loan-principal"
                                type="number"
                                name="principalPhp"
                                className="form-control"
                                min="0"
                                step="0.01"
                                value={principalPhp}
                                onChange={(event) => setPrincipalPhp(event.target.value)}
                                required
                            />
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="loan-months-to-pay" className="small fw-semibold">Months to Pay (UI only)</label>
                            <input
                                id="loan-months-to-pay"
                                type="number"
                                className="form-control"
                                min="1"
                                step="1"
                                value={monthsToPay}
                                onChange={(event) => setMonthsToPay(event.target.value)}
                                placeholder="e.g. 12"
                            />
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="loan-monthly" className="small fw-semibold">Monthly Due (PHP)</label>
                            <input
                                id="loan-monthly"
                                type="number"
                                name="monthlyDuePhp"
                                className="form-control"
                                min="0"
                                step="0.01"
                                value={monthlyDueValue}
                                readOnly
                            />
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="loan-paid" className="small fw-semibold">Paid To Date (PHP)</label>
                            <input
                                id="loan-paid"
                                type="number"
                                name="paidToDatePhp"
                                className="form-control"
                                min="0"
                                step="0.01"
                            />
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="loan-remarks" className="small fw-semibold">Remarks</label>
                            <textarea id="loan-remarks" name="remarks" className="form-control" rows={2} />
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button type="button" variant="outline-secondary" onClick={() => setIsOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? "Creating..." : "Create Loan"}
                        </Button>
                    </Modal.Footer>
                </form>
            </Modal>
        </>
    );
}
