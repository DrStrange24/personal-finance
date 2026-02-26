export const SYSTEM_ENVELOPES = {
    transfer: "System: Transfer",
    creditPayment: "System: Credit Payment",
    loanInflow: "System: Loan Inflow",
    loanPayment: "System: Loan Payment",
} as const;

export const SYSTEM_ENVELOPE_NAMES = Object.values(SYSTEM_ENVELOPES);

export const ACTIVE_FINANCE_ENTITY_COOKIE = "pf_entity";
export const ACTIVE_FINANCE_ENTITY_STORAGE_KEY = "pf-active-entity";
