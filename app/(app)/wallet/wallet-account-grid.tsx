"use client";

import { useState } from "react";
import Button from "react-bootstrap/Button";
import Card from "react-bootstrap/Card";
import CardBody from "react-bootstrap/CardBody";
import Modal from "react-bootstrap/Modal";
import ActionIconButton from "@/app/components/action-icon-button";
import ConfirmSubmitIconButton from "@/app/components/confirm-submit-icon-button";
import { useAppToast } from "@/app/components/toast-provider";
import { formatPhp } from "@/lib/finance/money";
import styles from "./page.module.scss";

type AccountTypeOption = {
    value: string;
    label: string;
};

type WalletAccountViewModel = {
    id: string;
    type: string;
    name: string;
    currentBalanceAmount: number;
    creditLimitPhp: number | null;
    statementClosingDay: number | null;
    statementDueDay: number | null;
};

type WalletAccountGroup = {
    type: string;
    label: string;
    entries: WalletAccountViewModel[];
};

type WalletAccountGridProps = {
    groups: WalletAccountGroup[];
    accountTypeOptions: AccountTypeOption[];
    updateWalletAccountAction: (formData: FormData) => Promise<{ ok: boolean; message: string }>;
    archiveWalletAccountAction: (formData: FormData) => Promise<{ ok: boolean; message: string }>;
};

type EditState = WalletAccountViewModel | null;

const assetAmountFormatter = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
});

const inferAssetSymbol = (name: string) => {
    const match = name.toUpperCase().match(/\b[A-Z]{2,10}\b/);
    return match?.[0] ?? "UNITS";
};

const formatAssetBalance = (name: string, amount: number) => `${assetAmountFormatter.format(amount)} ${inferAssetSymbol(name)}`;

export default function WalletAccountGrid({
    groups,
    accountTypeOptions,
    updateWalletAccountAction,
    archiveWalletAccountAction,
}: WalletAccountGridProps) {
    const [editState, setEditState] = useState<EditState>(null);
    const { showSuccess, showError } = useAppToast();

    const editType = editState?.type ?? "";

    const submitUpdateWalletAccount = async (formData: FormData) => {
        try {
            const result = await updateWalletAccountAction(formData);
            if (result.ok) {
                showSuccess("Wallet Account Updated", result.message);
            } else {
                showError("Update Failed", result.message);
            }
        } catch {
            showError("Update Failed", "Could not update wallet account. Please try again.");
        } finally {
            setEditState(null);
        }
    };

    const submitArchiveWalletAccount = async (formData: FormData) => {
        try {
            const result = await archiveWalletAccountAction(formData);
            if (result.ok) {
                showSuccess("Wallet Account Archived", result.message);
            } else {
                showError("Archive Failed", result.message);
            }
        } catch {
            showError("Archive Failed", "Could not archive wallet account. Please try again.");
        }
    };

    return (
        <>
            {groups.map((group) => (
                <Card key={group.type} className="pf-surface-panel">
                    <CardBody className="d-grid gap-3">
                        <h3 className="m-0 fs-6 fw-semibold">{group.label}</h3>
                        {group.entries.length === 0 ? (
                            <Card className="pf-surface-card">
                                <CardBody className="text-center py-4">
                                    <p className="m-0" style={{ color: "var(--color-text-muted)" }}>
                                        No accounts in this group.
                                    </p>
                                </CardBody>
                            </Card>
                        ) : (
                            <div className={styles.accountGrid}>
                                {group.entries.map((account) => (
                                    <Card key={account.id} className="pf-surface-card">
                                        <CardBody className="d-grid gap-2">
                                            <div className="d-flex justify-content-between align-items-start gap-2">
                                                <div>
                                                    <h4 className="m-0 fs-6 fw-semibold" style={{ color: "var(--color-text-strong)" }}>
                                                        {account.name}
                                                    </h4>
                                                    <small style={{ color: "var(--color-text-muted)" }}>
                                                        {account.type === "ASSET" ? "Holdings" : "Balance"}
                                                    </small>
                                                </div>
                                                <p className={`m-0 fw-semibold ${account.type === "CREDIT_CARD" ? "text-danger" : ""}`}>
                                                    {account.type === "ASSET"
                                                        ? formatAssetBalance(account.name, account.currentBalanceAmount)
                                                        : formatPhp(account.currentBalanceAmount)}
                                                </p>
                                            </div>

                                            <div className="d-grid gap-1">
                                                <small style={{ color: "var(--color-text-muted)" }}>
                                                    Credit Limit: {account.creditLimitPhp === null ? "-" : formatPhp(account.creditLimitPhp)}
                                                </small>
                                                <small style={{ color: "var(--color-text-muted)" }}>
                                                    Statement: {account.statementClosingDay && account.statementDueDay
                                                        ? `${account.statementClosingDay} -> ${account.statementDueDay}`
                                                        : "-"}
                                                </small>
                                            </div>

                                            <div className="d-flex gap-2 pt-1">
                                                <ActionIconButton
                                                    action="edit"
                                                    label={`Edit wallet account ${account.name}`}
                                                    onClick={() => setEditState(account)}
                                                />
                                                <form action={submitArchiveWalletAccount}>
                                                    <input type="hidden" name="id" value={account.id} />
                                                    <ConfirmSubmitIconButton
                                                        action="delete"
                                                        label={`Archive wallet account ${account.name}`}
                                                        type="submit"
                                                        confirmTitle="Archive Wallet Account"
                                                        confirmMessage={`Archive wallet account \"${account.name}\"?`}
                                                    />
                                                </form>
                                            </div>
                                        </CardBody>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </CardBody>
                </Card>
            ))}

            <Modal show={editState !== null} onHide={() => setEditState(null)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Edit Wallet Account</Modal.Title>
                </Modal.Header>
                <form action={submitUpdateWalletAccount}>
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
                                    setEditState((prev) => (prev ? { ...prev, type: event.target.value } : prev))
                                }
                            >
                                {accountTypeOptions.map((type) => (
                                    <option key={type.value} value={type.value}>{type.label}</option>
                                ))}
                            </select>
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
                            <label htmlFor="edit-wallet-balance" className="small fw-semibold">
                                {editType === "ASSET" ? "Current Amount (Units)" : "Current Balance (PHP)"}
                            </label>
                            <input
                                id="edit-wallet-balance"
                                type="number"
                                name="currentBalanceAmount"
                                className="form-control"
                                defaultValue={editState
                                    ? editType === "ASSET"
                                        ? editState.currentBalanceAmount.toString()
                                        : editState.currentBalanceAmount.toFixed(2)
                                    : ""}
                                key={editState?.id ? `${editState.id}-balance` : "edit-balance-empty"}
                                min="0"
                                step={editType === "ASSET" ? "0.000001" : "0.01"}
                                required
                            />
                        </div>
                        {editType === "CREDIT_CARD" && (
                            <>
                                <div className="d-grid gap-1">
                                    <label htmlFor="edit-wallet-credit-limit" className="small fw-semibold">Credit Limit</label>
                                    <input
                                        id="edit-wallet-credit-limit"
                                        type="number"
                                        name="creditLimitPhp"
                                        className="form-control"
                                        defaultValue={editState?.creditLimitPhp === null || editState?.creditLimitPhp === undefined
                                            ? ""
                                            : editState.creditLimitPhp.toFixed(2)}
                                        key={editState?.id ? `${editState.id}-credit-limit` : "edit-credit-limit-empty"}
                                        min="0"
                                        step="0.01"
                                    />
                                </div>
                                <div className="d-grid gap-1">
                                    <label htmlFor="edit-wallet-statement-close" className="small fw-semibold">Statement Closing Day (1-31)</label>
                                    <input
                                        id="edit-wallet-statement-close"
                                        type="number"
                                        name="statementClosingDay"
                                        className="form-control"
                                        defaultValue={editState?.statementClosingDay ?? ""}
                                        key={editState?.id ? `${editState.id}-statement-close` : "edit-statement-close-empty"}
                                        min="1"
                                        max="31"
                                    />
                                </div>
                                <div className="d-grid gap-1">
                                    <label htmlFor="edit-wallet-statement-due" className="small fw-semibold">Statement Due Day (1-31)</label>
                                    <input
                                        id="edit-wallet-statement-due"
                                        type="number"
                                        name="statementDueDay"
                                        className="form-control"
                                        defaultValue={editState?.statementDueDay ?? ""}
                                        key={editState?.id ? `${editState.id}-statement-due` : "edit-statement-due-empty"}
                                        min="1"
                                        max="31"
                                    />
                                </div>
                            </>
                        )}
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

