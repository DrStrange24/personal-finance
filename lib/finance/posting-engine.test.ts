import {
    AdjustmentReasonCode,
    BudgetEnvelopeSystemType,
    LoanStatus,
    Prisma,
    WalletAccountType,
} from "@prisma/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        $transaction: vi.fn(),
    },
}));

vi.mock("@/lib/prisma", () => ({
    prisma: mockPrisma,
}));

let postFinanceTransaction: typeof import("@/lib/finance/posting-engine").postFinanceTransaction;
let deleteFinanceTransactionWithReversal: typeof import("@/lib/finance/posting-engine").deleteFinanceTransactionWithReversal;

type WalletRow = {
    id: string;
    userId: string;
    entityId: string;
    type: WalletAccountType;
    name: string;
    isArchived: boolean;
    currentBalanceAmount: Prisma.Decimal;
};

type EnvelopeRow = {
    id: string;
    userId: string;
    entityId: string;
    name: string;
    isSystem: boolean;
    systemType: BudgetEnvelopeSystemType | null;
    linkedWalletAccountId: string | null;
    linkedCreditAccountId: string | null;
    isArchived: boolean;
    availablePhp: Prisma.Decimal;
    monthlyTargetPhp: Prisma.Decimal;
    rolloverEnabled: boolean;
    sortOrder: number;
    remarks: string | null;
    payTo: string | null;
};

type LoanRow = {
    id: string;
    userId: string;
    entityId: string;
    direction: "YOU_OWE" | "YOU_ARE_OWED";
    itemName: string;
    counterparty: string | null;
    principalPhp: Prisma.Decimal;
    monthlyDuePhp: Prisma.Decimal | null;
    paidToDatePhp: Prisma.Decimal;
    remainingPhp: Prisma.Decimal;
    status: LoanStatus;
    remarks: string | null;
};

type IncomeRow = {
    id: string;
    userId: string;
    entityId: string;
};

type CreditAccountRow = {
    id: string;
    userId: string;
    entityId: string;
    name: string;
    isArchived: boolean;
    creditLimitAmount: Prisma.Decimal;
    currentBalanceAmount: Prisma.Decimal;
};

type FinanceTransactionRow = {
    id: string;
    userId: string;
    actorUserId: string;
    entityId: string;
    postedAt: Date;
    kind: string;
    amountPhp: Prisma.Decimal;
    walletAccountId: string;
    targetWalletAccountId: string | null;
    budgetEnvelopeId: string | null;
    ccPaymentEnvelopeId: string | null;
    incomeStreamId: string | null;
    loanRecordId: string | null;
    adjustmentReasonCode: AdjustmentReasonCode | null;
    isReversal: boolean;
    reversedTransactionId: string | null;
    voidedAt: Date | null;
    voidedByUserId: string | null;
    countsTowardBudget: boolean;
    remarks: string | null;
    createdAt: Date;
    updatedAt: Date;
};

type InMemoryState = {
    walletAccounts: WalletRow[];
    budgetEnvelopes: EnvelopeRow[];
    loans: LoanRow[];
    incomeStreams: IncomeRow[];
    creditAccounts: CreditAccountRow[];
    financeTransactions: FinanceTransactionRow[];
    nextId: number;
};

const toDecimal = (value: number | string | Prisma.Decimal) => new Prisma.Decimal(value);

const baseState = (): InMemoryState => ({
    walletAccounts: [
        {
            id: "cash_1",
            userId: "u1",
            entityId: "e1",
            type: WalletAccountType.CASH,
            name: "Cash Wallet",
            isArchived: false,
            currentBalanceAmount: toDecimal(1000),
        },
        {
            id: "cash_2",
            userId: "u1",
            entityId: "e1",
            type: WalletAccountType.BANK,
            name: "Bank Wallet",
            isArchived: false,
            currentBalanceAmount: toDecimal(500),
        },
        {
            id: "cc_1",
            userId: "u1",
            entityId: "e1",
            type: WalletAccountType.CREDIT_CARD,
            name: "Visa Card",
            isArchived: false,
            currentBalanceAmount: toDecimal(200),
        },
        {
            id: "other_entity_wallet",
            userId: "u1",
            entityId: "e2",
            type: WalletAccountType.CASH,
            name: "Other Entity Wallet",
            isArchived: false,
            currentBalanceAmount: toDecimal(999),
        },
    ],
    budgetEnvelopes: [
        {
            id: "budget_1",
            userId: "u1",
            entityId: "e1",
            name: "General",
            isSystem: false,
            systemType: null,
            linkedWalletAccountId: null,
            linkedCreditAccountId: null,
            isArchived: false,
            availablePhp: toDecimal(600),
            monthlyTargetPhp: toDecimal(1000),
            rolloverEnabled: true,
            sortOrder: 1,
            remarks: null,
            payTo: null,
        },
        {
            id: "ccpay_1",
            userId: "u1",
            entityId: "e1",
            name: "System: CC Payment - Visa Card",
            isSystem: true,
            systemType: BudgetEnvelopeSystemType.CREDIT_CARD_PAYMENT,
            linkedWalletAccountId: "cc_1",
            linkedCreditAccountId: "credit_1",
            isArchived: false,
            availablePhp: toDecimal(200),
            monthlyTargetPhp: toDecimal(0),
            rolloverEnabled: true,
            sortOrder: 9999,
            remarks: "System managed",
            payTo: null,
        },
    ],
    loans: [
        {
            id: "loan_1",
            userId: "u1",
            entityId: "e1",
            direction: "YOU_OWE",
            itemName: "Laptop",
            counterparty: "Store",
            principalPhp: toDecimal(500),
            monthlyDuePhp: toDecimal(50),
            paidToDatePhp: toDecimal(100),
            remainingPhp: toDecimal(400),
            status: LoanStatus.ACTIVE,
            remarks: null,
        },
    ],
    incomeStreams: [
        {
            id: "income_1",
            userId: "u1",
            entityId: "e1",
        },
    ],
    creditAccounts: [
        {
            id: "credit_1",
            userId: "u1",
            entityId: "e1",
            name: "Visa Card",
            isArchived: false,
            creditLimitAmount: toDecimal(1000),
            currentBalanceAmount: toDecimal(200),
        },
        {
            id: "credit_2",
            userId: "u1",
            entityId: "e2",
            name: "Visa Card",
            isArchived: false,
            creditLimitAmount: toDecimal(5000),
            currentBalanceAmount: toDecimal(999),
        },
    ],
    financeTransactions: [],
    nextId: 1,
});

const pickSelect = <T extends Record<string, unknown>>(row: T, select?: Record<string, boolean>) => {
    if (!select) {
        return row;
    }
    const next: Record<string, unknown> = {};
    for (const key of Object.keys(select)) {
        if (select[key]) {
            next[key] = row[key];
        }
    }
    return next;
};

const matchWhere = (row: Record<string, unknown>, where: Record<string, unknown> | undefined) => {
    if (!where) {
        return true;
    }

    for (const [key, value] of Object.entries(where)) {
        if (value === undefined) {
            continue;
        }

        if (value && typeof value === "object" && !Array.isArray(value)) {
            const obj = value as Record<string, unknown>;
            if ("not" in obj) {
                if (row[key] === obj.not) {
                    return false;
                }
                continue;
            }
            if ("in" in obj) {
                if (!Array.isArray(obj.in) || !obj.in.includes(row[key])) {
                    return false;
                }
                continue;
            }
        }

        if (row[key] !== value) {
            return false;
        }
    }

    return true;
};

const makeTxClient = (state: InMemoryState) => ({
    walletAccount: {
        findFirst: async ({ where, select }: { where: Record<string, unknown>; select?: Record<string, boolean> }) => {
            const row = state.walletAccounts.find((wallet) => matchWhere(wallet as unknown as Record<string, unknown>, where));
            return row ? pickSelect(row as unknown as Record<string, unknown>, select) : null;
        },
        update: async ({ where, data, select }: { where: { id: string }; data: Record<string, unknown>; select?: Record<string, boolean> }) => {
            const row = state.walletAccounts.find((wallet) => wallet.id === where.id);
            if (!row) {
                throw new Error("Wallet update target not found.");
            }

            if (data.type) {
                row.type = data.type as WalletAccountType;
            }
            if (data.name) {
                row.name = data.name as string;
            }
            if (data.currentBalanceAmount && typeof data.currentBalanceAmount === "object") {
                const next = data.currentBalanceAmount as Record<string, unknown>;
                if (next.increment !== undefined) {
                    row.currentBalanceAmount = row.currentBalanceAmount.add(toDecimal(next.increment as number));
                }
                if (next.set !== undefined) {
                    row.currentBalanceAmount = toDecimal(next.set as number);
                }
            }

            return pickSelect(row as unknown as Record<string, unknown>, select);
        },
        findUnique: async ({ where }: { where: { id: string } }) => {
            return state.walletAccounts.find((wallet) => wallet.id === where.id) ?? null;
        },
    },
    budgetEnvelope: {
        findFirst: async ({ where, select }: { where: Record<string, unknown>; select?: Record<string, boolean> }) => {
            const row = state.budgetEnvelopes.find((budget) => matchWhere(budget as unknown as Record<string, unknown>, where));
            return row ? pickSelect(row as unknown as Record<string, unknown>, select) : null;
        },
        create: async ({ data }: { data: Record<string, unknown> }) => {
            const row: EnvelopeRow = {
                id: `budget_auto_${state.nextId++}`,
                userId: data.userId as string,
                entityId: data.entityId as string,
                name: data.name as string,
                isSystem: Boolean(data.isSystem),
                systemType: (data.systemType as BudgetEnvelopeSystemType | null) ?? null,
                linkedWalletAccountId: (data.linkedWalletAccountId as string | null) ?? null,
                linkedCreditAccountId: (data.linkedCreditAccountId as string | null) ?? null,
                isArchived: Boolean(data.isArchived),
                availablePhp: toDecimal((data.availablePhp as number | Prisma.Decimal) ?? 0),
                monthlyTargetPhp: toDecimal((data.monthlyTargetPhp as number | Prisma.Decimal) ?? 0),
                rolloverEnabled: Boolean(data.rolloverEnabled),
                sortOrder: Number(data.sortOrder ?? 0),
                remarks: (data.remarks as string | null) ?? null,
                payTo: (data.payTo as string | null) ?? null,
            };
            state.budgetEnvelopes.push(row);
            return row;
        },
        update: async ({ where, data, select }: { where: { id: string }; data: Record<string, unknown>; select?: Record<string, boolean> }) => {
            const row = state.budgetEnvelopes.find((budget) => budget.id === where.id);
            if (!row) {
                throw new Error("Budget update target not found.");
            }

            if (data.availablePhp && typeof data.availablePhp === "object") {
                const next = data.availablePhp as Record<string, unknown>;
                if (next.increment !== undefined) {
                    row.availablePhp = row.availablePhp.add(toDecimal(next.increment as number));
                }
            }
            if (data.name !== undefined) {
                row.name = data.name as string;
            }
            if (data.systemType !== undefined) {
                row.systemType = (data.systemType as BudgetEnvelopeSystemType | null) ?? null;
            }
            if (data.linkedWalletAccountId !== undefined) {
                row.linkedWalletAccountId = (data.linkedWalletAccountId as string | null) ?? null;
            }
            if (data.linkedCreditAccountId !== undefined) {
                row.linkedCreditAccountId = (data.linkedCreditAccountId as string | null) ?? null;
            }

            return pickSelect(row as unknown as Record<string, unknown>, select);
        },
    },
    loanRecord: {
        findFirst: async ({ where }: { where: Record<string, unknown> }) => {
            return state.loans.find((loan) => matchWhere(loan as unknown as Record<string, unknown>, where)) ?? null;
        },
        update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
            const row = state.loans.find((loan) => loan.id === where.id);
            if (!row) {
                throw new Error("Loan update target not found.");
            }

            if (data.remainingPhp !== undefined) {
                row.remainingPhp = toDecimal(data.remainingPhp as number | Prisma.Decimal);
            }
            if (data.paidToDatePhp !== undefined) {
                row.paidToDatePhp = toDecimal(data.paidToDatePhp as number | Prisma.Decimal);
            }
            if (data.principalPhp !== undefined) {
                row.principalPhp = toDecimal(data.principalPhp as number | Prisma.Decimal);
            }
            if (data.status !== undefined) {
                row.status = data.status as LoanStatus;
            }

            return row;
        },
    },
    incomeStream: {
        findFirst: async ({ where }: { where: Record<string, unknown> }) => {
            return state.incomeStreams.find((stream) => matchWhere(stream as unknown as Record<string, unknown>, where)) ?? null;
        },
    },
    creditAccount: {
        findFirst: async ({ where, select }: { where: Record<string, unknown>; select?: Record<string, boolean> }) => {
            const row = state.creditAccounts.find((account) => matchWhere(account as unknown as Record<string, unknown>, where));
            return row ? pickSelect(row as unknown as Record<string, unknown>, select) : null;
        },
        updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
            let count = 0;
            for (const account of state.creditAccounts) {
                if (!matchWhere(account as unknown as Record<string, unknown>, where)) {
                    continue;
                }
                if (data.currentBalanceAmount !== undefined) {
                    account.currentBalanceAmount = toDecimal(data.currentBalanceAmount as number | Prisma.Decimal);
                }
                count += 1;
            }
            return { count };
        },
    },
    financeTransaction: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
            const row: FinanceTransactionRow = {
                id: `tx_${state.nextId++}`,
                userId: data.userId as string,
                actorUserId: data.actorUserId as string,
                entityId: data.entityId as string,
                postedAt: (data.postedAt as Date) ?? new Date(),
                kind: data.kind as string,
                amountPhp: toDecimal(data.amountPhp as number | Prisma.Decimal),
                walletAccountId: data.walletAccountId as string,
                targetWalletAccountId: (data.targetWalletAccountId as string | null) ?? null,
                budgetEnvelopeId: (data.budgetEnvelopeId as string | null) ?? null,
                ccPaymentEnvelopeId: (data.ccPaymentEnvelopeId as string | null) ?? null,
                incomeStreamId: (data.incomeStreamId as string | null) ?? null,
                loanRecordId: (data.loanRecordId as string | null) ?? null,
                adjustmentReasonCode: (data.adjustmentReasonCode as AdjustmentReasonCode | null) ?? null,
                isReversal: Boolean(data.isReversal),
                reversedTransactionId: (data.reversedTransactionId as string | null) ?? null,
                voidedAt: (data.voidedAt as Date | null) ?? null,
                voidedByUserId: (data.voidedByUserId as string | null) ?? null,
                countsTowardBudget: Boolean(data.countsTowardBudget),
                remarks: (data.remarks as string | null) ?? null,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            state.financeTransactions.push(row);
            return row;
        },
        findFirst: async ({ where, include }: { where: Record<string, unknown>; include?: Record<string, unknown> }) => {
            const row = state.financeTransactions.find((tx) => matchWhere(tx as unknown as Record<string, unknown>, where));
            if (!row) {
                return null;
            }

            if (include && include.reversalTransaction) {
                const reversal = state.financeTransactions.find((tx) => tx.reversedTransactionId === row.id && tx.isReversal);
                return {
                    ...row,
                    reversalTransaction: reversal ? { id: reversal.id } : null,
                };
            }

            return row;
        },
        update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
            const row = state.financeTransactions.find((tx) => tx.id === where.id);
            if (!row) {
                throw new Error("Transaction update target not found.");
            }

            if (data.voidedAt !== undefined) {
                row.voidedAt = data.voidedAt as Date | null;
            }
            if (data.voidedByUserId !== undefined) {
                row.voidedByUserId = data.voidedByUserId as string | null;
            }
            row.updatedAt = new Date();
            return row;
        },
    },
});

const walletBalance = (state: InMemoryState, walletId: string) =>
    Number(state.walletAccounts.find((wallet) => wallet.id === walletId)?.currentBalanceAmount ?? 0);

const envelopeAvailable = (state: InMemoryState, envelopeId: string) =>
    Number(state.budgetEnvelopes.find((envelope) => envelope.id === envelopeId)?.availablePhp ?? 0);

const loanRemaining = (state: InMemoryState, loanId: string) =>
    Number(state.loans.find((loan) => loan.id === loanId)?.remainingPhp ?? 0);

const loanPaid = (state: InMemoryState, loanId: string) =>
    Number(state.loans.find((loan) => loan.id === loanId)?.paidToDatePhp ?? 0);

const captureCoreState = (state: InMemoryState) => ({
    cash1: walletBalance(state, "cash_1"),
    cash2: walletBalance(state, "cash_2"),
    creditWallet: walletBalance(state, "cc_1"),
    budget: envelopeAvailable(state, "budget_1"),
    ccReserve: envelopeAvailable(state, "ccpay_1"),
    loanRemaining: loanRemaining(state, "loan_1"),
    loanPaid: loanPaid(state, "loan_1"),
    creditUsed: Number(state.creditAccounts.find((account) => account.id === "credit_1")?.currentBalanceAmount ?? 0),
});

describe("posting-engine", () => {
    let state: InMemoryState;

    beforeAll(async () => {
        const postingEngine = await import("@/lib/finance/posting-engine");
        postFinanceTransaction = postingEngine.postFinanceTransaction;
        deleteFinanceTransactionWithReversal = postingEngine.deleteFinanceTransactionWithReversal;
    });

    beforeEach(() => {
        state = baseState();
        mockPrisma.$transaction.mockImplementation(async (callback: unknown) => {
            if (typeof callback === "function") {
                const txClient = makeTxClient(state);
                return callback(txClient as never);
            }
            throw new Error("Unsupported transaction call in tests.");
        });
    });

    afterEach(() => {
        mockPrisma.$transaction.mockReset();
    });

    it("posts INCOME and applies wallet + envelope effects", async () => {
        await postFinanceTransaction({
            userId: "u1",
            entityId: "e1",
            actorUserId: "u1",
            kind: "INCOME",
            amountPhp: 100,
            walletAccountId: "cash_1",
            budgetEnvelopeId: "budget_1",
            remarks: "Salary",
        });

        expect(walletBalance(state, "cash_1")).toBe(1100);
        expect(envelopeAvailable(state, "budget_1")).toBe(700);
    });

    it("posts EXPENSE with validation guardrails", async () => {
        await postFinanceTransaction({
            userId: "u1",
            entityId: "e1",
            actorUserId: "u1",
            kind: "EXPENSE",
            amountPhp: 150,
            walletAccountId: "cash_1",
            budgetEnvelopeId: "budget_1",
            remarks: "Groceries",
        });

        expect(walletBalance(state, "cash_1")).toBe(850);
        expect(envelopeAvailable(state, "budget_1")).toBe(450);
    });

    it("posts BUDGET_ALLOCATION", async () => {
        await postFinanceTransaction({
            userId: "u1",
            entityId: "e1",
            actorUserId: "u1",
            kind: "BUDGET_ALLOCATION",
            amountPhp: 200,
            walletAccountId: "cash_1",
            budgetEnvelopeId: "budget_1",
            remarks: "Top-up",
        });

        expect(walletBalance(state, "cash_1")).toBe(800);
        expect(envelopeAvailable(state, "budget_1")).toBe(800);
    });

    it("posts TRANSFER", async () => {
        await postFinanceTransaction({
            userId: "u1",
            entityId: "e1",
            actorUserId: "u1",
            kind: "TRANSFER",
            amountPhp: 120,
            walletAccountId: "cash_1",
            targetWalletAccountId: "cash_2",
            remarks: "Rebalance",
        });

        expect(walletBalance(state, "cash_1")).toBe(880);
        expect(walletBalance(state, "cash_2")).toBe(620);
    });

    it("blocks CREDIT_CARD_CHARGE above limit", async () => {
        state.budgetEnvelopes[0].availablePhp = toDecimal(5000);

        await expect(postFinanceTransaction({
            userId: "u1",
            entityId: "e1",
            actorUserId: "u1",
            kind: "CREDIT_CARD_CHARGE",
            amountPhp: 900,
            walletAccountId: "cc_1",
            budgetEnvelopeId: "budget_1",
            remarks: "Big charge",
        })).rejects.toThrow("Credit card charge exceeds credit limit.");
    });

    it("auto-creates per-card payment reserve envelope on credit card charge", async () => {
        state.budgetEnvelopes = state.budgetEnvelopes.filter((envelope) => envelope.id !== "ccpay_1");

        await postFinanceTransaction({
            userId: "u1",
            entityId: "e1",
            actorUserId: "u1",
            kind: "CREDIT_CARD_CHARGE",
            amountPhp: 40,
            walletAccountId: "cc_1",
            budgetEnvelopeId: "budget_1",
            remarks: "Charge with auto reserve",
        });

        const createdReserve = state.budgetEnvelopes.find((envelope) => envelope.linkedWalletAccountId === "cc_1");
        expect(createdReserve).toBeDefined();
        expect(createdReserve?.systemType).toBe(BudgetEnvelopeSystemType.CREDIT_CARD_PAYMENT);
        expect(createdReserve?.name).toBe("System: CC Payment - Visa Card");
        expect(Number(createdReserve?.availablePhp ?? 0)).toBe(40);
    });

    it("posts CREDIT_CARD_PAYMENT and blocks overpay", async () => {
        await postFinanceTransaction({
            userId: "u1",
            entityId: "e1",
            actorUserId: "u1",
            kind: "CREDIT_CARD_PAYMENT",
            amountPhp: 100,
            walletAccountId: "cash_1",
            targetWalletAccountId: "cc_1",
            remarks: "Card payment",
        });

        expect(walletBalance(state, "cash_1")).toBe(900);
        expect(walletBalance(state, "cc_1")).toBe(100);
        expect(envelopeAvailable(state, "ccpay_1")).toBe(100);

        await expect(postFinanceTransaction({
            userId: "u1",
            entityId: "e1",
            actorUserId: "u1",
            kind: "CREDIT_CARD_PAYMENT",
            amountPhp: 500,
            walletAccountId: "cash_1",
            targetWalletAccountId: "cc_1",
            remarks: "Overpay",
        })).rejects.toThrow("Credit card payment cannot exceed outstanding debt.");
    });

    it("blocks CREDIT_CARD_PAYMENT when reserve is insufficient", async () => {
        state.budgetEnvelopes.find((envelope) => envelope.id === "ccpay_1")!.availablePhp = toDecimal(20);

        await expect(postFinanceTransaction({
            userId: "u1",
            entityId: "e1",
            actorUserId: "u1",
            kind: "CREDIT_CARD_PAYMENT",
            amountPhp: 50,
            walletAccountId: "cash_1",
            targetWalletAccountId: "cc_1",
            remarks: "Insufficient reserve",
        })).rejects.toThrow("Insufficient reserved cash in credit card payment envelope.");
    });

    it("keeps same-name credit account in other entity unchanged", async () => {
        await postFinanceTransaction({
            userId: "u1",
            entityId: "e1",
            actorUserId: "u1",
            kind: "CREDIT_CARD_CHARGE",
            amountPhp: 50,
            walletAccountId: "cc_1",
            budgetEnvelopeId: "budget_1",
            remarks: "Scoped charge",
        });

        expect(walletBalance(state, "cc_1")).toBe(250);
        expect(envelopeAvailable(state, "budget_1")).toBe(550);
        expect(Number(state.creditAccounts.find((account) => account.id === "credit_1")?.currentBalanceAmount ?? 0)).toBe(250);
        expect(Number(state.creditAccounts.find((account) => account.id === "credit_2")?.currentBalanceAmount ?? 0)).toBe(999);
        expect(envelopeAvailable(state, "ccpay_1")).toBe(250);
    });

    it("posts LOAN_BORROW and LOAN_REPAY with overpay guard", async () => {
        await postFinanceTransaction({
            userId: "u1",
            entityId: "e1",
            actorUserId: "u1",
            kind: "LOAN_BORROW",
            amountPhp: 100,
            walletAccountId: "cash_1",
            loanRecordId: "loan_1",
            remarks: "Borrow",
        });

        expect(walletBalance(state, "cash_1")).toBe(1100);
        expect(loanRemaining(state, "loan_1")).toBe(500);

        await postFinanceTransaction({
            userId: "u1",
            entityId: "e1",
            actorUserId: "u1",
            kind: "LOAN_REPAY",
            amountPhp: 50,
            walletAccountId: "cash_1",
            loanRecordId: "loan_1",
            remarks: "Repay",
        });

        expect(walletBalance(state, "cash_1")).toBe(1050);
        expect(loanRemaining(state, "loan_1")).toBe(450);
        expect(loanPaid(state, "loan_1")).toBe(150);

        await expect(postFinanceTransaction({
            userId: "u1",
            entityId: "e1",
            actorUserId: "u1",
            kind: "LOAN_REPAY",
            amountPhp: 1000,
            walletAccountId: "cash_1",
            loanRecordId: "loan_1",
            remarks: "Overpay",
        })).rejects.toThrow("Loan repayment cannot exceed remaining principal.");
    });

    it("requires reason code for ADJUSTMENT", async () => {
        await expect(postFinanceTransaction({
            userId: "u1",
            entityId: "e1",
            actorUserId: "u1",
            kind: "ADJUSTMENT",
            amountPhp: 10,
            walletAccountId: "cash_1",
            remarks: "Manual",
        })).rejects.toThrow("Adjustment reason code is required.");

        await postFinanceTransaction({
            userId: "u1",
            entityId: "e1",
            actorUserId: "u1",
            kind: "ADJUSTMENT",
            amountPhp: -20,
            walletAccountId: "cash_1",
            adjustmentReasonCode: AdjustmentReasonCode.BALANCE_CORRECTION,
            remarks: "Balance correction",
        });

        expect(walletBalance(state, "cash_1")).toBe(980);
    });

    it("rejects cross-entity references", async () => {
        await expect(postFinanceTransaction({
            userId: "u1",
            entityId: "e1",
            actorUserId: "u1",
            kind: "INCOME",
            amountPhp: 20,
            walletAccountId: "other_entity_wallet",
            budgetEnvelopeId: "budget_1",
            remarks: "Invalid",
        })).rejects.toThrow("Wallet account not found.");
    });

    it("deletes through reversal linkage and marks original voided", async () => {
        const created = await postFinanceTransaction({
            userId: "u1",
            entityId: "e1",
            actorUserId: "u1",
            kind: "EXPENSE",
            amountPhp: 80,
            walletAccountId: "cash_1",
            budgetEnvelopeId: "budget_1",
            remarks: "To reverse",
        });

        const originalWallet = walletBalance(state, "cash_1");
        const originalEnvelope = envelopeAvailable(state, "budget_1");

        await deleteFinanceTransactionWithReversal("u1", "e1", "u1", created.id);

        expect(walletBalance(state, "cash_1")).toBe(originalWallet + 80);
        expect(envelopeAvailable(state, "budget_1")).toBe(originalEnvelope + 80);

        const original = state.financeTransactions.find((tx) => tx.id === created.id);
        const reversal = state.financeTransactions.find((tx) => tx.reversedTransactionId === created.id);
        expect(original?.voidedAt).not.toBeNull();
        expect(original?.voidedByUserId).toBe("u1");
        expect(reversal?.isReversal).toBe(true);
    });

    it.each([
        {
            label: "INCOME",
            input: {
                kind: "INCOME" as const,
                amountPhp: 75,
                walletAccountId: "cash_1",
                budgetEnvelopeId: "budget_1",
                remarks: "Income roundtrip",
            },
        },
        {
            label: "EXPENSE",
            input: {
                kind: "EXPENSE" as const,
                amountPhp: 75,
                walletAccountId: "cash_1",
                budgetEnvelopeId: "budget_1",
                remarks: "Expense roundtrip",
            },
        },
        {
            label: "BUDGET_ALLOCATION",
            input: {
                kind: "BUDGET_ALLOCATION" as const,
                amountPhp: 50,
                walletAccountId: "cash_1",
                budgetEnvelopeId: "budget_1",
                remarks: "Budget roundtrip",
            },
        },
        {
            label: "TRANSFER",
            input: {
                kind: "TRANSFER" as const,
                amountPhp: 40,
                walletAccountId: "cash_1",
                targetWalletAccountId: "cash_2",
                remarks: "Transfer roundtrip",
            },
        },
        {
            label: "CREDIT_CARD_CHARGE",
            input: {
                kind: "CREDIT_CARD_CHARGE" as const,
                amountPhp: 40,
                walletAccountId: "cc_1",
                budgetEnvelopeId: "budget_1",
                remarks: "Charge roundtrip",
            },
        },
        {
            label: "CREDIT_CARD_PAYMENT",
            input: {
                kind: "CREDIT_CARD_PAYMENT" as const,
                amountPhp: 30,
                walletAccountId: "cash_1",
                targetWalletAccountId: "cc_1",
                remarks: "Payment roundtrip",
            },
        },
        {
            label: "LOAN_BORROW",
            input: {
                kind: "LOAN_BORROW" as const,
                amountPhp: 30,
                walletAccountId: "cash_1",
                loanRecordId: "loan_1",
                remarks: "Borrow roundtrip",
            },
        },
        {
            label: "LOAN_REPAY",
            input: {
                kind: "LOAN_REPAY" as const,
                amountPhp: 30,
                walletAccountId: "cash_1",
                loanRecordId: "loan_1",
                remarks: "Repay roundtrip",
            },
        },
        {
            label: "ADJUSTMENT",
            input: {
                kind: "ADJUSTMENT" as const,
                amountPhp: -30,
                walletAccountId: "cash_1",
                adjustmentReasonCode: AdjustmentReasonCode.BALANCE_CORRECTION,
                remarks: "Adjustment roundtrip",
            },
        },
    ])("round-trips $label through reversal with no net state change", async ({ input }) => {
        const before = captureCoreState(state);
        const created = await postFinanceTransaction({
            userId: "u1",
            entityId: "e1",
            actorUserId: "u1",
            ...input,
        });

        await deleteFinanceTransactionWithReversal("u1", "e1", "u1", created.id);

        expect(captureCoreState(state)).toEqual(before);
    });

    it("keeps ledger deterministic in golden reconciliation flow", async () => {
        const income = await postFinanceTransaction({
            userId: "u1",
            entityId: "e1",
            actorUserId: "u1",
            kind: "INCOME",
            amountPhp: 200,
            walletAccountId: "cash_1",
            budgetEnvelopeId: "budget_1",
            remarks: "Income",
        });

        await postFinanceTransaction({
            userId: "u1",
            entityId: "e1",
            actorUserId: "u1",
            kind: "EXPENSE",
            amountPhp: 50,
            walletAccountId: "cash_1",
            budgetEnvelopeId: "budget_1",
            remarks: "Expense",
        });

        await deleteFinanceTransactionWithReversal("u1", "e1", "u1", income.id);

        expect(walletBalance(state, "cash_1")).toBe(950);
        expect(envelopeAvailable(state, "budget_1")).toBe(550);

        const activeRows = state.financeTransactions.filter((tx) => !tx.isReversal && tx.voidedAt === null);
        expect(activeRows).toHaveLength(1);
        expect(activeRows[0]?.kind).toBe("EXPENSE");
    });
});
