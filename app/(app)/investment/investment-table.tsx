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

type InvestmentRow = {
    id: string;
    name: string;
    symbol: string;
    initialInvestmentPhp: number;
    value: number;
    estimatedPhpValue: number | null;
    gainLossPhp: number | null;
    remarks: string | null;
};

type InvestmentTableProps = {
    investments: InvestmentRow[];
    updateInvestmentAction: (formData: FormData) => Promise<{ ok: boolean; message: string }>;
    deleteInvestmentAction: (formData: FormData) => Promise<{ ok: boolean; message: string }>;
};

const unitFormatter = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
});

export default function InvestmentTable({
    investments,
    updateInvestmentAction,
    deleteInvestmentAction,
}: InvestmentTableProps) {
    const [editState, setEditState] = useState<InvestmentRow | null>(null);
    const { showSuccess, showError } = useAppToast();

    const submitUpdateInvestment = async (formData: FormData) => {
        try {
            const result = await updateInvestmentAction(formData);
            if (result.ok) {
                showSuccess("Investment Updated", result.message);
            } else {
                showError("Update Failed", result.message);
            }
        } catch {
            showError("Update Failed", "Could not update investment. Please try again.");
        } finally {
            setEditState(null);
        }
    };

    const submitDeleteInvestment = async (formData: FormData) => {
        try {
            const result = await deleteInvestmentAction(formData);
            if (result.ok) {
                showSuccess("Investment Deleted", result.message);
            } else {
                showError("Delete Failed", result.message);
            }
        } catch {
            showError("Delete Failed", "Could not delete investment. Please try again.");
        }
    };

    return (
        <>
            <Card className="pf-surface-panel">
                <CardBody className="d-grid gap-3">
                    <h3 className="m-0 fs-6 fw-semibold">Investments</h3>
                    <div className="table-responsive">
                        <Table hover className="align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Initial</th>
                                    <th>Value (Units)</th>
                                    <th>Est. PHP Value</th>
                                    <th>Gain/Loss</th>
                                    <th>Remarks</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {investments.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="text-center py-4" style={{ color: "var(--color-text-muted)" }}>
                                            No investments yet.
                                        </td>
                                    </tr>
                                ) : (
                                    investments.map((investment) => (
                                        <tr key={investment.id}>
                                            <td>{investment.name}</td>
                                            <td>{formatPhp(investment.initialInvestmentPhp)}</td>
                                            <td>{unitFormatter.format(investment.value)} {investment.symbol}</td>
                                            <td>{investment.estimatedPhpValue === null ? "-" : formatPhp(investment.estimatedPhpValue)}</td>
                                            <td className={investment.gainLossPhp === null ? "" : investment.gainLossPhp >= 0 ? "text-success" : "text-danger"}>
                                                {investment.gainLossPhp === null ? "-" : formatPhp(investment.gainLossPhp)}
                                            </td>
                                            <td style={{ maxWidth: "20rem" }}>{investment.remarks?.trim() || "-"}</td>
                                            <td>
                                                <div className="d-flex align-items-center gap-2">
                                                    <ActionIconButton
                                                        action="edit"
                                                        label={`Edit investment ${investment.name}`}
                                                        onClick={() => setEditState(investment)}
                                                    />
                                                    <form action={submitDeleteInvestment}>
                                                        <input type="hidden" name="id" value={investment.id} />
                                                        <ConfirmSubmitIconButton
                                                            action="delete"
                                                            label={`Delete investment ${investment.name}`}
                                                            type="submit"
                                                            confirmTitle="Delete Investment"
                                                            confirmMessage={`Delete investment \"${investment.name}\"?`}
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
                    <Modal.Title>Edit Investment</Modal.Title>
                </Modal.Header>
                <form action={submitUpdateInvestment}>
                    <Modal.Body className="d-grid gap-3">
                        <input type="hidden" name="id" value={editState?.id ?? ""} />
                        <div className="d-grid gap-1">
                            <label htmlFor="edit-investment-name" className="small fw-semibold">Name</label>
                            <input
                                id="edit-investment-name"
                                type="text"
                                name="name"
                                className="form-control"
                                defaultValue={editState?.name ?? ""}
                                key={editState?.id ? `${editState.id}-name` : "edit-investment-name-empty"}
                                maxLength={80}
                                required
                            />
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="edit-investment-initial" className="small fw-semibold">Initial Investment (PHP)</label>
                            <input
                                id="edit-investment-initial"
                                type="number"
                                name="initialInvestmentPhp"
                                className="form-control"
                                defaultValue={editState ? editState.initialInvestmentPhp.toFixed(2) : ""}
                                key={editState?.id ? `${editState.id}-initial` : "edit-investment-initial-empty"}
                                min="0"
                                step="0.01"
                                required
                            />
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="edit-investment-value" className="small fw-semibold">Value (Units)</label>
                            <input
                                id="edit-investment-value"
                                type="number"
                                name="value"
                                className="form-control"
                                defaultValue={editState ? editState.value.toString() : ""}
                                key={editState?.id ? `${editState.id}-value` : "edit-investment-value-empty"}
                                min="0"
                                step="0.000001"
                                required
                            />
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="edit-investment-remarks" className="small fw-semibold">Remarks</label>
                            <textarea
                                id="edit-investment-remarks"
                                name="remarks"
                                className="form-control"
                                defaultValue={editState?.remarks ?? ""}
                                key={editState?.id ? `${editState.id}-remarks` : "edit-investment-remarks-empty"}
                                rows={2}
                                placeholder="Optional"
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
