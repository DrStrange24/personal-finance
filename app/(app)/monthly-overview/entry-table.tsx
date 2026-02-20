"use client";

import { useState } from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Table from "react-bootstrap/Table";
import { useAppToast } from "@/app/components/toast-provider";

type EntryRow = {
    id: string;
    entryDateIso: string;
    entryDateLabel: string;
    walletAmount: number;
    walletAmountLabel: string;
    remarks: string;
};

type EntryActionResult = {
    ok: boolean;
    message: string;
};

type EntryAction = (formData: FormData) => Promise<EntryActionResult>;

type MonthlyOverviewEntryTableProps = {
    entries: EntryRow[];
    createEntryAction: EntryAction;
    updateEntryAction: EntryAction;
    deleteEntryAction: EntryAction;
};

type EditState = {
    id: string;
    entryDateIso: string;
    walletAmount: number;
    remarks: string;
} | null;

type DeleteState = {
    id: string;
    entryDateLabel: string;
    walletAmountLabel: string;
} | null;

const currencyDeltaFormatter = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const formatSignedCurrencyDelta = (value: number) => {
    if (value < 0) {
        return `(${currencyDeltaFormatter.format(Math.abs(value))})`;
    }

    return currencyDeltaFormatter.format(value);
};

const formatSignedPercent = (value: number) => {
    return percentFormatter.format(value);
};

export default function MonthlyOverviewEntryTable({
    entries,
    createEntryAction,
    updateEntryAction,
    deleteEntryAction,
}: MonthlyOverviewEntryTableProps) {
    const { showSuccess, showError } = useAppToast();
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editState, setEditState] = useState<EditState>(null);
    const [deleteState, setDeleteState] = useState<DeleteState>(null);

    const submitCreateEntry = async (formData: FormData) => {
        try {
            const result = await createEntryAction(formData);
            if (result.ok) {
                setIsAddModalOpen(false);
                showSuccess("Entry Created", result.message);
                return;
            }
            showError("Create Failed", result.message);
        } catch {
            showError("Create Failed", "Could not create entry. Please try again.");
        }
    };

    const submitUpdateEntry = async (formData: FormData) => {
        try {
            const result = await updateEntryAction(formData);
            if (result.ok) {
                setEditState(null);
                showSuccess("Entry Updated", result.message);
                return;
            }
            showError("Update Failed", result.message);
        } catch {
            showError("Update Failed", "Could not update entry. Please try again.");
        }
    };

    const submitDeleteEntry = async (formData: FormData) => {
        try {
            const result = await deleteEntryAction(formData);
            if (result.ok) {
                setDeleteState(null);
                showSuccess("Entry Deleted", result.message);
                return;
            }
            showError("Delete Failed", result.message);
        } catch {
            showError("Delete Failed", "Could not delete entry. Please try again.");
        }
    };

    return (
        <>
            <div className="d-flex justify-content-end mb-3">
                <Button size="sm" onClick={() => setIsAddModalOpen(true)}>
                    Add Entry
                </Button>
            </div>

            <Table hover className="align-middle mb-0">
                <thead>
                    <tr>
                        <th scope="col">#</th>
                        <th scope="col">Date</th>
                        <th scope="col">Wallet</th>
                        <th scope="col">Increased (₱)</th>
                        <th scope="col">Increased (%)</th>
                        <th scope="col">Remarks</th>
                        <th scope="col">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {entries.length === 0 ? (
                        <tr>
                            <td colSpan={7} className="text-center py-4" style={{ color: "var(--color-text-muted)" }}>
                                No monthly overview entries yet.
                            </td>
                        </tr>
                    ) : (
                        entries.map((entry, index) => {
                            const previousEntry = entries[index + 1];
                            const increasedAmount = previousEntry ? entry.walletAmount - previousEntry.walletAmount : null;
                            const increasedPercent = previousEntry && previousEntry.walletAmount !== 0
                                ? (increasedAmount! / previousEntry.walletAmount) * 100
                                : null;
                            const increaseTextClass = increasedAmount === null
                                ? "text-body-secondary"
                                : increasedAmount < 0
                                    ? "text-danger"
                                    : "text-success";

                            return (
                                <tr key={entry.id}>
                                    <td>{index + 1}</td>
                                    <td>{entry.entryDateLabel}</td>
                                    <td>{entry.walletAmountLabel}</td>
                                    <td className={increaseTextClass}>
                                        {increasedAmount === null ? "-" : formatSignedCurrencyDelta(increasedAmount)}
                                    </td>
                                    <td className={increaseTextClass}>
                                        {increasedPercent === null ? "-" : `${formatSignedPercent(increasedPercent)}%`}
                                    </td>
                                    <td>{entry.remarks.trim() || "-"}</td>
                                    <td>
                                        <div className="d-flex align-items-center gap-2">
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline-primary"
                                                onClick={() =>
                                                    setEditState({
                                                        id: entry.id,
                                                        entryDateIso: entry.entryDateIso,
                                                        walletAmount: entry.walletAmount,
                                                        remarks: entry.remarks,
                                                    })
                                                }
                                            >
                                                Edit
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline-danger"
                                                onClick={() =>
                                                    setDeleteState({
                                                        id: entry.id,
                                                        entryDateLabel: entry.entryDateLabel,
                                                        walletAmountLabel: entry.walletAmountLabel,
                                                    })
                                                }
                                            >
                                                Delete
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </Table>

            <Modal show={isAddModalOpen} onHide={() => setIsAddModalOpen(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Add Monthly Overview Entry</Modal.Title>
                </Modal.Header>
                <form action={submitCreateEntry}>
                    <Modal.Body className="d-grid gap-3">
                        <div className="d-grid gap-1">
                            <label htmlFor="create-entry-date" className="small fw-semibold">Date</label>
                            <input id="create-entry-date" type="date" name="entryDate" className="form-control" required />
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="create-wallet-amount" className="small fw-semibold">Wallet Amount</label>
                            <input
                                id="create-wallet-amount"
                                type="number"
                                name="walletAmount"
                                className="form-control"
                                min="0"
                                step="0.01"
                                required
                            />
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="create-remarks" className="small fw-semibold">Remarks</label>
                            <textarea
                                id="create-remarks"
                                name="remarks"
                                className="form-control"
                                rows={3}
                                placeholder="Optional"
                            />
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="outline-secondary" onClick={() => setIsAddModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit">Save</Button>
                    </Modal.Footer>
                </form>
            </Modal>

            <Modal show={editState !== null} onHide={() => setEditState(null)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Edit Monthly Overview Entry</Modal.Title>
                </Modal.Header>
                <form action={submitUpdateEntry}>
                    <Modal.Body className="d-grid gap-3">
                        <input type="hidden" name="id" value={editState?.id ?? ""} />
                        <div className="d-grid gap-1">
                            <label htmlFor="edit-entry-date" className="small fw-semibold">Date</label>
                            <input
                                id="edit-entry-date"
                                type="date"
                                name="entryDate"
                                className="form-control"
                                defaultValue={editState?.entryDateIso ?? ""}
                                key={editState?.id ? `${editState.id}-date` : "edit-date-empty"}
                                required
                            />
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="edit-wallet-amount" className="small fw-semibold">Wallet Amount</label>
                            <input
                                id="edit-wallet-amount"
                                type="number"
                                name="walletAmount"
                                className="form-control"
                                defaultValue={editState ? editState.walletAmount.toFixed(2) : ""}
                                key={editState?.id ? `${editState.id}-wallet` : "edit-wallet-empty"}
                                min="0"
                                step="0.01"
                                required
                            />
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="edit-remarks" className="small fw-semibold">Remarks</label>
                            <textarea
                                id="edit-remarks"
                                name="remarks"
                                className="form-control"
                                rows={3}
                                defaultValue={editState?.remarks ?? ""}
                                key={editState?.id ? `${editState.id}-remarks` : "edit-remarks-empty"}
                                placeholder="Optional"
                            />
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="outline-secondary" onClick={() => setEditState(null)}>
                            Cancel
                        </Button>
                        <Button type="submit">Update</Button>
                    </Modal.Footer>
                </form>
            </Modal>

            <Modal show={deleteState !== null} onHide={() => setDeleteState(null)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Confirm Delete</Modal.Title>
                </Modal.Header>
                <form action={submitDeleteEntry}>
                    <Modal.Body className="d-grid gap-2">
                        <input type="hidden" name="id" value={deleteState?.id ?? ""} />
                        <p className="m-0">Delete this monthly overview entry?</p>
                        <p className="m-0 small" style={{ color: "var(--color-text-muted)" }}>
                            {deleteState ? `${deleteState.entryDateLabel} - ${deleteState.walletAmountLabel}` : ""}
                        </p>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="outline-secondary" onClick={() => setDeleteState(null)}>
                            Cancel
                        </Button>
                        <Button type="submit" variant="danger">
                            Delete
                        </Button>
                    </Modal.Footer>
                </form>
            </Modal>
        </>
    );
}
