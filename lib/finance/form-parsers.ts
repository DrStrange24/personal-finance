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

export const parseCheckboxFlag = (value: FormDataEntryValue | null) => {
    if (typeof value !== "string") {
        return false;
    }
    return value.trim().toLowerCase() === "on";
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
    const recordOnly = parseCheckboxFlag(formData.get("recordOnly"));

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
        recordOnly,
    };
};

export type IncomeDistributionRow = {
    budgetEnvelopeId: string;
    amountPhp: number;
};

export const parseIncomeDistributionForm = (formData: FormData) => {
    const envelopeValues = formData.getAll("distributedBudgetEnvelopeId");
    const amountValues = formData.getAll("distributedAmountPhp");

    if (envelopeValues.length !== amountValues.length) {
        return {
            ok: false,
            rows: [] as IncomeDistributionRow[],
            totalAmountPhp: 0,
        };
    }

    const rows: IncomeDistributionRow[] = [];
    const seenEnvelopeIds = new Set<string>();

    for (let index = 0; index < envelopeValues.length; index += 1) {
        const budgetEnvelopeId = parseRequiredId(envelopeValues[index] ?? null);
        const amountResult = parseMoneyInput(amountValues[index] ?? null, true);

        if (!budgetEnvelopeId || !amountResult.ok || amountResult.value === null) {
            return {
                ok: false,
                rows: [] as IncomeDistributionRow[],
                totalAmountPhp: 0,
            };
        }

        if (seenEnvelopeIds.has(budgetEnvelopeId)) {
            return {
                ok: false,
                rows: [] as IncomeDistributionRow[],
                totalAmountPhp: 0,
            };
        }

        seenEnvelopeIds.add(budgetEnvelopeId);
        rows.push({
            budgetEnvelopeId,
            amountPhp: amountResult.value,
        });
    }

    return {
        ok: rows.length > 0,
        rows,
        totalAmountPhp: rows.reduce((sum, row) => sum + row.amountPhp, 0),
    };
};
