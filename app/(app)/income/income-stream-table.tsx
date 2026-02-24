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

type IncomeStreamRow = {
    id: string;
    name: string;
    defaultAmountPhp: number;
    isActive: boolean;
    remarks: string | null;
};

type IncomeStreamTableProps = {
    streams: IncomeStreamRow[];
    updateIncomeStreamAction: (formData: FormData) => Promise<{ ok: boolean; message: string }>;
    deleteIncomeStreamAction: (formData: FormData) => Promise<{ ok: boolean; message: string }>;
};

export default function IncomeStreamTable({
    streams,
    updateIncomeStreamAction,
    deleteIncomeStreamAction,
}: IncomeStreamTableProps) {
    const [editState, setEditState] = useState<IncomeStreamRow | null>(null);
    const { showSuccess, showError } = useAppToast();

    const submitUpdateIncomeStream = async (formData: FormData) => {
        try {
            const result = await updateIncomeStreamAction(formData);
            if (result.ok) {
                showSuccess("Income Stream Updated", result.message);
            } else {
                showError("Update Failed", result.message);
            }
        } catch {
            showError("Update Failed", "Could not update income stream. Please try again.");
        } finally {
            setEditState(null);
        }
    };

    const submitDeleteIncomeStream = async (formData: FormData) => {
        try {
            const result = await deleteIncomeStreamAction(formData);
            if (result.ok) {
                showSuccess("Income Stream Deleted", result.message);
            } else {
                showError("Delete Failed", result.message);
            }
        } catch {
            showError("Delete Failed", "Could not delete income stream. Please try again.");
        }
    };

    return (
        <>
            <Card className="pf-surface-panel">
                <CardBody className="d-grid gap-3">
                    <h3 className="m-0 fs-6 fw-semibold">Current Streams</h3>
                    <div className="table-responsive">
                        <Table hover className="align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Default Amount</th>
                                    <th>Status</th>
                                    <th>Remarks</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {streams.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="text-center py-4" style={{ color: "var(--color-text-muted)" }}>
                                            No income streams yet.
                                        </td>
                                    </tr>
                                ) : (
                                    streams.map((stream) => (
                                        <tr key={stream.id}>
                                            <td>{stream.name}</td>
                                            <td>{formatPhp(stream.defaultAmountPhp)}</td>
                                            <td>{stream.isActive ? "Active" : "Inactive"}</td>
                                            <td style={{ maxWidth: "20rem" }}>{stream.remarks?.trim() || "-"}</td>
                                            <td>
                                                <div className="d-flex align-items-center gap-2">
                                                    <ActionIconButton
                                                        action="edit"
                                                        label={`Edit income stream ${stream.name}`}
                                                        onClick={() => setEditState(stream)}
                                                    />
                                                    <form action={submitDeleteIncomeStream}>
                                                        <input type="hidden" name="id" value={stream.id} />
                                                        <ConfirmSubmitIconButton
                                                            action="delete"
                                                            label={`Delete income stream ${stream.name}`}
                                                            type="submit"
                                                            confirmTitle="Delete Income Stream"
                                                            confirmMessage={`Delete income stream \"${stream.name}\"?`}
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
                    <Modal.Title>Edit Income Stream</Modal.Title>
                </Modal.Header>
                <form action={submitUpdateIncomeStream}>
                    <Modal.Body className="d-grid gap-3">
                        <input type="hidden" name="id" value={editState?.id ?? ""} />
                        <div className="d-grid gap-1">
                            <label htmlFor="edit-income-name" className="small fw-semibold">Name</label>
                            <input
                                id="edit-income-name"
                                type="text"
                                className="form-control"
                                defaultValue={editState?.name ?? ""}
                                key={editState?.id ? `${editState.id}-name` : "edit-income-name-empty"}
                                disabled
                                readOnly
                            />
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="edit-income-default-amount" className="small fw-semibold">Default Amount (PHP)</label>
                            <input
                                id="edit-income-default-amount"
                                type="number"
                                name="defaultAmountPhp"
                                className="form-control"
                                defaultValue={editState ? editState.defaultAmountPhp.toFixed(2) : ""}
                                key={editState?.id ? `${editState.id}-default-amount` : "edit-income-default-amount-empty"}
                                min="0"
                                step="0.01"
                                required
                            />
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="edit-income-remarks" className="small fw-semibold">Remarks</label>
                            <textarea
                                id="edit-income-remarks"
                                name="remarks"
                                className="form-control"
                                defaultValue={editState?.remarks ?? ""}
                                key={editState?.id ? `${editState.id}-remarks` : "edit-income-remarks-empty"}
                                rows={2}
                                placeholder="Optional"
                            />
                        </div>
                        <label className="small d-flex align-items-center gap-2 m-0">
                            <input
                                type="checkbox"
                                name="isActive"
                                defaultChecked={editState?.isActive ?? false}
                                key={editState?.id ? `${editState.id}-active` : "edit-income-active-empty"}
                            />
                            Active
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
