"use client";

import { useState } from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import ActionIconButton from "@/app/components/action-icon-button";
import { useAppToast } from "@/app/components/toast-provider";

type AddIncomeStreamModalProps = {
    createIncomeStreamAction: (formData: FormData) => Promise<{ ok: boolean; message: string }>;
};

export default function AddIncomeStreamModal({ createIncomeStreamAction }: AddIncomeStreamModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const { showSuccess, showError } = useAppToast();

    const submitCreateIncomeStream = async (formData: FormData) => {
        try {
            const result = await createIncomeStreamAction(formData);
            if (result.ok) {
                showSuccess("Income Stream Created", result.message);
            } else {
                showError("Create Failed", result.message);
            }
        } catch {
            showError("Create Failed", "Could not create income stream. Please try again.");
        } finally {
            setIsOpen(false);
        }
    };

    return (
        <>
            <div className="d-flex justify-content-end">
                <ActionIconButton action="add" label="Add income stream" onClick={() => setIsOpen(true)} />
            </div>

            <Modal show={isOpen} onHide={() => setIsOpen(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Add Income Stream</Modal.Title>
                </Modal.Header>
                <form action={submitCreateIncomeStream}>
                    <Modal.Body className="d-grid gap-3">
                        <div className="d-grid gap-1">
                            <label htmlFor="income-name" className="small fw-semibold">Name</label>
                            <input id="income-name" type="text" name="name" className="form-control" maxLength={80} required />
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="income-default-amount" className="small fw-semibold">Default Amount (PHP)</label>
                            <input id="income-default-amount" type="number" name="defaultAmountPhp" className="form-control" min="0" step="0.01" required />
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="income-remarks" className="small fw-semibold">Remarks</label>
                            <textarea id="income-remarks" name="remarks" className="form-control" rows={2} placeholder="Optional" />
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button type="button" variant="outline-secondary" onClick={() => setIsOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit">Create Stream</Button>
                    </Modal.Footer>
                </form>
            </Modal>
        </>
    );
}
