export const SYSTEM_ENVELOPES = {
    transfer: "System: Transfer",
    loanInflow: "System: Loan Inflow",
    loanPayment: "System: Loan Payment",
} as const;

export const SYSTEM_ENVELOPE_NAMES = Object.values(SYSTEM_ENVELOPES);
export const CREDIT_CARD_PAYMENT_ENVELOPE_PREFIX = "System: CC Payment - ";
export const LEGACY_SHARED_CREDIT_PAYMENT_ENVELOPE_NAME = "System: Credit Payment";

export const ACTIVE_FINANCE_ENTITY_COOKIE = "pf_entity";
export const ACTIVE_FINANCE_ENTITY_STORAGE_KEY = "pf-active-entity";
