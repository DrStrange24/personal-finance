import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { parseFinanceWorkbook } from "@/lib/import/workbook";

const buildWorkbookBuffer = () => {
    const workbook = XLSX.utils.book_new();
    const walletSheet = XLSX.utils.aoa_to_sheet([
        ["Name", "Amount (â‚±)(â‰ˆ)", "Initial Investment (â‚±)", "Remarks"],
        ["Cash Wallet", 1500, null, "Opening"],
    ]);
    const statisticsSheet = XLSX.utils.aoa_to_sheet([
        ["Date", "Wallet (â‚±)(â‰ˆ)", "Remarks"],
        [new Date("2026-02-01T00:00:00.000Z"), 1500, "Snapshot"],
    ]);
    const incomeSheet = XLSX.utils.aoa_to_sheet([
        ["Name", "Amount (â‚±)", "Remarks"],
    ]);
    const budgetSheet = XLSX.utils.aoa_to_sheet([
        ["Name", "Amount (â‚±) (Monthly)", "Pecent Base (%)", "Pay To", "Budgets (â‚±)", "Remarks"],
    ]);
    const loanSheet = XLSX.utils.aoa_to_sheet([
        ["Item", "Price (â‚±)", "Monthly (â‚±)", "Paid (â‚±)", "Remaing (â‚±)", "Paid", "Pay to"],
    ]);
    const netWorthSheet = XLSX.utils.aoa_to_sheet([
        ["Monthly", 0],
        ["Current", 0],
    ]);

    XLSX.utils.book_append_sheet(workbook, walletSheet, "Wallet");
    XLSX.utils.book_append_sheet(workbook, statisticsSheet, "Statistics");
    XLSX.utils.book_append_sheet(workbook, incomeSheet, "Income");
    XLSX.utils.book_append_sheet(workbook, budgetSheet, "Budget");
    XLSX.utils.book_append_sheet(workbook, loanSheet, "Loan");
    XLSX.utils.book_append_sheet(workbook, netWorthSheet, "Net Worth");
    return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
};

describe("workbook parser", () => {
    it("builds deterministic idempotency keys from normalized row payload", () => {
        const buffer = buildWorkbookBuffer();

        const parsedA = parseFinanceWorkbook(buffer, "entity_1");
        const parsedB = parseFinanceWorkbook(buffer, "entity_1");

        expect(parsedA.rows.length).toBe(2);
        expect(parsedA.rows[0].idempotencyKey).toBe(parsedB.rows[0].idempotencyKey);
        expect(parsedA.rows[1].idempotencyKey).toBe(parsedB.rows[1].idempotencyKey);
        expect(parsedA.counts.totalRows).toBe(2);
    });
});
