import Badge from "react-bootstrap/Badge";
import { TransactionKind } from "@prisma/client";
import { transactionKindLabel } from "@/lib/finance/types";

const variantByKind: Record<TransactionKind, { bg: string; text: string }> = {
    INCOME: { bg: "success-subtle", text: "dark" },
    EXPENSE: { bg: "danger-subtle", text: "dark" },
    BUDGET_ALLOCATION: { bg: "warning-subtle", text: "dark" },
    TRANSFER: { bg: "info-subtle", text: "dark" },
    CREDIT_CARD_CHARGE: { bg: "warning-subtle", text: "dark" },
    CREDIT_CARD_PAYMENT: { bg: "secondary-subtle", text: "dark" },
    LOAN_BORROW: { bg: "primary-subtle", text: "dark" },
    LOAN_REPAY: { bg: "secondary-subtle", text: "dark" },
    ADJUSTMENT: { bg: "light", text: "dark" },
};

export default function TransactionKindBadge({ kind }: { kind: TransactionKind }) {
    const variant = variantByKind[kind];
    return (
        <Badge bg={variant.bg} text={variant.text}>
            {transactionKindLabel[kind]}
        </Badge>
    );
}
