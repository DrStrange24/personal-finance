import type {
    BudgetEnvelope,
    FinanceTransaction,
    IncomeStream,
    LoanRecord,
    LoanStatus,
    TransactionKind,
    WalletAccount,
    WalletAccountType,
} from "@prisma/client";

export type FinanceActionResult = {
    ok: boolean;
    message: string;
};

export type TransactionFormInput = {
    kind: TransactionKind;
    amountPhp: number;
    walletAccountId: string;
    budgetEnvelopeId?: string | null;
    targetWalletAccountId?: string | null;
    incomeStreamId?: string | null;
    loanRecordId?: string | null;
    postedAt?: Date;
    remarks?: string | null;
};

export type WalletAccountSummary = Pick<
    WalletAccount,
    "id" | "name" | "type" | "currentBalanceAmount"
>;

export type BudgetEnvelopeSummary = Pick<
    BudgetEnvelope,
    "id" | "name" | "monthlyTargetPhp" | "availablePhp" | "isSystem" | "isArchived"
>;

export type IncomeStreamSummary = Pick<
    IncomeStream,
    "id" | "name" | "defaultAmountPhp" | "isActive" | "remarks"
>;

export type LoanRecordSummary = Pick<
    LoanRecord,
    | "id"
    | "direction"
    | "itemName"
    | "counterparty"
    | "principalPhp"
    | "monthlyDuePhp"
    | "paidToDatePhp"
    | "remainingPhp"
    | "status"
    | "remarks"
>;

export type LoanStats = {
    totalActive: number;
    totalRemainingPhp: number;
    totalPaidPhp: number;
};

export type DashboardSummary = {
    totalWalletBalancePhp: number;
    totalCreditCardDebtPhp: number;
    netPositionPhp: number;
    budgetAvailablePhp: number;
    unallocatedCashPhp: number;
    monthIncomePhp: number;
    monthExpensePhp: number;
    monthNetCashflowPhp: number;
};

export type TransactionRow = Pick<
    FinanceTransaction,
    | "id"
    | "postedAt"
    | "kind"
    | "amountPhp"
    | "walletAccountId"
    | "targetWalletAccountId"
    | "budgetEnvelopeId"
    | "incomeStreamId"
    | "loanRecordId"
    | "countsTowardBudget"
    | "remarks"
>;

export const walletAccountTypeLabel: Record<WalletAccountType, string> = {
    CASH: "Cash",
    BANK: "Bank",
    E_WALLET: "E-Wallet",
    ASSET: "Asset",
    CREDIT_CARD: "Credit Card",
};

export const loanStatusLabel: Record<LoanStatus, string> = {
    ACTIVE: "Active",
    PAID: "Paid",
    WRITTEN_OFF: "Written Off",
};

export const transactionKindLabel: Record<TransactionKind, string> = {
    INCOME: "Income",
    EXPENSE: "Expense",
    BUDGET_ALLOCATION: "Budget Allocation",
    TRANSFER: "Transfer",
    CREDIT_CARD_CHARGE: "Credit Card Charge",
    CREDIT_CARD_PAYMENT: "Credit Card Payment",
    LOAN_BORROW: "Loan Borrow",
    LOAN_REPAY: "Loan Repay",
    ADJUSTMENT: "Adjustment",
};

