"use client";

import { useMemo, useState } from "react";
import { TransactionKind } from "@prisma/client";
import Button from "react-bootstrap/Button";
import Card from "react-bootstrap/Card";
import CardBody from "react-bootstrap/CardBody";
import { useAppToast } from "@/app/components/toast-provider";
import type { FinanceActionResult } from "@/lib/finance/types";
import { transactionKindLabel } from "@/lib/finance/types";

type FormOption = {
    id: string;
    label: string;
};

type TransactionFormProps = {
    submitAction: (formData: FormData) => Promise<FinanceActionResult>;
    wallets: FormOption[];
    budgets: FormOption[];
    targetWallets?: FormOption[];
    incomeStreams?: FormOption[];
    loanRecords?: FormOption[];
    defaultKind?: TransactionKind;
    includeKindSelect?: boolean;
    title?: string;
    submitLabel?: string;
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
    "INCOME",
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

export default function TransactionForm({
    submitAction,
    wallets,
    budgets,
    targetWallets = [],
    incomeStreams = [],
    loanRecords = [],
    defaultKind = "EXPENSE",
    includeKindSelect = true,
    title = "Post Transaction",
    submitLabel = "Post",
}: TransactionFormProps) {
    const { showError, showSuccess } = useAppToast();
    const [kind, setKind] = useState<TransactionKind>(defaultKind);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const requiresBudget = kindsRequiringBudget.has(kind);
    const requiresTargetWallet = kindsRequiringTargetWallet.has(kind);
    const supportsIncomeStream = kindsSupportingIncomeStream.has(kind);
    const supportsLoan = kindsSupportingLoan.has(kind);

    const visibleKinds = useMemo(
        () => (includeKindSelect ? allKinds : [defaultKind]),
        [includeKindSelect, defaultKind],
    );

    const onSubmit = async (formData: FormData) => {
        setIsSubmitting(true);
        try {
            const result = await submitAction(formData);
            if (result.ok) {
                showSuccess("Transaction Posted", result.message);
                return;
            }
            showError("Post Failed", result.message);
        } catch {
            showError("Post Failed", "Could not post transaction.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Card className="pf-surface-panel">
            <CardBody className="d-grid gap-3">
                <h3 className="m-0 fs-6 fw-semibold" style={{ color: "var(--color-text-strong)" }}>
                    {title}
                </h3>
                <form action={onSubmit} className="d-grid gap-3">
                    {includeKindSelect ? (
                        <div className="d-grid gap-1">
                            <label htmlFor="tx-kind" className="small fw-semibold">Kind</label>
                            <select
                                id="tx-kind"
                                name="kind"
                                className="form-control"
                                value={kind}
                                onChange={(event) => setKind(event.target.value as TransactionKind)}
                            >
                                {visibleKinds.map((value) => (
                                    <option key={value} value={value}>
                                        {transactionKindLabel[value]}
                                    </option>
                                ))}
                            </select>
                        </div>
                    ) : (
                        <input type="hidden" name="kind" value={defaultKind} />
                    )}

                    <div className="d-grid gap-1">
                        <label htmlFor="tx-posted-at" className="small fw-semibold">Date</label>
                        <input id="tx-posted-at" type="date" name="postedAt" className="form-control" defaultValue={todayIso()} required />
                    </div>

                    <div className="d-grid gap-1">
                        <label htmlFor="tx-amount" className="small fw-semibold">Amount (PHP)</label>
                        <input id="tx-amount" type="number" name="amountPhp" className="form-control" min="0.01" step="0.01" required />
                    </div>

                    <div className="d-grid gap-1">
                        <label htmlFor="tx-wallet" className="small fw-semibold">Wallet</label>
                        <select id="tx-wallet" name="walletAccountId" className="form-control" required>
                            <option value="">Select wallet</option>
                            {wallets.map((wallet) => (
                                <option key={wallet.id} value={wallet.id}>
                                    {wallet.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {requiresTargetWallet && (
                        <div className="d-grid gap-1">
                            <label htmlFor="tx-target-wallet" className="small fw-semibold">Target Wallet</label>
                            <select id="tx-target-wallet" name="targetWalletAccountId" className="form-control" required>
                                <option value="">Select target wallet</option>
                                {targetWallets.map((wallet) => (
                                    <option key={wallet.id} value={wallet.id}>
                                        {wallet.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {requiresBudget ? (
                        <div className="d-grid gap-1">
                            <label htmlFor="tx-budget" className="small fw-semibold">Budget Envelope</label>
                            <select id="tx-budget" name="budgetEnvelopeId" className="form-control" required>
                                <option value="">Select budget envelope</option>
                                {budgets.map((budget) => (
                                    <option key={budget.id} value={budget.id}>
                                        {budget.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    ) : (
                        <input type="hidden" name="budgetEnvelopeId" value="" />
                    )}

                    {supportsIncomeStream && (
                        <div className="d-grid gap-1">
                            <label htmlFor="tx-income-stream" className="small fw-semibold">Income Stream</label>
                            <select id="tx-income-stream" name="incomeStreamId" className="form-control">
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
                            <select id="tx-loan" name="loanRecordId" className="form-control">
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
                        <textarea id="tx-remarks" name="remarks" className="form-control" rows={2} placeholder="Optional" />
                    </div>

                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? "Posting..." : submitLabel}
                    </Button>
                </form>
            </CardBody>
        </Card>
    );
}
