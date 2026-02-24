"use client";

import { useState } from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import ActionIconButton from "@/app/components/action-icon-button";
import { useAppToast } from "@/app/components/toast-provider";

type AccountTypeOption = {
    value: string;
    label: string;
};

type AddWalletAccountModalProps = {
    accountTypeOptions: AccountTypeOption[];
    createWalletAccountAction: (formData: FormData) => Promise<{ ok: boolean; message: string }>;
};

export default function AddWalletAccountModal({
    accountTypeOptions,
    createWalletAccountAction,
}: AddWalletAccountModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedType, setSelectedType] = useState(accountTypeOptions[0]?.value ?? "");
    const { showSuccess, showError } = useAppToast();

    const submitCreateWalletAccount = async (formData: FormData) => {
        try {
            const result = await createWalletAccountAction(formData);
            if (result.ok) {
                showSuccess("Wallet Account Created", result.message);
            } else {
                showError("Create Failed", result.message);
            }
        } catch {
            showError("Create Failed", "Could not create wallet account. Please try again.");
        } finally {
            setIsOpen(false);
        }
    };

    return (
        <>
            <div className="d-flex justify-content-end">
                <ActionIconButton
                    action="add"
                    label="Add wallet account"
                    onClick={() => setIsOpen(true)}
                />
            </div>

            <Modal show={isOpen} onHide={() => setIsOpen(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Add Wallet Account</Modal.Title>
                </Modal.Header>
                <form action={submitCreateWalletAccount}>
                    <Modal.Body className="d-grid gap-3">
                        <div className="d-grid gap-1">
                            <label htmlFor="wallet-type" className="small fw-semibold">Type</label>
                            <select
                                id="wallet-type"
                                name="type"
                                className="form-control"
                                value={selectedType}
                                onChange={(event) => setSelectedType(event.target.value)}
                            >
                                {accountTypeOptions.map((type) => (
                                    <option key={type.value} value={type.value}>{type.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="wallet-name" className="small fw-semibold">Name</label>
                            <input id="wallet-name" type="text" name="name" className="form-control" maxLength={80} required />
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="wallet-balance" className="small fw-semibold">
                                {selectedType === "ASSET" ? "Current Amount (Units)" : "Current Balance (PHP)"}
                            </label>
                            <input
                                id="wallet-balance"
                                type="number"
                                name="currentBalanceAmount"
                                className="form-control"
                                min="0"
                                step={selectedType === "ASSET" ? "0.000001" : "0.01"}
                                required
                            />
                        </div>
                        {selectedType === "CREDIT_CARD" && (
                            <>
                                <div className="d-grid gap-1">
                                    <label htmlFor="wallet-credit-limit" className="small fw-semibold">Credit Limit (for credit card)</label>
                                    <input id="wallet-credit-limit" type="number" name="creditLimitPhp" className="form-control" min="0" step="0.01" />
                                </div>
                                <div className="d-grid gap-1">
                                    <label htmlFor="wallet-statement-close" className="small fw-semibold">Statement Closing Day (1-31)</label>
                                    <input id="wallet-statement-close" type="number" name="statementClosingDay" className="form-control" min="1" max="31" />
                                </div>
                                <div className="d-grid gap-1">
                                    <label htmlFor="wallet-statement-due" className="small fw-semibold">Statement Due Day (1-31)</label>
                                    <input id="wallet-statement-due" type="number" name="statementDueDay" className="form-control" min="1" max="31" />
                                </div>
                            </>
                        )}
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

