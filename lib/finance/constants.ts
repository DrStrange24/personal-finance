export const SYSTEM_ENVELOPES = {
    transfer: "System: Transfer",
    creditPayment: "System: Credit Payment",
    loanInflow: "System: Loan Inflow",
    loanPayment: "System: Loan Payment",
} as const;

export const SYSTEM_ENVELOPE_NAMES = Object.values(SYSTEM_ENVELOPES);
