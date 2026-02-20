"use client";

import { useState } from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import type { ComponentProps } from "react";

type ConfirmSubmitButtonProps = Omit<ComponentProps<typeof Button>, "onClick"> & {
    confirmTitle?: string;
    confirmMessage: string;
};

export default function ConfirmSubmitButton({
    confirmTitle = "Confirm Action",
    confirmMessage,
    ...props
}: ConfirmSubmitButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [formElement, setFormElement] = useState<HTMLFormElement | null>(null);

    return (
        <>
            <Button
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
