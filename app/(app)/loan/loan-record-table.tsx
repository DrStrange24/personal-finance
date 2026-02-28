"use client";

import { useState } from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Table from "react-bootstrap/Table";
import ActionIconButton from "@/app/components/action-icon-button";
import ConfirmSubmitIconButton from "@/app/components/confirm-submit-icon-button";
import { useAmountVisibility } from "@/app/components/finance/use-amount-visibility";
import { useAppToast } from "@/app/components/toast-provider";
import { HIDDEN_AMOUNT_MASK } from "@/lib/finance/constants";
import { formatPhp } from "@/lib/finance/money";

type LoanRecordActionResult = {
    ok: boolean;
    message: string;
};

type LoanStatusValue = "ACTIVE" | "INACTIVE" | "PAID" | "WRITTEN_OFF";

type LoanRow = {
    id: string;
    itemName: string;
    counterparty: string | null;
    principalPhp: number;
    monthlyDuePhp: number | null;
    paidToDatePhp: number;
    remainingPhp: number;
    status: LoanStatusValue;
    remarks: string | null;
};

type LoanRecordTableProps = {
    title: string;
    rows: LoanRow[];
    remainingClassName: "text-danger" | "text-warning";
    updateLoanAction: (formData: FormData) => Promise<LoanRecordActionResult>;
    deleteLoanAction: (formData: FormData) => Promise<LoanRecordActionResult>;
};

export default function LoanRecordTable({
    title,
    rows,
    remainingClassName,
    updateLoanAction,
    deleteLoanAction,
}: LoanRecordTableProps) {
    const [editState, setEditState] = useState<LoanRow | null>(null);
    const [statusFilter, setStatusFilter] = useState<"NON_PAID" | "ALL" | LoanStatusValue>("NON_PAID");
    const { showError, showSuccess } = useAppToast();
    const { isHidden } = useAmountVisibility();
    const visibleRows = statusFilter === "ALL"
        ? rows
        : statusFilter === "NON_PAID"
            ? rows.filter((row) => row.status !== "PAID")
            : rows.filter((row) => row.status === statusFilter);
    const statusFilterId = `${title.toLowerCase().replace(/\s+/g, "-")}-status-filter`;

    const submitUpdateLoan = async (formData: FormData) => {
        try {
            const result = await updateLoanAction(formData);
            if (result.ok) {
                showSuccess("Loan Updated", result.message);
                setEditState(null);
                return;
            }

            showError("Update Failed", result.message);
        } catch {
            showError("Update Failed", "Could not update loan record. Please try again.");
        }
    };

    const submitDeleteLoan = async (formData: FormData) => {
        try {
            const result = await deleteLoanAction(formData);
            if (result.ok) {
                showSuccess("Loan Deleted", result.message);
            } else {
                showError("Delete Failed", result.message);
            }
        } catch {
            showError("Delete Failed", "Could not delete loan record. Please try again.");
        }
    };

    return (
        <>
            <div>
                <div className="d-flex align-items-center justify-content-between gap-2">
                    <h3 className="m-0 fs-6 fw-semibold">{title}</h3>
                    <div className="d-flex align-items-center gap-2">
                        <label htmlFor={statusFilterId} className="small fw-semibold m-0">Status</label>
                        <select
                            id={statusFilterId}
                            className="form-control form-control-sm"
                            style={{ width: "9rem" }}
                            value={statusFilter}
                            onChange={(event) => setStatusFilter(event.target.value as "NON_PAID" | "ALL" | LoanStatusValue)}
                        >
                            <option value="NON_PAID">ALL (NO PAID)</option>
                            <option value="ACTIVE">ACTIVE</option>
                            <option value="INACTIVE">INACTIVE</option>
                            <option value="ALL">ALL</option>
                            <option value="PAID">PAID</option>
                            <option value="WRITTEN_OFF">WRITTEN_OFF</option>
                        </select>
                    </div>
                </div>
                <div className="table-responsive mt-2">
                    <Table hover className="align-middle mb-0">
                        <thead>
                            <tr>
                                <th>Item</th>
                                <th>Counterparty</th>
                                <th>Principal</th>
                                <th>Monthly Due</th>
                                <th>Paid</th>
                                <th>Remaining</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleRows.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="text-center py-4" style={{ color: "var(--color-text-muted)" }}>
                                        No records.
                                    </td>
                                </tr>
                            ) : (
                                visibleRows.map((loan) => (
                                    <tr key={loan.id}>
                                        <td>{loan.itemName}</td>
                                        <td>{loan.counterparty?.trim() || "-"}</td>
                                        <td>{isHidden ? HIDDEN_AMOUNT_MASK : formatPhp(loan.principalPhp)}</td>
                                        <td>{loan.monthlyDuePhp === null ? "-" : isHidden ? HIDDEN_AMOUNT_MASK : formatPhp(loan.monthlyDuePhp)}</td>
                                        <td>{isHidden ? HIDDEN_AMOUNT_MASK : formatPhp(loan.paidToDatePhp)}</td>
                                        <td className={loan.remainingPhp > 0 ? remainingClassName : "text-success"}>
                                            {isHidden ? HIDDEN_AMOUNT_MASK : formatPhp(loan.remainingPhp)}
                                        </td>
                                        <td>{loan.status}</td>
                                        <td>
                                            <div className="d-flex align-items-center gap-2">
                                                <ActionIconButton
                                                    action="edit"
                                                    label={`Edit loan record ${loan.itemName}`}
                                                    onClick={() => setEditState(loan)}
                                                />
                                                <form action={submitDeleteLoan}>
                                                    <input type="hidden" name="id" value={loan.id} />
                                                    <ConfirmSubmitIconButton
                                                        action="delete"
                                                        label={`Delete loan record ${loan.itemName}`}
                                                        type="submit"
                                                        confirmTitle="Delete Loan Record"
                                                        confirmMessage={`Delete loan record "${loan.itemName}"?`}
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
            </div>

            <Modal show={editState !== null} onHide={() => setEditState(null)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Edit Loan Record</Modal.Title>
                </Modal.Header>
                <form action={submitUpdateLoan}>
                    <Modal.Body className="d-grid gap-3">
                        <input type="hidden" name="id" value={editState?.id ?? ""} />
                        <div className="d-grid gap-1">
                            <label htmlFor="edit-loan-status" className="small fw-semibold">Status</label>
                            <select
                                id="edit-loan-status"
                                name="status"
                                className="form-control"
                                defaultValue={editState?.status ?? "ACTIVE"}
                                key={editState?.id ? `${editState.id}-status` : "edit-loan-status-empty"}
                            >
                                <option value="ACTIVE">ACTIVE</option>
                                <option value="INACTIVE">INACTIVE</option>
                                <option value="PAID">PAID</option>
                                <option value="WRITTEN_OFF">WRITTEN_OFF</option>
                            </select>
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="edit-loan-remarks" className="small fw-semibold">Remarks</label>
                            <textarea
                                id="edit-loan-remarks"
                                name="remarks"
                                className="form-control"
                                rows={3}
                                defaultValue={editState?.remarks ?? ""}
                                key={editState?.id ? `${editState.id}-remarks` : "edit-loan-remarks-empty"}
                            />
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button type="button" variant="outline-secondary" onClick={() => setEditState(null)}>
                            Cancel
                        </Button>
                        <Button type="submit">Save</Button>
                    </Modal.Footer>
                </form>
            </Modal>
        </>
    );
}
