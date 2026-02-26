import { revalidatePath } from "next/cache";
import { WalletAccountType } from "@prisma/client";
import AddBudgetEnvelopeModal from "./add-budget-envelope-modal";
import AllocateBudgetModal from "./allocate-budget-modal";
import BudgetEnvelopeTable from "./budget-envelope-table";
import MetricCard from "@/app/components/finance/metric-card";
import { ensureFinanceBootstrap } from "@/lib/finance/bootstrap";
import { getFinanceContextData } from "@/lib/finance/context";
import { formatPhp } from "@/lib/finance/money";
import { parseMoneyInput, parseOptionalText } from "@/lib/finance/money";
import { postFinanceTransaction } from "@/lib/finance/posting-engine";
import { getBudgetStats } from "@/lib/finance/queries";
import { getAuthenticatedEntitySession } from "@/lib/server-session";
import { prisma } from "@/lib/prisma";

const parseRequiredName = (value: FormDataEntryValue | null) => {
    if (typeof value !== "string") {
        return null;
    }
    const normalized = value.trim();
    if (normalized.length === 0 || normalized.length > 80) {
        return null;
    }
    return normalized;
};

type BudgetActionResult = {
    ok: boolean;
    message: string;
};

export default async function BudgetPage() {
    const session = await getAuthenticatedEntitySession();
    const activeEntityId = session.activeEntity.id;
    await ensureFinanceBootstrap(session.userId, activeEntityId);

    const createBudgetEnvelopeAction = async (formData: FormData): Promise<BudgetActionResult> => {
        "use server";

        const actionSession = await getAuthenticatedEntitySession();
        const name = parseRequiredName(formData.get("name"));
        const monthlyTargetResult = parseMoneyInput(formData.get("monthlyTargetPhp"), true);
        const payToResult = parseOptionalText(formData.get("payTo"), 80);
        const remarksResult = parseOptionalText(formData.get("remarks"), 300);

        if (
            !name
            || !monthlyTargetResult.ok
            || monthlyTargetResult.value === null
            || !payToResult.ok
            || !remarksResult.ok
        ) {
            return { ok: false, message: "Please provide valid budget envelope details." };
        }

        try {
            const maxSortOrder = await prisma.budgetEnvelope.aggregate({
                where: {
                    userId: actionSession.userId,
                    entityId: actionSession.activeEntity.id,
                    isSystem: false,
                },
                _max: {
                    sortOrder: true,
                },
            });

            await prisma.budgetEnvelope.create({
                data: {
                    userId: actionSession.userId,
                    entityId: actionSession.activeEntity.id,
                    name,
                    monthlyTargetPhp: monthlyTargetResult.value,
                    availablePhp: 0,
                    payTo: payToResult.value,
                    remarks: remarksResult.value,
                    sortOrder: (maxSortOrder._max.sortOrder ?? 0) + 1,
                },
            });

            revalidatePath("/budget");
            revalidatePath("/dashboard");
            return { ok: true, message: "Budget envelope created successfully." };
        } catch {
            return { ok: false, message: "Could not create budget envelope. Please try again." };
        }
    };

    const updateBudgetEnvelopeAction = async (formData: FormData): Promise<BudgetActionResult> => {
        "use server";

        const actionSession = await getAuthenticatedEntitySession();
        const id = typeof formData.get("id") === "string" ? String(formData.get("id")).trim() : "";
        const monthlyTargetResult = parseMoneyInput(formData.get("monthlyTargetPhp"), true);
        const payToResult = parseOptionalText(formData.get("payTo"), 80);
        const remarksResult = parseOptionalText(formData.get("remarks"), 300);
        const rolloverEnabled = formData.get("rolloverEnabled") === "on";

        if (
            !id
            || !monthlyTargetResult.ok
            || monthlyTargetResult.value === null
            || !payToResult.ok
            || !remarksResult.ok
        ) {
            return { ok: false, message: "Please provide valid budget envelope details." };
        }

        try {
            const updated = await prisma.budgetEnvelope.updateMany({
                where: {
                    id,
                    userId: actionSession.userId,
                    entityId: actionSession.activeEntity.id,
                    isSystem: false,
                },
                data: {
                    monthlyTargetPhp: monthlyTargetResult.value,
                    payTo: payToResult.value,
                    remarks: remarksResult.value,
                    rolloverEnabled,
                },
            });

            if (updated.count === 0) {
                return { ok: false, message: "Budget envelope not found." };
            }

            revalidatePath("/budget");
            revalidatePath("/dashboard");
            return { ok: true, message: "Budget envelope updated successfully." };
        } catch {
            return { ok: false, message: "Could not update budget envelope. Please try again." };
        }
    };

    const deleteBudgetEnvelopeAction = async (formData: FormData): Promise<BudgetActionResult> => {
        "use server";

        const actionSession = await getAuthenticatedEntitySession();
        const id = typeof formData.get("id") === "string" ? String(formData.get("id")).trim() : "";

        if (!id) {
            return { ok: false, message: "Missing budget envelope id." };
        }

        try {
            const archived = await prisma.budgetEnvelope.updateMany({
                where: {
                    id,
                    userId: actionSession.userId,
                    entityId: actionSession.activeEntity.id,
                    isSystem: false,
                    isArchived: false,
                },
                data: {
                    isArchived: true,
                },
            });

            if (archived.count === 0) {
                return { ok: false, message: "Budget envelope not found." };
            }

            revalidatePath("/budget");
            revalidatePath("/dashboard");
            revalidatePath("/transactions");
            return { ok: true, message: "Budget envelope deleted successfully." };
        } catch {
            return { ok: false, message: "Could not delete budget envelope. Please try again." };
        }
    };

    const postBudgetAllocationAction = async (formData: FormData): Promise<BudgetActionResult> => {
        "use server";
        const actionSession = await getAuthenticatedEntitySession();

        const postedAtRaw = formData.get("postedAt");
        const amountResult = parseMoneyInput(formData.get("amountPhp"), true);
        const walletAccountId = typeof formData.get("walletAccountId") === "string"
            ? String(formData.get("walletAccountId")).trim()
            : "";
        const budgetEnvelopeId = typeof formData.get("budgetEnvelopeId") === "string"
            ? String(formData.get("budgetEnvelopeId")).trim()
            : "";
        const remarksResult = parseOptionalText(formData.get("remarks"), 300);

        if (
            typeof postedAtRaw !== "string"
            || !amountResult.ok
            || amountResult.value === null
            || !walletAccountId
            || !budgetEnvelopeId
            || !remarksResult.ok
        ) {
            return { ok: false, message: "Please provide valid budget allocation details." };
        }

        const postedAt = new Date(`${postedAtRaw}T00:00:00`);
        if (Number.isNaN(postedAt.valueOf())) {
            return { ok: false, message: "Invalid date." };
        }

        try {
            await postFinanceTransaction({
                userId: actionSession.userId,
                entityId: actionSession.activeEntity.id,
                actorUserId: actionSession.userId,
                kind: "BUDGET_ALLOCATION",
                postedAt,
                amountPhp: amountResult.value,
                walletAccountId,
                budgetEnvelopeId,
                remarks: remarksResult.value,
            });
        } catch (error) {
            return {
                ok: false,
                message: error instanceof Error ? error.message : "Could not allocate budget.",
            };
        }

        revalidatePath("/budget");
        revalidatePath("/dashboard");
        revalidatePath("/transactions");
        return { ok: true, message: "Budget allocation posted successfully." };
    };

    const [context, budgetStats] = await Promise.all([
        getFinanceContextData(session.userId, activeEntityId),
        getBudgetStats(session.userId, activeEntityId),
    ]);

    const walletOptions = context.wallets.map((wallet) => ({
        id: wallet.id,
        label: wallet.name,
    }));
    const budgetOptions = context.budgets
        .filter((budget) => !budget.isSystem)
        .map((budget) => ({
            id: budget.id,
            label: budget.name,
        }));
    const budgetRows = budgetStats.map((budget) => ({
        id: budget.id,
        name: budget.name,
        monthlyTargetPhp: budget.monthlyTargetPhp,
        availablePhp: budget.availablePhp,
        spentPhp: budget.spentPhp,
        remainingPhp: budget.remainingPhp,
        payTo: budget.payTo,
        remarks: budget.remarks,
        rolloverEnabled: budget.rolloverEnabled,
    }));
    const liquidWalletBalancePhp = context.wallets.reduce((total, wallet) => {
        if (
            wallet.type !== WalletAccountType.CASH
            && wallet.type !== WalletAccountType.BANK
            && wallet.type !== WalletAccountType.E_WALLET
        ) {
            return total;
        }
        return total + Number(wallet.currentBalanceAmount);
    }, 0);
    const allocatedBudgetPhp = budgetRows.reduce((total, budget) => total + budget.availablePhp, 0);
    const totalCreditCardDebtPhp = context.wallets.reduce((total, wallet) => {
        if (wallet.type !== WalletAccountType.CREDIT_CARD) {
            return total;
        }
        return total + Number(wallet.currentBalanceAmount);
    }, 0);
    const unallocatedCashPhp = liquidWalletBalancePhp - (allocatedBudgetPhp + totalCreditCardDebtPhp);

    return (
        <section className="d-grid gap-4">
            <header className="d-grid gap-2">
                <p className="m-0 text-uppercase small" style={{ letterSpacing: "0.3em", color: "var(--color-kicker-tertiary)" }}>Budget</p>
                <h2 className="m-0 fs-2 fw-semibold" style={{ color: "var(--color-text-strong)" }}>Envelope Budgeting</h2>
                <p className="m-0 small" style={{ color: "var(--color-text-muted)" }}>
                    Fund envelopes from wallets, then let expenses deduct both wallet and envelope.
                </p>
            </header>

            <div className="d-flex justify-content-end gap-2">
                <AllocateBudgetModal
                    wallets={walletOptions}
                    budgets={budgetOptions}
                    postBudgetAllocationAction={postBudgetAllocationAction}
                />
                <AddBudgetEnvelopeModal createBudgetEnvelopeAction={createBudgetEnvelopeAction} />
            </div>

            <div className="d-grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                <MetricCard
                    label="Unallocated Cash"
                    value={formatPhp(unallocatedCashPhp)}
                    helper="Liquid wallets minus (allocated budget plus credit card debt)."
                />
            </div>

            <BudgetEnvelopeTable
                budgets={budgetRows}
                updateBudgetEnvelopeAction={updateBudgetEnvelopeAction}
                deleteBudgetEnvelopeAction={deleteBudgetEnvelopeAction}
            />
        </section>
    );
}
