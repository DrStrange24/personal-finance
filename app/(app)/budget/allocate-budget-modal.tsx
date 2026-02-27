"use client";

import { useState } from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import ActionIconButton from "@/app/components/action-icon-button";
import { useAppToast } from "@/app/components/toast-provider";

type FormOption = {
    id: string;
    label: string;
};

type AllocateBudgetModalProps = {
    budgets: FormOption[];
    postBudgetAllocationAction: (formData: FormData) => Promise<{ ok: boolean; message: string }>;
};

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function AllocateBudgetModal({
    budgets,
    postBudgetAllocationAction,
}: AllocateBudgetModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const { showSuccess, showError } = useAppToast();

    const submitBudgetAllocation = async (formData: FormData) => {
        try {
            const result = await postBudgetAllocationAction(formData);
            if (result.ok) {
                showSuccess("Budget Allocated", result.message);
            } else {
                showError("Allocate Failed", result.message);
            }
        } catch {
            showError("Allocate Failed", "Could not allocate budget. Please try again.");
        } finally {
            setIsOpen(false);
        }
    };

    return (
        <>
            <ActionIconButton action="add" label="Allocate budget" title="Allocate Budget" onClick={() => setIsOpen(true)} />

            <Modal show={isOpen} onHide={() => setIsOpen(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Allocate Budget</Modal.Title>
                </Modal.Header>
                <form action={submitBudgetAllocation}>
                    <Modal.Body className="d-grid gap-3">
                        <div className="d-grid gap-1">
                            <label htmlFor="allocate-date" className="small fw-semibold">Date</label>
                            <input id="allocate-date" type="date" name="postedAt" className="form-control" defaultValue={todayIso()} required />
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="allocate-amount" className="small fw-semibold">Amount (PHP)</label>
                            <input id="allocate-amount" type="number" name="amountPhp" className="form-control" min="0.01" step="0.01" required />
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="allocate-budget" className="small fw-semibold">Budget Envelope</label>
                            <select id="allocate-budget" name="budgetEnvelopeId" className="form-control" required>
                                <option value="">Select budget envelope</option>
                                {budgets.map((budget) => (
                                    <option key={budget.id} value={budget.id}>{budget.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="allocate-remarks" className="small fw-semibold">Remarks</label>
                            <textarea id="allocate-remarks" name="remarks" className="form-control" rows={2} placeholder="Optional" />
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button type="button" variant="outline-secondary" onClick={() => setIsOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit">Allocate</Button>
                    </Modal.Footer>
                </form>
            </Modal>
        </>
    );
}
