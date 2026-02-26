import type { BudgetEnvelopeSummary } from "@/lib/finance/types";
import { formatPhp } from "@/lib/finance/money";

export type BudgetFormOption = {
    id: string;
    label: string;
    targetLabel: string;
    targetAmountPhp: number;
};

export const mapBudgetFormOptions = (budgets: BudgetEnvelopeSummary[]): BudgetFormOption[] => {
    return budgets
        .filter((budget) => !budget.isSystem)
        .map((budget) => ({
            id: budget.id,
            label: `${budget.name} (${formatPhp(Number(budget.availablePhp))})`,
            targetLabel: `${budget.name} (${formatPhp(Number(budget.monthlyTargetPhp))})`,
            targetAmountPhp: Number(budget.monthlyTargetPhp),
        }));
};
