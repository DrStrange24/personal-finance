"use client";

import { EntityType } from "@prisma/client";
import { useState } from "react";
import Button from "react-bootstrap/Button";
import Card from "react-bootstrap/Card";
import CardBody from "react-bootstrap/CardBody";
import Modal from "react-bootstrap/Modal";
import Table from "react-bootstrap/Table";
import ActionIconButton from "@/app/components/action-icon-button";
import ConfirmSubmitIconButton from "@/app/components/confirm-submit-icon-button";
import { useAppToast } from "@/app/components/toast-provider";

type EntityRow = {
    id: string;
    name: string;
    type: EntityType;
    totalRecords: number;
    createdAtLabel: string;
    isActive: boolean;
};

type EntityTableProps = {
    entities: EntityRow[];
    updateEntityAction: (formData: FormData) => Promise<{ ok: boolean; message: string }>;
    archiveEntityAction: (formData: FormData) => Promise<{ ok: boolean; message: string }>;
    setActiveEntityAction: (formData: FormData) => Promise<{ ok: boolean; message: string }>;
};

export default function EntityTable({
    entities,
    updateEntityAction,
    archiveEntityAction,
    setActiveEntityAction,
}: EntityTableProps) {
    const [editState, setEditState] = useState<EntityRow | null>(null);
    const { showSuccess, showError } = useAppToast();

    const submitUpdateEntity = async (formData: FormData) => {
        try {
            const result = await updateEntityAction(formData);
            if (result.ok) {
                showSuccess("Entity Updated", result.message);
            } else {
                showError("Update Failed", result.message);
            }
        } catch {
            showError("Update Failed", "Could not update entity. Please try again.");
        } finally {
            setEditState(null);
        }
    };

    const submitArchiveEntity = async (formData: FormData) => {
        try {
            const result = await archiveEntityAction(formData);
            if (result.ok) {
                showSuccess("Entity Archived", result.message);
            } else {
                showError("Archive Failed", result.message);
            }
        } catch {
            showError("Archive Failed", "Could not archive entity. Please try again.");
        }
    };

    const submitSetActiveEntity = async (formData: FormData) => {
        try {
            const result = await setActiveEntityAction(formData);
            if (result.ok) {
                showSuccess("Active Entity Updated", result.message);
            } else {
                showError("Set Active Failed", result.message);
            }
        } catch {
            showError("Set Active Failed", "Could not set active entity. Please try again.");
        }
    };

    return (
        <>
            <Card className="pf-surface-panel">
                <CardBody className="d-grid gap-3">
                    <h3 className="m-0 fs-6 fw-semibold">Entities</h3>
                    <div className="table-responsive">
                        <Table hover className="align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Type</th>
                                    <th>Records</th>
                                    <th>Created</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {entities.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="text-center py-4" style={{ color: "var(--color-text-muted)" }}>
                                            No entities yet.
                                        </td>
                                    </tr>
                                ) : (
                                    entities.map((entity) => (
                                        <tr key={entity.id}>
                                            <td>
                                                <span className="fw-semibold">{entity.name}</span>
                                                {entity.isActive && <span className="ms-2 badge text-bg-primary">Active</span>}
                                            </td>
                                            <td>{entity.type === EntityType.PERSONAL ? "Personal" : "Business"}</td>
                                            <td>{entity.totalRecords}</td>
                                            <td>{entity.createdAtLabel}</td>
                                            <td>
                                                <div className="d-flex align-items-center gap-2">
                                                    <ActionIconButton
                                                        action="edit"
                                                        label={`Edit entity ${entity.name}`}
                                                        onClick={() => setEditState(entity)}
                                                    />
                                                    {!entity.isActive && (
                                                        <form action={submitSetActiveEntity}>
                                                            <input type="hidden" name="id" value={entity.id} />
                                                            <Button size="sm" variant="outline-primary" type="submit">
                                                                Set Active
                                                            </Button>
                                                        </form>
                                                    )}
                                                    <form action={submitArchiveEntity}>
                                                        <input type="hidden" name="id" value={entity.id} />
                                                        <ConfirmSubmitIconButton
                                                            action="delete"
                                                            label={`Archive entity ${entity.name}`}
                                                            type="submit"
                                                            confirmTitle="Archive Entity"
                                                            confirmMessage={`Archive "${entity.name}"? Its records will be preserved and hidden from active selection.`}
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
                    <Modal.Title>Edit Entity</Modal.Title>
                </Modal.Header>
                <form action={submitUpdateEntity}>
                    <Modal.Body className="d-grid gap-3">
                        <input type="hidden" name="id" value={editState?.id ?? ""} />
                        <div className="d-grid gap-1">
                            <label htmlFor="edit-entity-name" className="small fw-semibold">Name</label>
                            <input
                                id="edit-entity-name"
                                type="text"
                                name="name"
                                className="form-control"
                                defaultValue={editState?.name ?? ""}
                                key={editState?.id ? `${editState.id}-name` : "edit-entity-name-empty"}
                                maxLength={80}
                                required
                            />
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="edit-entity-type" className="small fw-semibold">Type</label>
                            <select
                                id="edit-entity-type"
                                name="type"
                                className="form-control"
                                defaultValue={editState?.type ?? EntityType.PERSONAL}
                                key={editState?.id ? `${editState.id}-type` : "edit-entity-type-empty"}
                            >
                                <option value={EntityType.PERSONAL}>Personal</option>
                                <option value={EntityType.BUSINESS}>Business</option>
                            </select>
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
