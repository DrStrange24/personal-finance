import { describe, expect, it } from "vitest";
import { evaluateEntityScopeVerification } from "@/lib/finance/entity-scope-verification";

describe("entity-scope-verification", () => {
    it("passes when no violations exist", () => {
        const result = evaluateEntityScopeVerification({
            creditNullEntityCount: 0,
            investmentNullEntityCount: 0,
            creditOrphanCount: 0,
            investmentOrphanCount: 0,
            creditDuplicateGroupCount: 0,
            investmentDuplicateGroupCount: 0,
        });

        expect(result.ok).toBe(true);
        expect(result.violations).toEqual([]);
    });

    it("fails when migration verification counters report issues", () => {
        const result = evaluateEntityScopeVerification({
            creditNullEntityCount: 1,
            investmentNullEntityCount: 2,
            creditOrphanCount: 3,
            investmentOrphanCount: 4,
            creditDuplicateGroupCount: 1,
            investmentDuplicateGroupCount: 2,
        });

        expect(result.ok).toBe(false);
        expect(result.violations).toEqual([
            "CreditAccount has 1 row(s) with NULL entityId.",
            "Investment has 2 row(s) with NULL entityId.",
            "CreditAccount has 3 orphan/cross-user entity row(s).",
            "Investment has 4 orphan/cross-user entity row(s).",
            "CreditAccount has 1 active duplicate name group(s).",
            "Investment has 2 active duplicate name group(s).",
        ]);
    });
});
