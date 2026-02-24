"use client";

import { useState } from "react";
import type { ComponentProps } from "react";
import type { MouseEvent } from "react";
import ActionIconButton from "@/app/components/action-icon-button";
import ConfirmationModal from "@/app/components/confirmation-modal";

type ConfirmSubmitIconButtonProps = Omit<ComponentProps<typeof ActionIconButton>, "onClick"> & {
    confirmTitle?: string;
    confirmMessage: string;
};

export default function ConfirmSubmitIconButton({
    action,
    label,
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
                action={action}
                label={label}
                type="button"
                onClick={(event: MouseEvent<HTMLButtonElement>) => {
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
