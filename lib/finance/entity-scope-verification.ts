export type EntityScopeVerificationMetrics = {
    creditNullEntityCount: number;
    investmentNullEntityCount: number;
    creditOrphanCount: number;
    investmentOrphanCount: number;
    creditDuplicateGroupCount: number;
    investmentDuplicateGroupCount: number;
};

export type EntityScopeVerificationResult = {
    ok: boolean;
    violations: string[];
};

export const evaluateEntityScopeVerification = (
    metrics: EntityScopeVerificationMetrics,
): EntityScopeVerificationResult => {
    const violations: string[] = [];

    if (metrics.creditNullEntityCount > 0) {
        violations.push(`CreditAccount has ${metrics.creditNullEntityCount} row(s) with NULL entityId.`);
    }
    if (metrics.investmentNullEntityCount > 0) {
        violations.push(`Investment has ${metrics.investmentNullEntityCount} row(s) with NULL entityId.`);
    }
    if (metrics.creditOrphanCount > 0) {
        violations.push(`CreditAccount has ${metrics.creditOrphanCount} orphan/cross-user entity row(s).`);
    }
    if (metrics.investmentOrphanCount > 0) {
        violations.push(`Investment has ${metrics.investmentOrphanCount} orphan/cross-user entity row(s).`);
    }
    if (metrics.creditDuplicateGroupCount > 0) {
        violations.push(`CreditAccount has ${metrics.creditDuplicateGroupCount} active duplicate name group(s).`);
    }
    if (metrics.investmentDuplicateGroupCount > 0) {
        violations.push(`Investment has ${metrics.investmentDuplicateGroupCount} active duplicate name group(s).`);
    }

    return {
        ok: violations.length === 0,
        violations,
    };
};
