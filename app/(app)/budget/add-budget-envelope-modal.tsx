"use client";

import { useState } from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import ActionIconButton from "@/app/components/action-icon-button";
import { useAppToast } from "@/app/components/toast-provider";

type AddBudgetEnvelopeModalProps = {
    createBudgetEnvelopeAction: (formData: FormData) => Promise<{ ok: boolean; message: string }>;
};

export default function AddBudgetEnvelopeModal({
    createBudgetEnvelopeAction,
}: AddBudgetEnvelopeModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const { showSuccess, showError } = useAppToast();

    const submitCreateBudgetEnvelope = async (formData: FormData) => {
        try {
            const result = await createBudgetEnvelopeAction(formData);
            if (result.ok) {
                showSuccess("Budget Envelope Created", result.message);
            } else {
                showError("Create Failed", result.message);
            }
        } catch {
            showError("Create Failed", "Could not create budget envelope. Please try again.");
        } finally {
            setIsOpen(false);
        }
    };

    return (
        <>
            <ActionIconButton action="add" label="Add budget envelope" onClick={() => setIsOpen(true)} />

            <Modal show={isOpen} onHide={() => setIsOpen(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Add Budget Envelope</Modal.Title>
                </Modal.Header>
                <form action={submitCreateBudgetEnvelope}>
                    <Modal.Body className="d-grid gap-3">
                        <div className="d-grid gap-1">
                            <label htmlFor="budget-name" className="small fw-semibold">Name</label>
                            <input id="budget-name" type="text" name="name" className="form-control" maxLength={80} required />
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="budget-monthly-target" className="small fw-semibold">Monthly Target (PHP)</label>
                            <input id="budget-monthly-target" type="number" name="monthlyTargetPhp" className="form-control" min="0" step="0.01" required />
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="budget-max-allocation" className="small fw-semibold">Max Allocation (PHP)</label>
                            <input id="budget-max-allocation" type="number" name="maxAllocationPhp" className="form-control" min="0" step="0.01" placeholder="Optional" />
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="budget-pay-to" className="small fw-semibold">Pay To</label>
                            <input id="budget-pay-to" type="text" name="payTo" className="form-control" maxLength={80} />
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="budget-remarks" className="small fw-semibold">Remarks</label>
                            <textarea id="budget-remarks" name="remarks" className="form-control" rows={2} />
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button type="button" variant="outline-secondary" onClick={() => setIsOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit">Create Envelope</Button>
                    </Modal.Footer>
                </form>
            </Modal>
        </>
    );
}
