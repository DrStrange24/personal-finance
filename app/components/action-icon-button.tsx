import type { ComponentProps } from "react";
import Button from "react-bootstrap/Button";

type IconAction = "add" | "edit" | "delete";

type ActionIconButtonProps = Omit<ComponentProps<typeof Button>, "children" | "title" | "aria-label"> & {
    action: IconAction;
    label: string;
    title?: string;
};

const actionVariant: Record<IconAction, NonNullable<ComponentProps<typeof Button>["variant"]>> = {
    add: "primary",
    edit: "outline-primary",
    delete: "outline-danger",
};

const AddIcon = () => (
    <svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
        <path d="M8 1a.5.5 0 0 1 .5.5V7.5H14.5a.5.5 0 0 1 0 1H8.5V14.5a.5.5 0 0 1-1 0V8.5H1.5a.5.5 0 0 1 0-1H7.5V1.5A.5.5 0 0 1 8 1z" />
    </svg>
);

const EditIcon = () => (
    <svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
        <path d="M12.854.146a.5.5 0 0 1 .707 0l2.586 2.586a.5.5 0 0 1 0 .707l-9.5 9.5L4 13l.061-2.646 9.5-9.5zM11.207 2 5 8.207V10h1.793L13 3.793 11.207 2z" />
        <path d="M1 13.5A1.5 1.5 0 0 1 2.5 12H4v1H2.5a.5.5 0 0 0-.5.5V15h1.5a.5.5 0 0 0 .5-.5V13h1v1.5A1.5 1.5 0 0 1 3.5 16h-2A1.5 1.5 0 0 1 0 14.5v-1z" />
    </svg>
);

const DeleteIcon = () => (
    <svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
        <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm5 0A.5.5 0 0 1 11 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5z" />
        <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1 0-2H5V1.5A1.5 1.5 0 0 1 6.5 0h3A1.5 1.5 0 0 1 11 1.5V2h2.5a1 1 0 0 1 1 1zM6 2h4v-.5a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5V2zM4 4v9a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4H4z" />
    </svg>
);

const IconByAction = ({ action }: { action: IconAction }) => {
    if (action === "add") {
        return <AddIcon />;
    }

    if (action === "edit") {
        return <EditIcon />;
    }

    return <DeleteIcon />;
};

export default function ActionIconButton({
    action,
    label,
    title,
    variant,
    size = "sm",
    ...props
}: ActionIconButtonProps) {
    return (
        <Button
            {...props}
            size={size}
            variant={variant ?? actionVariant[action]}
            aria-label={label}
            title={title ?? label}
        >
            <IconByAction action={action} />
        </Button>
    );
}
