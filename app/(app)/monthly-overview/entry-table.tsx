"use client";

import { useState } from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Table from "react-bootstrap/Table";

type EntryRow = {
    id: string;
    entryDateIso: string;
    entryDateLabel: string;
    walletAmount: number;
    walletAmountLabel: string;
    remarks: string;
};

type EntryAction = (formData: FormData) => void | Promise<void>;

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

export default function MonthlyOverviewEntryTable({
    entries,
    createEntryAction,
    updateEntryAction,
    deleteEntryAction,
}: MonthlyOverviewEntryTableProps) {
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editState, setEditState] = useState<EditState>(null);
    const submitCreateEntry = async (formData: FormData) => {
        await createEntryAction(formData);
        setIsAddModalOpen(false);
    };
    const submitUpdateEntry = async (formData: FormData) => {
        await updateEntryAction(formData);
        setEditState(null);
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
                        <th scope="col">Remarks</th>
                        <th scope="col">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {entries.length === 0 ? (
                        <tr>
                            <td colSpan={5} className="text-center py-4" style={{ color: "var(--color-text-muted)" }}>
                                No monthly overview entries yet.
                            </td>
                        </tr>
                    ) : (
                        entries.map((entry, index) => (
                            <tr key={entry.id}>
                                <td>{index + 1}</td>
                                <td>{entry.entryDateLabel}</td>
                                <td>{entry.walletAmountLabel}</td>
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
                                        <form action={deleteEntryAction}>
                                            <input type="hidden" name="id" value={entry.id} />
                                            <button type="submit" className="btn btn-sm btn-outline-danger">
                                                Delete
                                            </button>
                                        </form>
                                    </div>
                                </td>
                            </tr>
                        ))
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
        </>
    );
}
