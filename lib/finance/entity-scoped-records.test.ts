import { describe, expect, it } from "vitest";
import {
    ensureUniqueActiveCreditAccountName,
    ensureUniqueActiveInvestmentName,
    listActiveCreditAccountsByEntity,
    listActiveInvestmentsByEntity,
    requireOwnedCreditAccount,
    requireOwnedInvestment,
} from "@/lib/finance/entity-scoped-records";

type CreditAccountRow = {
    id: string;
    userId: string;
    entityId: string;
    name: string;
    isArchived: boolean;
};

type InvestmentRow = {
    id: string;
    userId: string;
    entityId: string;
    name: string;
    isArchived: boolean;
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
        }

        if (row[key] !== value) {
            return false;
        }
    }

    return true;
};

const makeDb = () => {
    const creditAccounts: CreditAccountRow[] = [
        { id: "c1", userId: "u1", entityId: "e1", name: "Visa", isArchived: false },
        { id: "c2", userId: "u1", entityId: "e2", name: "Visa", isArchived: false },
        { id: "c3", userId: "u1", entityId: "e1", name: "Old Card", isArchived: true },
    ];

    const investments: InvestmentRow[] = [
        { id: "i1", userId: "u1", entityId: "e1", name: "BTC", isArchived: false },
        { id: "i2", userId: "u1", entityId: "e2", name: "BTC", isArchived: false },
        { id: "i3", userId: "u1", entityId: "e1", name: "Archived", isArchived: true },
    ];

    return {
        creditAccount: {
            findMany: async ({ where }: { where: Record<string, unknown> }) =>
                creditAccounts.filter((row) => matchWhere(row as Record<string, unknown>, where)),
            findFirst: async ({ where, select }: { where: Record<string, unknown>; select?: Record<string, boolean> }) => {
                const row = creditAccounts.find((item) => matchWhere(item as Record<string, unknown>, where));
                if (!row) {
                    return null;
                }
                if (!select) {
                    return row;
                }
                const next: Record<string, unknown> = {};
                for (const key of Object.keys(select)) {
                    if (select[key]) {
                        next[key] = row[key as keyof CreditAccountRow];
                    }
                }
                return next;
            },
        },
        investment: {
            findMany: async ({ where }: { where: Record<string, unknown> }) =>
                investments.filter((row) => matchWhere(row as Record<string, unknown>, where)),
            findFirst: async ({ where, select }: { where: Record<string, unknown>; select?: Record<string, boolean> }) => {
                const row = investments.find((item) => matchWhere(item as Record<string, unknown>, where));
                if (!row) {
                    return null;
                }
                if (!select) {
                    return row;
                }
                const next: Record<string, unknown> = {};
                for (const key of Object.keys(select)) {
                    if (select[key]) {
                        next[key] = row[key as keyof InvestmentRow];
                    }
                }
                return next;
            },
        },
    };
};

describe("entity-scoped-records", () => {
    it("returns active credit accounts only for the active entity", async () => {
        const db = makeDb();
        const rows = await listActiveCreditAccountsByEntity(db as never, "u1", "e1");
        expect(rows.map((row) => row.id)).toEqual(["c1"]);
    });

    it("rejects cross-entity credit account access", async () => {
        const db = makeDb();
        await expect(requireOwnedCreditAccount(db as never, "u1", "e1", "c2")).rejects.toThrow("Credit account not found.");
    });

    it("returns active investments only for the active entity", async () => {
        const db = makeDb();
        const rows = await listActiveInvestmentsByEntity(db as never, "u1", "e1");
        expect(rows.map((row) => row.id)).toEqual(["i1"]);
    });

    it("rejects cross-entity investment access", async () => {
        const db = makeDb();
        await expect(requireOwnedInvestment(db as never, "u1", "e1", "i2")).rejects.toThrow("Investment not found.");
    });

    it("allows same active names across different entities", async () => {
        const db = makeDb();
        await expect(ensureUniqueActiveCreditAccountName(db as never, "u1", "e1", "Visa", "c1")).resolves.toBeUndefined();
        await expect(ensureUniqueActiveInvestmentName(db as never, "u1", "e1", "BTC", "i1")).resolves.toBeUndefined();
    });
});
