"use client";

import { useState } from "react";
import Button from "react-bootstrap/Button";
import type { ComponentProps } from "react";
import ConfirmationModal from "@/app/components/confirmation-modal";

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

            <ConfirmationModal
                isOpen={isOpen}
                title={confirmTitle}
                message={confirmMessage}
                onCancel={() => setIsOpen(false)}
                onConfirm={() => {
                    setIsOpen(false);
                    formElement?.requestSubmit();
                }}
            />
        </>
    );
}
