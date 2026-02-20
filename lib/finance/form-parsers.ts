import { TransactionKind } from "@prisma/client";
import { parseMoneyInput, parseOptionalText } from "@/lib/finance/money";

const transactionKinds = new Set<TransactionKind>([
    "INCOME",
    "EXPENSE",
    "BUDGET_ALLOCATION",
    "TRANSFER",
    "CREDIT_CARD_CHARGE",
    "CREDIT_CARD_PAYMENT",
    "LOAN_BORROW",
    "LOAN_REPAY",
    "ADJUSTMENT",
]);

export const parseTransactionKind = (value: FormDataEntryValue | null): TransactionKind | null => {
    if (typeof value !== "string") {
        return null;
    }
    const normalized = value.trim() as TransactionKind;
    return transactionKinds.has(normalized) ? normalized : null;
};

export const parsePostedAt = (value: FormDataEntryValue | null) => {
    if (typeof value !== "string" || value.trim().length === 0) {
        return null;
    }
    const parsed = new Date(`${value.trim()}T00:00:00`);
    if (Number.isNaN(parsed.valueOf())) {
        return null;
    }
    return parsed;
};

export const parseRequiredId = (value: FormDataEntryValue | null) => {
    if (typeof value !== "string") {
        return null;
    }
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
};

export const parseOptionalId = (value: FormDataEntryValue | null) => {
    if (typeof value !== "string") {
        return null;
    }
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
};

export const parseTransactionForm = (formData: FormData) => {
    const kind = parseTransactionKind(formData.get("kind"));
    const postedAt = parsePostedAt(formData.get("postedAt"));
    const amountResult = parseMoneyInput(formData.get("amountPhp"), true);
    const remarksResult = parseOptionalText(formData.get("remarks"), 300);
    const walletAccountId = parseRequiredId(formData.get("walletAccountId"));
    const budgetEnvelopeId = parseOptionalId(formData.get("budgetEnvelopeId"));
    const targetWalletAccountId = parseOptionalId(formData.get("targetWalletAccountId"));
    const incomeStreamId = parseOptionalId(formData.get("incomeStreamId"));
    const loanRecordId = parseOptionalId(formData.get("loanRecordId"));

    const ok = Boolean(
        kind
        && postedAt
        && amountResult.ok
        && amountResult.value !== null
        && remarksResult.ok
        && walletAccountId,
    );

    return {
        ok,
        kind,
        postedAt,
        amountPhp: amountResult.value,
        remarks: remarksResult.value,
        walletAccountId,
        budgetEnvelopeId,
        targetWalletAccountId,
        incomeStreamId,
        loanRecordId,
    };
};
