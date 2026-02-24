"use client";

import { useState } from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import ActionIconButton from "@/app/components/action-icon-button";
import { useAppToast } from "@/app/components/toast-provider";

type AddCreditAccountModalProps = {
    createCreditAccountAction: (formData: FormData) => Promise<{ ok: boolean; message: string }>;
};

export default function AddCreditAccountModal({ createCreditAccountAction }: AddCreditAccountModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const { showSuccess, showError } = useAppToast();

    const submitCreateCreditAccount = async (formData: FormData) => {
        try {
            const result = await createCreditAccountAction(formData);
            if (result.ok) {
                showSuccess("Credit Account Created", result.message);
            } else {
                showError("Create Failed", result.message);
            }
        } catch {
            showError("Create Failed", "Could not create credit account. Please try again.");
        } finally {
            setIsOpen(false);
        }
    };

    return (
        <>
            <div className="d-flex justify-content-end">
                <ActionIconButton
                    action="add"
                    label="Add credit account"
                    onClick={() => setIsOpen(true)}
                />
            </div>

            <Modal show={isOpen} onHide={() => setIsOpen(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Add Credit Account</Modal.Title>
                </Modal.Header>
                <form action={submitCreateCreditAccount}>
                    <Modal.Body className="d-grid gap-3">
                        <div className="d-grid gap-1">
                            <label htmlFor="credit-name" className="small fw-semibold">Name</label>
                            <input id="credit-name" type="text" name="name" className="form-control" maxLength={80} required />
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="credit-limit" className="small fw-semibold">Credit Limit (PHP)</label>
                            <input
                                id="credit-limit"
                                type="number"
                                name="creditLimitAmount"
                                className="form-control"
                                min="0"
                                step="0.01"
                                required
                            />
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="credit-balance" className="small fw-semibold">Used (PHP)</label>
                            <input
                                id="credit-balance"
                                type="number"
                                name="currentBalanceAmount"
                                className="form-control"
                                min="0"
                                step="0.01"
                                required
                            />
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button type="button" variant="outline-secondary" onClick={() => setIsOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit">Create Account</Button>
                    </Modal.Footer>
                </form>
            </Modal>
        </>
    );
}
