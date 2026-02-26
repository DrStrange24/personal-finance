"use client";

import { EntityType } from "@prisma/client";
import { useState } from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import ActionIconButton from "@/app/components/action-icon-button";
import { useAppToast } from "@/app/components/toast-provider";

type AddEntityModalProps = {
    createEntityAction: (formData: FormData) => Promise<{ ok: boolean; message: string }>;
};

export default function AddEntityModal({ createEntityAction }: AddEntityModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const { showSuccess, showError } = useAppToast();

    const submitCreateEntity = async (formData: FormData) => {
        try {
            const result = await createEntityAction(formData);
            if (result.ok) {
                showSuccess("Entity Created", result.message);
            } else {
                showError("Create Failed", result.message);
            }
        } catch {
            showError("Create Failed", "Could not create entity. Please try again.");
        } finally {
            setIsOpen(false);
        }
    };

    return (
        <>
            <div className="d-flex justify-content-end">
                <ActionIconButton action="add" label="Add entity" onClick={() => setIsOpen(true)} />
            </div>

            <Modal show={isOpen} onHide={() => setIsOpen(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Add Entity</Modal.Title>
                </Modal.Header>
                <form action={submitCreateEntity}>
                    <Modal.Body className="d-grid gap-3">
                        <div className="d-grid gap-1">
                            <label htmlFor="entity-name" className="small fw-semibold">Name</label>
                            <input id="entity-name" type="text" name="name" className="form-control" maxLength={80} required />
                        </div>
                        <div className="d-grid gap-1">
                            <label htmlFor="entity-type" className="small fw-semibold">Type</label>
                            <select id="entity-type" name="type" className="form-control" defaultValue={EntityType.PERSONAL}>
                                <option value={EntityType.PERSONAL}>Personal</option>
                                <option value={EntityType.BUSINESS}>Business</option>
                            </select>
                        </div>
                        <label className="small d-flex align-items-center gap-2 m-0">
                            <input type="checkbox" name="setActive" defaultChecked />
                            Set as active entity
                        </label>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button type="button" variant="outline-secondary" onClick={() => setIsOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit">Create Entity</Button>
                    </Modal.Footer>
                </form>
            </Modal>
        </>
    );
}
