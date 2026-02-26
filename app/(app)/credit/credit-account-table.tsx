"use client";

import { useState } from "react";
import Button from "react-bootstrap/Button";
import Card from "react-bootstrap/Card";
import CardBody from "react-bootstrap/CardBody";
import Modal from "react-bootstrap/Modal";
import Table from "react-bootstrap/Table";
import ActionIconButton from "@/app/components/action-icon-button";
import ConfirmSubmitIconButton from "@/app/components/confirm-submit-icon-button";
import { useAppToast } from "@/app/components/toast-provider";
import { formatPhp } from "@/lib/finance/money";

type CreditAccountRow = {
    id: string;
    name: string;
    creditLimitAmount: number;
    currentBalanceAmount: number;
    paymentReservePhp: number;
    createdAtLabel: string;
};

type CreditAccountTableProps = {
    accounts: CreditAccountRow[];
    updateCreditAccountAction: (formData: FormData) => Promise<{ ok: boolean; message: string }>;
    archiveCreditAccountAction: (formData: FormData) => Promise<{ ok: boolean; message: string }>;
};

export default function CreditAccountTable({
    accounts,
    updateCreditAccountAction,
    archiveCreditAccountAction,
}: CreditAccountTableProps) {
    const [editState, setEditState] = useState<CreditAccountRow | null>(null);
    const { showSuccess, showError } = useAppToast();

    const submitUpdateCreditAccount = async (formData: FormData) => {
        try {
            const result = await updateCreditAccountAction(formData);
            if (result.ok) {
                showSuccess("Credit Account Updated", result.message);
            } else {
                showError("Update Failed", result.message);
            }
        } catch {
            showError("Update Failed", "Could not update credit account. Please try again.");
        } finally {
            setEditState(null);
        }
    };

    const submitArchiveCreditAccount = async (formData: FormData) => {
        try {
            const result = await archiveCreditAccountAction(formData);
            if (result.ok) {
                showSuccess("Credit Account Archived", result.message);
            } else {
                showError("Archive Failed", result.message);
            }
        } catch {
            showError("Archive Failed", "Could not archive credit account. Please try again.");
        }
    };

    return (
        <>
            <Card className="pf-surface-panel">
                <CardBody className="d-grid gap-3">
                    <h3 className="m-0 fs-6 fw-semibold">Credit Accounts</h3>
                    <div className="table-responsive">
                        <Table hover className="align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Credit Limit</th>
                                    <th>Used</th>
                                    <th>Remaining</th>
                                    <th>Reserved</th>
                                    <th>Created</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {accounts.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="text-center py-4" style={{ color: "var(--color-text-muted)" }}>
                                            No credit accounts yet.
                                        </td>
                                    </tr>
                                ) : (
                                    accounts.map((account) => (
                                        <tr key={account.id}>
                                            <td>{account.name}</td>
                                            <td>{formatPhp(account.creditLimitAmount)}</td>
                                            <td className="text-danger">{formatPhp(account.currentBalanceAmount)}</td>
                                            <td className={account.creditLimitAmount - account.currentBalanceAmount >= 0 ? "text-success" : "text-danger"}>
                                                {formatPhp(account.creditLimitAmount - account.currentBalanceAmount)}
                                            </td>
                                            <td>{formatPhp(account.paymentReservePhp)}</td>
                                            <td>{account.createdAtLabel}</td>
                                            <td>
                                                <div className="d-flex align-items-center gap-2">
                                                    <ActionIconButton
                                                        action="edit"
                                                        label={`Edit credit account ${account.name}`}
                                                        onClick={() => setEditState(account)}
                                                    />
                                                    <form action={submitArchiveCreditAccount}>
                                                        <input type="hidden" name="id" value={account.id} />
                                                        <ConfirmSubmitIconButton
                                                            action="delete"
                                                            label={`Archive credit account ${account.name}`}
                                                            type="submit"
                                                            confirmTitle="Archive Credit Account"
                                                            confirmMessage={`Archive credit account \"${account.name}\"?`}
                                                        />
                                                    </form>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </Table>
                    </div>
                </CardBody>
            </Card>

            <Modal show={editState !== null} onHide={() => setEditState(null)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Edit Credit Account</Modal.Title>
                </Modal.Header>
                <form action={submitUpdateCreditAccount}>
                    <Modal.Body className="d-grid gap-3">
                        <input type="hidden" name="id" value={editState?.id ?? ""} />
                        <div className="d-grid gap-1">
                            <label htmlFor="edit-credit-name" className="small fw-semibold">Name</label>
                            <input
                                id="edit-credit-name"
                                type="text"
                                name="name"
                                className="form-control"
                                maxLength={80}
                                defaultValue={editState?.name ?? ""}
                                key={editState?.id ? `${editState.id}-name` : "edit-credit-name-empty"}
                                required
                            />
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="edit-credit-limit" className="small fw-semibold">Credit Limit (PHP)</label>
                            <input
                                id="edit-credit-limit"
                                type="number"
                                name="creditLimitAmount"
                                className="form-control"
                                defaultValue={editState ? editState.creditLimitAmount.toFixed(2) : ""}
                                key={editState?.id ? `${editState.id}-limit` : "edit-credit-limit-empty"}
                                min="0"
                                step="0.01"
                                required
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
