"use client";

import { useMemo, useState } from "react";
import Badge from "react-bootstrap/Badge";
import Button from "react-bootstrap/Button";
import Card from "react-bootstrap/Card";
import CardBody from "react-bootstrap/CardBody";
import Modal from "react-bootstrap/Modal";
import ActionIconButton from "@/app/components/action-icon-button";
import { useAppToast } from "@/app/components/toast-provider";
import styles from "./page.module.scss";

type WalletEntryType = "CASH_WALLET" | "ASSET_HOLDING";

type WalletEntryViewModel = {
    id: string;
    type: WalletEntryType;
    groupName: string;
    name: string;
    currentValuePhp: number;
    currentValuePhpLabel: string;
    initialInvestmentPhp: number | null;
    initialInvestmentPhpLabel: string | null;
    remarks: string;
    sortOrder: number;
    pnlPhp: number | null;
    pnlPhpLabel: string | null;
    pnlPercent: number | null;
    pnlPercentLabel: string | null;
};

type WalletActionResult = {
    ok: boolean;
    message: string;
};

type WalletEntryAction = (formData: FormData) => Promise<WalletActionResult>;

type WalletEntryGridProps = {
    entries: WalletEntryViewModel[];
    cashEntries: WalletEntryViewModel[];
    assetEntries: WalletEntryViewModel[];
    grandTotalPhpLabel: string;
    cashTotalPhpLabel: string;
    assetTotalPhpLabel: string;
    createWalletEntryAction: WalletEntryAction;
    updateWalletEntryAction: WalletEntryAction;
    deleteWalletEntryAction: WalletEntryAction;
};

type EditState = {
    id: string;
    type: WalletEntryType;
    groupName: string;
    name: string;
    currentValuePhp: number;
    initialInvestmentPhp: number | null;
    remarks: string;
    sortOrder: number;
} | null;

type DeleteState = {
    id: string;
    name: string;
    valueLabel: string;
} | null;

const typeLabel = {
    CASH_WALLET: "Cash Wallet",
    ASSET_HOLDING: "Asset Holding",
} satisfies Record<WalletEntryType, string>;

const pnlClassName = (value: number | null) => {
    if (value === null) {
        return "text-body-secondary";
    }
    if (value < 0) {
        return "text-danger";
    }
    return "text-success";
};

export default function WalletEntryGrid({
    entries,
    cashEntries,
    assetEntries,
    grandTotalPhpLabel,
    cashTotalPhpLabel,
    assetTotalPhpLabel,
    createWalletEntryAction,
    updateWalletEntryAction,
    deleteWalletEntryAction,
}: WalletEntryGridProps) {
    const { showSuccess, showError } = useAppToast();
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [createType, setCreateType] = useState<WalletEntryType>("CASH_WALLET");
    const [editState, setEditState] = useState<EditState>(null);
    const [deleteState, setDeleteState] = useState<DeleteState>(null);

    const groupedAssetEntries = useMemo(() => {
        return assetEntries.reduce<Record<string, WalletEntryViewModel[]>>((acc, entry) => {
            const key = entry.groupName.trim() || "Ungrouped";
            const existing = acc[key] ?? [];
            existing.push(entry);
            acc[key] = existing;
            return acc;
        }, {});
    }, [assetEntries]);

    const editType = editState?.type ?? "CASH_WALLET";
    const editInitialInvestmentDefaultValue = editState?.initialInvestmentPhp === null || editState?.initialInvestmentPhp === undefined
        ? ""
        : editState.initialInvestmentPhp.toFixed(2);

    const submitCreateWalletEntry = async (formData: FormData) => {
        try {
            const result = await createWalletEntryAction(formData);
            if (result.ok) {
                setIsAddModalOpen(false);
                setCreateType("CASH_WALLET");
                showSuccess("Wallet Entry Created", result.message);
                return;
            }
            showError("Create Failed", result.message);
        } catch {
            showError("Create Failed", "Could not create wallet entry. Please try again.");
        }
    };

    const submitUpdateWalletEntry = async (formData: FormData) => {
        try {
            const result = await updateWalletEntryAction(formData);
            if (result.ok) {
                setEditState(null);
                showSuccess("Wallet Entry Updated", result.message);
                return;
            }
            showError("Update Failed", result.message);
        } catch {
            showError("Update Failed", "Could not update wallet entry. Please try again.");
        }
    };

    const submitDeleteWalletEntry = async (formData: FormData) => {
        try {
            const result = await deleteWalletEntryAction(formData);
            if (result.ok) {
                setDeleteState(null);
                showSuccess("Wallet Entry Deleted", result.message);
                return;
            }
            showError("Delete Failed", result.message);
        } catch {
            showError("Delete Failed", "Could not delete wallet entry. Please try again.");
        }
    };

    return (
        <>
            <div className="d-flex justify-content-end">
                <ActionIconButton
                    action="add"
                    label="Add wallet entry"
                    onClick={() => setIsAddModalOpen(true)}
                />
            </div>

            <div className={styles.summaryGrid}>
                <Card className="pf-surface-card">
                    <CardBody className={styles.summaryCardBody}>
                        <small className={styles.summaryLabel}>Grand Total</small>
                        <p className={styles.summaryValue}>{grandTotalPhpLabel}</p>
                    </CardBody>
                </Card>
                <Card className="pf-surface-card">
                    <CardBody className={styles.summaryCardBody}>
                        <small className={styles.summaryLabel}>Cash Total</small>
                        <p className={styles.summaryValue}>{cashTotalPhpLabel}</p>
                    </CardBody>
                </Card>
                <Card className="pf-surface-card">
                    <CardBody className={styles.summaryCardBody}>
                        <small className={styles.summaryLabel}>Assets Total</small>
                        <p className={styles.summaryValue}>{assetTotalPhpLabel}</p>
                    </CardBody>
                </Card>
            </div>

            <div className="d-grid gap-4">
                <section className="d-grid gap-3">
                    <div>
                        <h3 className="fs-6 fw-semibold mb-1" style={{ color: "var(--color-text-strong)" }}>Cash Wallets</h3>
                        <p className="small m-0" style={{ color: "var(--color-text-muted)" }}>Current cash balances in PHP equivalent.</p>
                    </div>
                    {cashEntries.length === 0 ? (
                        <Card className="pf-surface-panel">
                            <CardBody className="py-4 text-center">
                                <p className="m-0" style={{ color: "var(--color-text-muted)" }}>No cash wallet entries yet.</p>
                            </CardBody>
                        </Card>
                    ) : (
                        <div className={styles.cardGrid}>
                            {cashEntries.map((entry) => (
                                <Card key={entry.id} className="pf-surface-card">
                                    <CardBody className="d-grid gap-2">
                                        <div className="d-flex justify-content-between align-items-start gap-2">
                                            <div>
                                                <h4 className="fs-6 fw-semibold m-0" style={{ color: "var(--color-text-strong)" }}>{entry.name}</h4>
                                                <small style={{ color: "var(--color-text-muted)" }}>{typeLabel[entry.type]}</small>
                                            </div>
                                            <Badge bg="primary-subtle" text="dark">
                                                {entry.currentValuePhpLabel}
                                            </Badge>
                                        </div>
                                        {entry.remarks.trim().length > 0 && (
                                            <p className="small m-0" style={{ color: "var(--color-text-muted)" }}>{entry.remarks}</p>
                                        )}
                                        <div className="d-flex gap-2 pt-1">
                                            <ActionIconButton
                                                action="edit"
                                                label={`Edit wallet entry ${entry.name}`}
                                                onClick={() =>
                                                    setEditState({
                                                        id: entry.id,
                                                        type: entry.type,
                                                        groupName: entry.groupName,
                                                        name: entry.name,
                                                        currentValuePhp: entry.currentValuePhp,
                                                        initialInvestmentPhp: entry.initialInvestmentPhp,
                                                        remarks: entry.remarks,
                                                        sortOrder: entry.sortOrder,
                                                    })
                                                }
                                            />
                                            <ActionIconButton
                                                action="delete"
                                                label={`Delete wallet entry ${entry.name}`}
                                                onClick={() => setDeleteState({ id: entry.id, name: entry.name, valueLabel: entry.currentValuePhpLabel })}
                                            />
                                        </div>
                                    </CardBody>
                                </Card>
                            ))}
                        </div>
                    )}
                </section>

                <section className="d-grid gap-3">
                    <div>
                        <h3 className="fs-6 fw-semibold mb-1" style={{ color: "var(--color-text-strong)" }}>Asset Holdings</h3>
                        <p className="small m-0" style={{ color: "var(--color-text-muted)" }}>Current asset values and simple unrealized P/L.</p>
                    </div>
                    {assetEntries.length === 0 ? (
                        <Card className="pf-surface-panel">
                            <CardBody className="py-4 text-center">
                                <p className="m-0" style={{ color: "var(--color-text-muted)" }}>No asset holdings yet.</p>
                            </CardBody>
                        </Card>
                    ) : (
                        <div className="d-grid gap-4">
                            {Object.entries(groupedAssetEntries).map(([groupName, groupEntries]) => (
                                <div key={groupName} className="d-grid gap-2">
                                    <p className="m-0 small text-uppercase fw-semibold" style={{ letterSpacing: "0.08em", color: "var(--color-text-muted)" }}>
                                        {groupName}
                                    </p>
                                    <div className={styles.cardGrid}>
                                        {groupEntries.map((entry) => (
                                            <Card key={entry.id} className="pf-surface-card">
                                                <CardBody className="d-grid gap-2">
                                                    <div className="d-flex justify-content-between align-items-start gap-2">
                                                        <div>
                                                            <h4 className="fs-6 fw-semibold m-0" style={{ color: "var(--color-text-strong)" }}>{entry.name}</h4>
                                                            <small style={{ color: "var(--color-text-muted)" }}>{typeLabel[entry.type]}</small>
                                                        </div>
                                                        <Badge bg="info-subtle" text="dark">
                                                            {entry.currentValuePhpLabel}
                                                        </Badge>
                                                    </div>

                                                    <div className="d-grid gap-1">
                                                        <small style={{ color: "var(--color-text-muted)" }}>
                                                            Initial Investment: {entry.initialInvestmentPhpLabel ?? "-"}
                                                        </small>
                                                        <small className={pnlClassName(entry.pnlPhp)}>
                                                            P/L: {entry.pnlPhpLabel ?? "-"}
                                                            {entry.pnlPercentLabel ? ` (${entry.pnlPercentLabel})` : ""}
                                                        </small>
                                                    </div>

                                                    {entry.remarks.trim().length > 0 && (
                                                        <p className="small m-0" style={{ color: "var(--color-text-muted)" }}>{entry.remarks}</p>
                                                    )}

                                                    <div className="d-flex gap-2 pt-1">
                                                        <ActionIconButton
                                                            action="edit"
                                                            label={`Edit wallet entry ${entry.name}`}
                                                            onClick={() =>
                                                                setEditState({
                                                                    id: entry.id,
                                                                    type: entry.type,
                                                                    groupName: entry.groupName,
                                                                    name: entry.name,
                                                                    currentValuePhp: entry.currentValuePhp,
                                                                    initialInvestmentPhp: entry.initialInvestmentPhp,
                                                                    remarks: entry.remarks,
                                                                    sortOrder: entry.sortOrder,
                                                                })
                                                            }
                                                        />
                                                        <ActionIconButton
                                                            action="delete"
                                                            label={`Delete wallet entry ${entry.name}`}
                                                            onClick={() => setDeleteState({ id: entry.id, name: entry.name, valueLabel: entry.currentValuePhpLabel })}
                                                        />
                                                    </div>
                                                </CardBody>
                                            </Card>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <section>
                    <Card className="pf-surface-panel">
                        <CardBody>
                            <h3 className="fs-6 fw-semibold mb-1" style={{ color: "var(--color-text-strong)" }}>SmartCrowd</h3>
                            <p className="small m-0" style={{ color: "var(--color-text-muted)" }}>
                                Integration and tracking fields are coming soon.
                            </p>
                        </CardBody>
                    </Card>
                </section>
            </div>

            <Modal show={isAddModalOpen} onHide={() => setIsAddModalOpen(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Add Wallet Entry</Modal.Title>
                </Modal.Header>
                <form action={submitCreateWalletEntry}>
                    <Modal.Body className="d-grid gap-3">
                        <div className="d-grid gap-1">
                            <label htmlFor="create-wallet-type" className="small fw-semibold">Type</label>
                            <select
                                id="create-wallet-type"
                                name="type"
                                className="form-control"
                                value={createType}
                                onChange={(event) => setCreateType(event.target.value as WalletEntryType)}
                            >
                                <option value="CASH_WALLET">Cash Wallet</option>
                                <option value="ASSET_HOLDING">Asset Holding</option>
                            </select>
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="create-wallet-group-name" className="small fw-semibold">Group Name</label>
                            <input
                                id="create-wallet-group-name"
                                type="text"
                                name="groupName"
                                className="form-control"
                                maxLength={80}
                                placeholder="Optional (e.g. Coins PH)"
                            />
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="create-wallet-name" className="small fw-semibold">Name</label>
                            <input
                                id="create-wallet-name"
                                type="text"
                                name="name"
                                className="form-control"
                                maxLength={80}
                                required
                            />
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="create-wallet-current-value" className="small fw-semibold">Current Value (PHP)</label>
                            <input
                                id="create-wallet-current-value"
                                type="number"
                                name="currentValuePhp"
                                className="form-control"
                                min="0"
                                step="0.01"
                                required
                            />
                        </div>
                        {createType === "ASSET_HOLDING" && (
                            <div className="d-grid gap-1">
                                <label htmlFor="create-wallet-initial-investment" className="small fw-semibold">Initial Investment (PHP)</label>
                                <input
                                    id="create-wallet-initial-investment"
                                    type="number"
                                    name="initialInvestmentPhp"
                                    className="form-control"
                                    min="0"
                                    step="0.01"
                                />
                            </div>
                        )}
                        <input type="hidden" name="sortOrder" value="0" />
                        <div className="d-grid gap-1">
                            <label htmlFor="create-wallet-remarks" className="small fw-semibold">Remarks</label>
                            <textarea
                                id="create-wallet-remarks"
                                name="remarks"
                                className="form-control"
                                rows={3}
                                maxLength={300}
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
                    <Modal.Title>Edit Wallet Entry</Modal.Title>
                </Modal.Header>
                <form action={submitUpdateWalletEntry}>
                    <Modal.Body className="d-grid gap-3">
                        <input type="hidden" name="id" value={editState?.id ?? ""} />
                        <div className="d-grid gap-1">
                            <label htmlFor="edit-wallet-type" className="small fw-semibold">Type</label>
                            <select
                                id="edit-wallet-type"
                                name="type"
                                className="form-control"
                                value={editType}
                                onChange={(event) =>
                                    setEditState((prev) => (prev ? { ...prev, type: event.target.value as WalletEntryType } : prev))
                                }
                            >
                                <option value="CASH_WALLET">Cash Wallet</option>
                                <option value="ASSET_HOLDING">Asset Holding</option>
                            </select>
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="edit-wallet-group-name" className="small fw-semibold">Group Name</label>
                            <input
                                id="edit-wallet-group-name"
                                type="text"
                                name="groupName"
                                className="form-control"
                                maxLength={80}
                                defaultValue={editState?.groupName ?? ""}
                                key={editState?.id ? `${editState.id}-group` : "edit-group-empty"}
                                placeholder="Optional (e.g. Coins PH)"
                            />
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="edit-wallet-name" className="small fw-semibold">Name</label>
                            <input
                                id="edit-wallet-name"
                                type="text"
                                name="name"
                                className="form-control"
                                maxLength={80}
                                defaultValue={editState?.name ?? ""}
                                key={editState?.id ? `${editState.id}-name` : "edit-name-empty"}
                                required
                            />
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="edit-wallet-current-value" className="small fw-semibold">Current Value (PHP)</label>
                            <input
                                id="edit-wallet-current-value"
                                type="number"
                                name="currentValuePhp"
                                className="form-control"
                                defaultValue={editState ? editState.currentValuePhp.toFixed(2) : ""}
                                key={editState?.id ? `${editState.id}-current` : "edit-current-empty"}
                                min="0"
                                step="0.01"
                                required
                            />
                        </div>
                        {editType === "ASSET_HOLDING" && (
                            <div className="d-grid gap-1">
                                <label htmlFor="edit-wallet-initial-investment" className="small fw-semibold">Initial Investment (PHP)</label>
                                <input
                                    id="edit-wallet-initial-investment"
                                    type="number"
                                    name="initialInvestmentPhp"
                                    className="form-control"
                                    defaultValue={editInitialInvestmentDefaultValue}
                                    key={editState?.id ? `${editState.id}-initial` : "edit-initial-empty"}
                                    min="0"
                                    step="0.01"
                                />
                            </div>
                        )}
                        <input type="hidden" name="sortOrder" value={editState?.sortOrder ?? 0} />
                        <div className="d-grid gap-1">
                            <label htmlFor="edit-wallet-remarks" className="small fw-semibold">Remarks</label>
                            <textarea
                                id="edit-wallet-remarks"
                                name="remarks"
                                className="form-control"
                                rows={3}
                                maxLength={300}
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
                <form action={submitDeleteWalletEntry}>
                    <Modal.Body className="d-grid gap-2">
                        <input type="hidden" name="id" value={deleteState?.id ?? ""} />
                        <p className="m-0">Delete this wallet entry?</p>
                        <p className="m-0 small" style={{ color: "var(--color-text-muted)" }}>
                            {deleteState ? `${deleteState.name} - ${deleteState.valueLabel}` : ""}
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

            {entries.length === 0 && (
                <Card className="pf-surface-panel">
                    <CardBody className="text-center py-4">
                        <p className="m-0" style={{ color: "var(--color-text-muted)" }}>
                            No wallet entries yet. Use &quot;Add Wallet Entry&quot; to start tracking your balances.
                        </p>
                    </CardBody>
                </Card>
            )}
        </>
    );
}
