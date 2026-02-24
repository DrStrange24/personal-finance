"use client";

import { useState } from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import ActionIconButton from "@/app/components/action-icon-button";
import { useAppToast } from "@/app/components/toast-provider";

type AddInvestmentModalProps = {
    createInvestmentAction: (formData: FormData) => Promise<{ ok: boolean; message: string }>;
};

export default function AddInvestmentModal({ createInvestmentAction }: AddInvestmentModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const { showSuccess, showError } = useAppToast();

    const submitCreateInvestment = async (formData: FormData) => {
        try {
            const result = await createInvestmentAction(formData);
            if (result.ok) {
                showSuccess("Investment Created", result.message);
            } else {
                showError("Create Failed", result.message);
            }
        } catch {
            showError("Create Failed", "Could not create investment. Please try again.");
        } finally {
            setIsOpen(false);
        }
    };

    return (
        <>
            <div className="d-flex justify-content-end">
                <ActionIconButton action="add" label="Add investment" onClick={() => setIsOpen(true)} />
            </div>

            <Modal show={isOpen} onHide={() => setIsOpen(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Add Investment</Modal.Title>
                </Modal.Header>
                <form action={submitCreateInvestment}>
                    <Modal.Body className="d-grid gap-3">
                        <div className="d-grid gap-1">
                            <label htmlFor="investment-name" className="small fw-semibold">Name</label>
                            <input id="investment-name" type="text" name="name" className="form-control" maxLength={80} required />
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="investment-initial" className="small fw-semibold">Initial Investment (PHP)</label>
                            <input id="investment-initial" type="number" name="initialInvestmentPhp" className="form-control" min="0" step="0.01" required />
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="investment-value" className="small fw-semibold">Value (Units)</label>
                            <input id="investment-value" type="number" name="value" className="form-control" min="0" step="0.000001" required />
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="investment-remarks" className="small fw-semibold">Remarks</label>
                            <textarea id="investment-remarks" name="remarks" className="form-control" rows={2} placeholder="Optional" />
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button type="button" variant="outline-secondary" onClick={() => setIsOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit">Create Investment</Button>
                    </Modal.Footer>
                </form>
            </Modal>
        </>
    );
}
