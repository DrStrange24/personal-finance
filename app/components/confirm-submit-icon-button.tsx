"use client";

import { useState } from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import type { ComponentProps } from "react";
import ActionIconButton from "@/app/components/action-icon-button";

type ConfirmSubmitIconButtonProps = Omit<ComponentProps<typeof ActionIconButton>, "onClick"> & {
    confirmTitle?: string;
    confirmMessage: string;
};

export default function ConfirmSubmitIconButton({
    confirmTitle = "Confirm Action",
    confirmMessage,
    ...props
}: ConfirmSubmitIconButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [formElement, setFormElement] = useState<HTMLFormElement | null>(null);

    return (
        <>
            <ActionIconButton
                {...props}
                type="button"
                onClick={(event) => {
                    setFormElement(event.currentTarget.form);
                    setIsOpen(true);
                }}
            />

            <Modal show={isOpen} onHide={() => setIsOpen(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>{confirmTitle}</Modal.Title>
                </Modal.Header>
                <Modal.Body>{confirmMessage}</Modal.Body>
                <Modal.Footer>
                    <Button variant="outline-secondary" onClick={() => setIsOpen(false)}>
                        Cancel
                    </Button>
                    <Button
                        variant="danger"
                        onClick={() => {
                            setIsOpen(false);
                            formElement?.requestSubmit();
                        }}
                    >
                        Confirm
                    </Button>
                </Modal.Footer>
            </Modal>
        </>
    );
}
