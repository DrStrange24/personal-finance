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

type BudgetEnvelopeRow = {
    id: string;
    name: string;
    monthlyTargetPhp: number;
    availablePhp: number;
    spentPhp: number;
    remainingPhp: number;
    payTo: string | null;
    remarks: string | null;
    rolloverEnabled: boolean;
};

type BudgetEnvelopeTableProps = {
    budgets: BudgetEnvelopeRow[];
    updateBudgetEnvelopeAction: (formData: FormData) => Promise<{ ok: boolean; message: string }>;
    deleteBudgetEnvelopeAction: (formData: FormData) => Promise<{ ok: boolean; message: string }>;
};

export default function BudgetEnvelopeTable({
    budgets,
    updateBudgetEnvelopeAction,
    deleteBudgetEnvelopeAction,
}: BudgetEnvelopeTableProps) {
    const [editState, setEditState] = useState<BudgetEnvelopeRow | null>(null);
    const { showSuccess, showError } = useAppToast();

    const submitUpdateBudgetEnvelope = async (formData: FormData) => {
        try {
            const result = await updateBudgetEnvelopeAction(formData);
            if (result.ok) {
                showSuccess("Budget Envelope Updated", result.message);
            } else {
                showError("Update Failed", result.message);
            }
        } catch {
            showError("Update Failed", "Could not update budget envelope. Please try again.");
        } finally {
            setEditState(null);
        }
    };

    const submitDeleteBudgetEnvelope = async (formData: FormData) => {
        try {
            const result = await deleteBudgetEnvelopeAction(formData);
            if (result.ok) {
                showSuccess("Budget Envelope Deleted", result.message);
            } else {
                showError("Delete Failed", result.message);
            }
        } catch {
            showError("Delete Failed", "Could not delete budget envelope. Please try again.");
        }
    };

    return (
        <>
            <Card className="pf-surface-panel">
                <CardBody className="d-grid gap-3">
                    <h3 className="m-0 fs-6 fw-semibold">Envelopes</h3>
                    <div className="table-responsive">
                        <Table hover className="align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Target</th>
                                    <th>Available</th>
                                    <th>Spent (MTD)</th>
                                    <th>Remaining</th>
                                    <th>Rollover</th>
                                    <th>Pay To</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {budgets.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="text-center py-4" style={{ color: "var(--color-text-muted)" }}>
                                            No budget envelopes yet.
                                        </td>
                                    </tr>
                                ) : (
                                    budgets.map((budget) => (
                                        <tr key={budget.id}>
                                            <td>{budget.name}</td>
                                            <td>{formatPhp(budget.monthlyTargetPhp)}</td>
                                            <td>{formatPhp(budget.availablePhp)}</td>
                                            <td>{formatPhp(budget.spentPhp)}</td>
                                            <td className={budget.remainingPhp < 0 ? "text-danger" : "text-success"}>
                                                {formatPhp(budget.remainingPhp)}
                                            </td>
                                            <td>{budget.rolloverEnabled ? "On" : "Off"}</td>
                                            <td>{budget.payTo?.trim() || "-"}</td>
                                            <td>
                                                <div className="d-flex align-items-center gap-2">
                                                    <ActionIconButton
                                                        action="edit"
                                                        label={`Edit budget envelope ${budget.name}`}
                                                        onClick={() => setEditState(budget)}
                                                    />
                                                    <form action={submitDeleteBudgetEnvelope}>
                                                        <input type="hidden" name="id" value={budget.id} />
                                                        <ConfirmSubmitIconButton
                                                            action="delete"
                                                            label={`Delete budget envelope ${budget.name}`}
                                                            type="submit"
                                                            confirmTitle="Delete Budget Envelope"
                                                            confirmMessage={`Delete budget envelope \"${budget.name}\"?`}
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
                    <Modal.Title>Edit Budget Envelope</Modal.Title>
                </Modal.Header>
                <form action={submitUpdateBudgetEnvelope}>
                    <Modal.Body className="d-grid gap-3">
                        <input type="hidden" name="id" value={editState?.id ?? ""} />
                        <div className="d-grid gap-1">
                            <label htmlFor="edit-budget-name" className="small fw-semibold">Name</label>
                            <input
                                id="edit-budget-name"
                                type="text"
                                className="form-control"
                                defaultValue={editState?.name ?? ""}
                                key={editState?.id ? `${editState.id}-name` : "edit-budget-name-empty"}
                                disabled
                                readOnly
                            />
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="edit-budget-monthly-target" className="small fw-semibold">Monthly Target (PHP)</label>
                            <input
                                id="edit-budget-monthly-target"
                                type="number"
                                name="monthlyTargetPhp"
                                defaultValue={editState ? editState.monthlyTargetPhp.toFixed(2) : ""}
                                key={editState?.id ? `${editState.id}-monthly-target` : "edit-budget-monthly-target-empty"}
                                className="form-control"
                                min="0"
                                step="0.01"
                                required
                            />
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="edit-budget-pay-to" className="small fw-semibold">Pay To</label>
                            <input
                                id="edit-budget-pay-to"
                                type="text"
                                name="payTo"
                                defaultValue={editState?.payTo ?? ""}
                                key={editState?.id ? `${editState.id}-pay-to` : "edit-budget-pay-to-empty"}
                                className="form-control"
                                maxLength={80}
                            />
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="edit-budget-remarks" className="small fw-semibold">Remarks</label>
                            <textarea
                                id="edit-budget-remarks"
                                name="remarks"
                                defaultValue={editState?.remarks ?? ""}
                                key={editState?.id ? `${editState.id}-remarks` : "edit-budget-remarks-empty"}
                                className="form-control"
                                rows={2}
                            />
                        </div>
                        <label className="small d-flex align-items-center gap-2 m-0">
                            <input
                                type="checkbox"
                                name="rolloverEnabled"
                                defaultChecked={editState?.rolloverEnabled ?? false}
                                key={editState?.id ? `${editState.id}-rollover` : "edit-budget-rollover-empty"}
                            />
                            Rollover
                        </label>
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
