"use client";

import { useMemo, useState } from "react";
import { TransactionKind, WalletAccountType } from "@prisma/client";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import ActionIconButton from "@/app/components/action-icon-button";
import { useAppToast } from "@/app/components/toast-provider";
import { transactionKindLabel } from "@/lib/finance/types";

type FormOption = {
    id: string;
    plainLabel?: string;
    label: string;
    type?: WalletAccountType;
};

type BudgetOption = {
    id: string;
    plainLabel?: string;
    label: string;
    targetLabel?: string;
    targetAmountPhp?: number;
};

type AddTransactionModalProps = {
    wallets: FormOption[];
    creditAccounts?: FormOption[];
    budgets: BudgetOption[];
    incomeStreams: FormOption[];
    loanRecords: FormOption[];
    postTransactionAction: (formData: FormData) => Promise<{ ok: boolean; message: string }>;
};

const allKinds: TransactionKind[] = [
    "INCOME",
    "EXPENSE",
    "BUDGET_ALLOCATION",
    "TRANSFER",
    "CREDIT_CARD_CHARGE",
    "CREDIT_CARD_PAYMENT",
    "LOAN_BORROW",
    "LOAN_REPAY",
];

const kindsRequiringBudget = new Set<TransactionKind>([
    "EXPENSE",
    "BUDGET_ALLOCATION",
    "CREDIT_CARD_CHARGE",
]);

const kindsRequiringTargetWallet = new Set<TransactionKind>([
    "TRANSFER",
    "CREDIT_CARD_PAYMENT",
]);

const kindsSupportingIncomeStream = new Set<TransactionKind>(["INCOME"]);
const kindsSupportingLoan = new Set<TransactionKind>(["LOAN_BORROW", "LOAN_REPAY"]);

const todayIso = () => new Date().toISOString().slice(0, 10);
const getEmptyDistributionRow = () => ({ budgetEnvelopeId: "", amountPhp: "" });
const getDistributionRowsFromBudgets = (budgets: BudgetOption[]) => budgets.map((budget) => ({
    budgetEnvelopeId: budget.id,
    amountPhp: Number.isFinite(budget.targetAmountPhp) && (budget.targetAmountPhp ?? 0) > 0
        ? Number(budget.targetAmountPhp).toFixed(2)
        : "",
}));

export default function AddTransactionModal({
    wallets,
    creditAccounts = [],
    budgets,
    incomeStreams,
    loanRecords,
    postTransactionAction,
}: AddTransactionModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [kind, setKind] = useState<TransactionKind>("EXPENSE");
    const [expenseFunding, setExpenseFunding] = useState<"wallet" | "credit">("wallet");
    const [incomeDistributionRows, setIncomeDistributionRows] = useState([getEmptyDistributionRow()]);
    const [selectAllBudgets, setSelectAllBudgets] = useState(false);
    const [recordOnly, setRecordOnly] = useState(false);
    const [postedAt, setPostedAt] = useState(todayIso());
    const [amountPhp, setAmountPhp] = useState("");
    const [walletAccountId, setWalletAccountId] = useState("");
    const [targetWalletAccountId, setTargetWalletAccountId] = useState("");
    const [budgetEnvelopeId, setBudgetEnvelopeId] = useState("");
    const [incomeStreamId, setIncomeStreamId] = useState("");
    const [loanRecordId, setLoanRecordId] = useState("");
    const [remarks, setRemarks] = useState("");
    const { showSuccess, showError } = useAppToast();

    const requiresBudget = !recordOnly && kindsRequiringBudget.has(kind);
    const requiresTargetWallet = !recordOnly && kindsRequiringTargetWallet.has(kind);
    const supportsIncomeStream = kindsSupportingIncomeStream.has(kind);
    const supportsLoan = !recordOnly && kindsSupportingLoan.has(kind);
    const isIncome = !recordOnly && kind === "INCOME";
    const isExpense = !recordOnly && kind === "EXPENSE";
    const hidesWalletSelector = kind === "BUDGET_ALLOCATION";
    const showBudgetSelector = requiresBudget || recordOnly;

    const visibleKinds = useMemo(() => allKinds, []);
    const sourceWallets = useMemo(() => {
        if (kind === "CREDIT_CARD_CHARGE") {
            const creditWallets = wallets.filter((wallet) => wallet.type === "CREDIT_CARD");
            return creditWallets.length > 0 ? creditWallets : creditAccounts;
        }
        if (kind === "BUDGET_ALLOCATION") {
            return wallets.filter((wallet) => wallet.type !== "CREDIT_CARD" && wallet.type !== "ASSET");
        }
        if (kind === "CREDIT_CARD_PAYMENT") {
            return wallets.filter((wallet) => wallet.type !== "CREDIT_CARD");
        }
        if (!isExpense) {
            return wallets;
        }
        if (expenseFunding === "credit") {
            const creditWallets = wallets.filter((wallet) => wallet.type === "CREDIT_CARD");
            return creditWallets.length > 0 ? creditWallets : creditAccounts;
        }
        return wallets.filter((wallet) => wallet.type !== "CREDIT_CARD");
    }, [creditAccounts, expenseFunding, isExpense, kind, wallets]);
    const targetWalletOptions = useMemo(() => {
        if (kind === "CREDIT_CARD_PAYMENT") {
            return wallets.filter((wallet) => wallet.type === "CREDIT_CARD");
        }
        return wallets;
    }, [kind, wallets]);
    const walletFieldLabel = useMemo(() => {
        if (kind === "CREDIT_CARD_PAYMENT") {
            return "Cash Wallet";
        }
        if (kind === "CREDIT_CARD_CHARGE" || (isExpense && expenseFunding === "credit")) {
            return "Credit Account";
        }
        return "Wallet";
    }, [expenseFunding, isExpense, kind]);
    const budgetTargetById = useMemo(
        () => new Map(budgets.map((budget) => [budget.id, budget.targetAmountPhp ?? null])),
        [budgets],
    );

    const submitTransaction = async (formData: FormData) => {
        const submitMode = typeof formData.get("submitMode") === "string"
            ? String(formData.get("submitMode"))
            : "post";

        if (!recordOnly && kind === "EXPENSE" && expenseFunding === "credit") {
            formData.set("kind", "CREDIT_CARD_CHARGE");
        }

        if (recordOnly) {
            formData.set("targetWalletAccountId", "");
            formData.set("loanRecordId", "");
            formData.delete("distributedBudgetEnvelopeId");
            formData.delete("distributedAmountPhp");
        }

        if (kind === "INCOME" && !recordOnly) {
            formData.set("budgetEnvelopeId", "");

            const normalizedRows = incomeDistributionRows
                .map((row) => ({
                    budgetEnvelopeId: row.budgetEnvelopeId.trim(),
                    amountPhp: Number(row.amountPhp),
                }))
                .filter((row) => row.budgetEnvelopeId.length > 0 || Number.isFinite(row.amountPhp));

            if (normalizedRows.length === 0) {
                showError("Post Failed", "Add at least one budget distribution row for income.");
                return;
            }

            const hasInvalidRow = normalizedRows.some((row) => row.budgetEnvelopeId.length === 0 || !Number.isFinite(row.amountPhp) || row.amountPhp <= 0);
            if (hasInvalidRow) {
                showError("Post Failed", "Each income distribution row needs a budget envelope and amount greater than 0.");
                return;
            }

            const uniqueEnvelopeCount = new Set(normalizedRows.map((row) => row.budgetEnvelopeId)).size;
            if (uniqueEnvelopeCount !== normalizedRows.length) {
                showError("Post Failed", "Use each budget envelope only once in income distribution.");
                return;
            }

            const totalIncomeAmount = Number(formData.get("amountPhp"));
            if (!Number.isFinite(totalIncomeAmount) || totalIncomeAmount <= 0) {
                showError("Post Failed", "Income amount must be greater than 0.");
                return;
            }

            const distributedTotal = normalizedRows.reduce((sum, row) => sum + row.amountPhp, 0);
            if (Math.abs(distributedTotal - totalIncomeAmount) > 0.009) {
                showError("Post Failed", "Distributed total must match the income amount.");
                return;
            }

            formData.delete("distributedBudgetEnvelopeId");
            formData.delete("distributedAmountPhp");
            for (const row of normalizedRows) {
                formData.append("distributedBudgetEnvelopeId", row.budgetEnvelopeId);
                formData.append("distributedAmountPhp", row.amountPhp.toFixed(2));
            }
        }

        try {
            const result = await postTransactionAction(formData);
            if (result.ok) {
                showSuccess("Transaction Posted", result.message);
                if (submitMode === "post-and-add-another") {
                    setAmountPhp("");
                    return;
                }
                setIsOpen(false);
            } else {
                showError("Post Failed", result.message);
            }
        } catch {
            showError("Post Failed", "Could not post transaction.");
        }
    };

    return (
        <>
            <ActionIconButton action="add" label="Add ledger entry" onClick={() => setIsOpen(true)} />

            <Modal show={isOpen} onHide={() => setIsOpen(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Add Ledger Entry</Modal.Title>
                </Modal.Header>
                <form action={submitTransaction}>
                    <Modal.Body className="d-grid gap-3">
                        <div className="d-grid gap-1">
                            <label htmlFor="tx-kind" className="small fw-semibold">Kind</label>
                            <select
                                id="tx-kind"
                                name="kind"
                                className="form-control"
                                value={kind}
                                onChange={(event) => {
                                    const nextKind = event.target.value as TransactionKind;
                                    setKind(nextKind);
                                    if (nextKind !== "EXPENSE") {
                                        setExpenseFunding("wallet");
                                    }
                                    if (nextKind !== "INCOME") {
                                        setIncomeDistributionRows([getEmptyDistributionRow()]);
                                        setSelectAllBudgets(false);
                                    }
                                }}
                            >
                                {visibleKinds.map((value) => (
                                    <option key={value} value={value}>
                                        {transactionKindLabel[value]}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="d-grid gap-1">
                            <label htmlFor="tx-posted-at" className="small fw-semibold">Date</label>
                            <input
                                id="tx-posted-at"
                                type="date"
                                name="postedAt"
                                className="form-control"
                                value={postedAt}
                                onChange={(event) => setPostedAt(event.target.value)}
                                required
                            />
                        </div>

                        <div className="d-grid gap-1">
                            <label htmlFor="tx-amount" className="small fw-semibold">Amount (PHP)</label>
                            <input
                                id="tx-amount"
                                type="number"
                                name="amountPhp"
                                className="form-control"
                                min="0.01"
                                step="0.01"
                                value={amountPhp}
                                onChange={(event) => setAmountPhp(event.target.value)}
                                required
                            />
                        </div>

                        <div className="form-check">
                            <input
                                id="tx-record-only"
                                type="checkbox"
                                name="recordOnly"
                                className="form-check-input"
                                checked={recordOnly}
                                onChange={(event) => {
                                    const shouldRecordOnly = event.target.checked;
                                    setRecordOnly(shouldRecordOnly);
                                    if (shouldRecordOnly) {
                                        setIncomeDistributionRows([getEmptyDistributionRow()]);
                                        setSelectAllBudgets(false);
                                    }
                                }}
                            />
                            <label htmlFor="tx-record-only" className="form-check-label small">
                                Record only (do not update wallet or budget balances)
                            </label>
                        </div>

                        {isExpense && (
                            <div className="d-grid gap-1">
                                <label htmlFor="tx-expense-funding" className="small fw-semibold">Pay Using</label>
                                <select
                                    id="tx-expense-funding"
                                    className="form-control"
                                    value={expenseFunding}
                                    onChange={(event) => setExpenseFunding(event.target.value as "wallet" | "credit")}
                                >
                                    <option value="wallet">Wallet</option>
                                    <option value="credit">Credit</option>
                                </select>
                            </div>
                        )}

                        {hidesWalletSelector ? (
                            <input type="hidden" name="walletAccountId" value="" />
                        ) : (
                            <div className="d-grid gap-1">
                                <label htmlFor="tx-wallet" className="small fw-semibold">{walletFieldLabel}</label>
                                <select
                                    id="tx-wallet"
                                    name="walletAccountId"
                                    className="form-control"
                                    value={walletAccountId}
                                    onChange={(event) => setWalletAccountId(event.target.value)}
                                    required
                                >
                                    <option value="">
                                        {walletFieldLabel === "Credit Account" ? "Select credit account" : "Select wallet"}
                                    </option>
                                    {sourceWallets.map((wallet) => (
                                        <option key={wallet.id} value={wallet.id}>
                                            {recordOnly ? (wallet.plainLabel ?? wallet.label) : wallet.label}
                                        </option>
                                    ))}
                                </select>
                                {(walletFieldLabel === "Credit Account") && sourceWallets.length === 0 && (
                                    <small style={{ color: "var(--color-text-muted)" }}>
                                        No credit account found. Add one in Credit or add a Credit Card wallet.
                                    </small>
                                )}
                            </div>
                        )}

                        {requiresTargetWallet ? (
                            <div className="d-grid gap-1">
                                <label htmlFor="tx-target-wallet" className="small fw-semibold">
                                    {kind === "CREDIT_CARD_PAYMENT" ? "Credit Card Wallet" : "Target Wallet"}
                                </label>
                                <select
                                    id="tx-target-wallet"
                                    name="targetWalletAccountId"
                                    className="form-control"
                                    value={targetWalletAccountId}
                                    onChange={(event) => setTargetWalletAccountId(event.target.value)}
                                    required
                                >
                                    <option value="">Select target wallet</option>
                                    {targetWalletOptions.map((wallet) => (
                                        <option key={wallet.id} value={wallet.id}>
                                            {wallet.label}
                                        </option>
                                    ))}
                                </select>
                                {kind === "CREDIT_CARD_PAYMENT" && targetWalletOptions.length === 0 && (
                                    <small style={{ color: "var(--color-text-muted)" }}>
                                        No credit card wallet found for this entity.
                                    </small>
                                )}
                            </div>
                        ) : (
                            <input type="hidden" name="targetWalletAccountId" value="" />
                        )}

                        {showBudgetSelector ? (
                            <div className="d-grid gap-1">
                                <label htmlFor="tx-budget" className="small fw-semibold">
                                    {recordOnly ? "Budget Envelope (Optional)" : "Budget Envelope"}
                                </label>
                                <select
                                    id="tx-budget"
                                    name="budgetEnvelopeId"
                                    className="form-control"
                                    value={budgetEnvelopeId}
                                    onChange={(event) => setBudgetEnvelopeId(event.target.value)}
                                    required={requiresBudget}
                                >
                                    <option value="">{recordOnly ? "Optional" : "Select budget envelope"}</option>
                                    {budgets.map((budget) => (
                                        <option key={budget.id} value={budget.id}>
                                            {recordOnly ? (budget.plainLabel ?? budget.label) : budget.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ) : (
                            <input type="hidden" name="budgetEnvelopeId" value="" />
                        )}

                        {isIncome && (
                            <div className="d-grid gap-2">
                                <div className="d-flex align-items-center justify-content-between">
                                    <label className="small fw-semibold m-0">Budget Distribution</label>
                                    <div className="d-flex align-items-center gap-2">
                                        <div className="form-check m-0">
                                            <input
                                                id="income-dist-select-all"
                                                type="checkbox"
                                                className="form-check-input"
                                                checked={selectAllBudgets}
                                                disabled={budgets.length === 0}
                                                onChange={(event) => {
                                                    const shouldSelectAll = event.target.checked;
                                                    setSelectAllBudgets(shouldSelectAll);
                                                    setIncomeDistributionRows(shouldSelectAll ? getDistributionRowsFromBudgets(budgets) : [getEmptyDistributionRow()]);
                                                }}
                                            />
                                            <label htmlFor="income-dist-select-all" className="form-check-label small">
                                                Select all budgets
                                            </label>
                                        </div>
                                        <ActionIconButton
                                            action="add"
                                            label="Add budget distribution row"
                                            onClick={() => {
                                                setSelectAllBudgets(false);
                                                setIncomeDistributionRows((rows) => [...rows, getEmptyDistributionRow()]);
                                            }}
                                        />
                                    </div>
                                </div>
                                {incomeDistributionRows.map((row, index) => (
                                    <div key={`income-dist-${index}`} className="d-grid gap-2" style={{ gridTemplateColumns: "1fr 170px auto" }}>
                                        <select
                                            className="form-control"
                                            value={row.budgetEnvelopeId}
                                            onChange={(event) => {
                                                const nextBudgetId = event.target.value;
                                                const nextTargetAmount = nextBudgetId ? budgetTargetById.get(nextBudgetId) ?? null : null;
                                                setIncomeDistributionRows((rows) => rows.map((entry, entryIndex) => (
                                                    entryIndex === index
                                                        ? {
                                                            ...entry,
                                                            budgetEnvelopeId: nextBudgetId,
                                                            amountPhp: nextTargetAmount && nextTargetAmount > 0 ? nextTargetAmount.toFixed(2) : "",
                                                        }
                                                        : entry
                                                )));
                                                setSelectAllBudgets(false);
                                            }}
                                        >
                                            <option value="">Select budget envelope</option>
                                            {budgets.map((budget) => (
                                                <option key={budget.id} value={budget.id}>
                                                    {budget.targetLabel ?? budget.label}
                                                </option>
                                            ))}
                                        </select>
                                        <input
                                            type="number"
                                            className="form-control"
                                            min="0.01"
                                            step="0.01"
                                            placeholder="Amount"
                                            value={row.amountPhp}
                                            onChange={(event) => {
                                                setIncomeDistributionRows((rows) => rows.map((entry, entryIndex) => (
                                                    entryIndex === index ? { ...entry, amountPhp: event.target.value } : entry
                                                )));
                                                setSelectAllBudgets(false);
                                            }}
                                        />
                                        <ActionIconButton
                                            action="delete"
                                            label={`Remove budget distribution row ${index + 1}`}
                                            type="button"
                                            disabled={incomeDistributionRows.length === 1}
                                            onClick={() => {
                                                setSelectAllBudgets(false);
                                                setIncomeDistributionRows((rows) => rows.filter((_, rowIndex) => rowIndex !== index));
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}

                        {supportsIncomeStream && (
                            <div className="d-grid gap-1">
                                <label htmlFor="tx-income-stream" className="small fw-semibold">
                                    {recordOnly ? "Income Stream (Optional)" : "Income Stream"}
                                </label>
                                <select
                                    id="tx-income-stream"
                                    name="incomeStreamId"
                                    className="form-control"
                                    value={incomeStreamId}
                                    onChange={(event) => setIncomeStreamId(event.target.value)}
                                >
                                    <option value="">Optional</option>
                                    {incomeStreams.map((stream) => (
                                        <option key={stream.id} value={stream.id}>
                                            {stream.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {supportsLoan && (
                            <div className="d-grid gap-1">
                                <label htmlFor="tx-loan" className="small fw-semibold">Loan Record</label>
                                <select
                                    id="tx-loan"
                                    name="loanRecordId"
                                    className="form-control"
                                    value={loanRecordId}
                                    onChange={(event) => setLoanRecordId(event.target.value)}
                                >
                                    <option value="">Optional</option>
                                    {loanRecords.map((loan) => (
                                        <option key={loan.id} value={loan.id}>
                                            {loan.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="d-grid gap-1">
                            <label htmlFor="tx-remarks" className="small fw-semibold">Remarks</label>
                            <textarea
                                id="tx-remarks"
                                name="remarks"
                                className="form-control"
                                rows={2}
                                placeholder="Optional"
                                value={remarks}
                                onChange={(event) => setRemarks(event.target.value)}
                            />
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button type="button" variant="outline-secondary" onClick={() => setIsOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" name="submitMode" value="post-and-add-another" variant="outline-primary">
                            Post &amp; Add Another
                        </Button>
                        <Button type="submit" name="submitMode" value="post">Post Entry</Button>
                    </Modal.Footer>
                </form>
            </Modal>
        </>
    );
}
