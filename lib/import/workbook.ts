import { createHash } from "node:crypto";
import * as XLSX from "xlsx";

const normalizeText = (value: unknown) => {
    if (value === null || value === undefined) {
        return "";
    }
    return String(value).trim();
};

const parseNumeric = (value: unknown) => {
    if (value === null || value === undefined || value === "") {
        return null;
    }
    const normalized = String(value).replaceAll(",", "").replaceAll("â‚±", "").trim();
    if (normalized.length === 0) {
        return null;
    }
    const numeric = Number(normalized);
    if (!Number.isFinite(numeric)) {
        return null;
    }
    return Math.round(numeric * 100) / 100;
};

const findHeaderIndex = (rows: unknown[][], requiredColumns: string[]) => {
    for (let index = 0; index < rows.length; index++) {
        const row = rows[index];
        const values = row.map((cell) => normalizeText(cell).toLowerCase());
        const hasAll = requiredColumns.every((required) =>
            values.some((value) => value.includes(required.toLowerCase())));
        if (hasAll) {
            return index;
        }
    }
    return -1;
};

type SheetObjectRow = {
    rowIndex: number;
    values: Record<string, unknown>;
};

const mapRowsToObjects = (rows: unknown[][], headerIndex: number) => {
    if (headerIndex < 0 || headerIndex >= rows.length) {
        return [] as SheetObjectRow[];
    }

    const headers = rows[headerIndex].map((header) => normalizeText(header));
    const dataRows = rows.slice(headerIndex + 1);

    return dataRows
        .map((row, index) => {
            const record: Record<string, unknown> = {};
            headers.forEach((header, idx) => {
                if (!header) {
                    return;
                }
                record[header] = row[idx] ?? null;
            });
            return {
                rowIndex: headerIndex + index + 2,
                values: record,
            };
        })
        .filter((record) =>
            Object.values(record.values).some((value) => normalizeText(value).length > 0));
};

const parseExcelDate = (value: unknown) => {
    if (value instanceof Date) {
        return value;
    }
    if (typeof value === "number") {
        const parsed = XLSX.SSF.parse_date_code(value);
        if (parsed) {
            return new Date(parsed.y, parsed.m - 1, parsed.d);
        }
    }
    if (typeof value === "string" && value.trim().length > 0) {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.valueOf())) {
            return parsed;
        }
    }
    return null;
};

type WalletImportPayload = {
    rowType: "wallet";
    name: string;
    amountPhp: number;
    initialInvestmentPhp: number | null;
    remarks: string | null;
};

type StatisticsImportPayload = {
    rowType: "statistics";
    entryDateIso: string;
    walletAmountPhp: number;
    remarks: string | null;
};

type IncomeImportPayload = {
    rowType: "income";
    name: string;
    amountPhp: number;
    remarks: string | null;
};

type BudgetImportPayload = {
    rowType: "budget";
    name: string;
    monthlyAmountPhp: number | null;
    percentBase: number | null;
    payTo: string | null;
    budgetBalancePhp: number | null;
    remarks: string | null;
};

type LoanImportPayload = {
    rowType: "loan";
    itemName: string;
    pricePhp: number | null;
    monthlyPhp: number | null;
    paidPhp: number | null;
    remainingPhp: number | null;
    paidStatus: string | null;
    payTo: string | null;
};

type TransactionImportPayload = {
    rowType: "transaction";
    postedAtIso: string;
    kind: string;
    amountPhp: number;
    walletName: string;
    targetWalletName: string | null;
    budgetName: string | null;
    incomeName: string | null;
    loanItemName: string | null;
    loanCounterparty: string | null;
    remarks: string | null;
    externalId: string | null;
    adjustmentReasonCode: string | null;
};

export type ImportRowPayload =
    | WalletImportPayload
    | StatisticsImportPayload
    | IncomeImportPayload
    | BudgetImportPayload
    | LoanImportPayload
    | TransactionImportPayload;

export type ParsedImportRow = {
    sheetName: string;
    rowIndex: number;
    rowHash: string;
    idempotencyKey: string;
    payloadJson: ImportRowPayload;
};

type ImportCounts = {
    wallet: number;
    statistics: number;
    income: number;
    budget: number;
    loan: number;
    transactions: number;
    totalRows: number;
};

export type ParsedWorkbook = {
    sheetNames: string[];
    rows: ParsedImportRow[];
    warnings: string[];
    counts: ImportCounts;
};

export type ParseWorkbookMode = "BALANCE_BOOTSTRAP" | "FULL_LEDGER";

const normalizeHashValue = (value: unknown): unknown => {
    if (value === null || value === undefined) {
        return null;
    }
    if (value instanceof Date) {
        return value.toISOString();
    }
    if (typeof value === "number") {
        return Number(value.toFixed(2));
    }
    if (typeof value === "string") {
        return value.trim();
    }
    return value;
};

const computeRowHash = (payload: ImportRowPayload) => {
    const normalizedEntries = Object.entries(payload)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => [key, normalizeHashValue(value)]);

    return createHash("sha256")
        .update(JSON.stringify(Object.fromEntries(normalizedEntries)))
        .digest("hex");
};

const buildStagedRow = (
    entityId: string,
    sheetName: string,
    rowIndex: number,
    payloadJson: ImportRowPayload,
): ParsedImportRow => {
    const rowHash = computeRowHash(payloadJson);
    return {
        sheetName,
        rowIndex,
        rowHash,
        idempotencyKey: `${entityId}:${sheetName}:${rowIndex}:${rowHash}`,
        payloadJson,
    };
};

const ensureEntityId = (entityId: string) => {
    const normalized = entityId.trim();
    if (!normalized) {
        throw new Error("entityId is required for import parsing.");
    }
    return normalized;
};

export const parseFinanceWorkbook = (
    buffer: Buffer,
    entityId: string,
    mode: ParseWorkbookMode = "BALANCE_BOOTSTRAP",
): ParsedWorkbook => {
    const safeEntityId = ensureEntityId(entityId);
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const warnings: string[] = [];
    const rows: ParsedImportRow[] = [];

    const getSheetRows = (name: string) => {
        const sheet = workbook.Sheets[name];
        if (!sheet) {
            warnings.push(`Sheet '${name}' is missing.`);
            return [] as unknown[][];
        }
        return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true }) as unknown[][];
    };

    let walletCount = 0;
    let statisticsCount = 0;
    let incomeCount = 0;
    let budgetCount = 0;
    let loanCount = 0;
    let transactionsCount = 0;

    if (mode === "FULL_LEDGER") {
        const transactionRows = getSheetRows("Transactions");
        const transactionHeader = findHeaderIndex(transactionRows, ["Date", "Kind", "Amount", "Wallet"]);
        const transactionObjects = mapRowsToObjects(transactionRows, transactionHeader);
        for (const row of transactionObjects) {
            const postedAt = parseExcelDate(row.values["Date"]);
            const kind = normalizeText(row.values["Kind"]).toUpperCase();
            const amountPhp = parseNumeric(row.values["Amount (â‚±)"] ?? row.values["Amount"]);
            const walletName = normalizeText(
                row.values["Wallet"]
                ?? row.values["Source Wallet"]
                ?? row.values["Wallet Account"],
            );

            if (!postedAt || !kind || amountPhp === null || !walletName) {
                continue;
            }

            rows.push(buildStagedRow(safeEntityId, "Transactions", row.rowIndex, {
                rowType: "transaction",
                postedAtIso: postedAt.toISOString(),
                kind,
                amountPhp,
                walletName,
                targetWalletName: normalizeText(row.values["Target Wallet"]) || null,
                budgetName: normalizeText(row.values["Budget Envelope"]) || null,
                incomeName: normalizeText(row.values["Income Stream"]) || null,
                loanItemName: normalizeText(row.values["Loan Item"]) || null,
                loanCounterparty: normalizeText(row.values["Loan Counterparty"]) || null,
                remarks: normalizeText(row.values["Remarks"]) || null,
                externalId: normalizeText(row.values["External Id"] ?? row.values["External ID"]) || null,
                adjustmentReasonCode: normalizeText(
                    row.values["Adjustment Reason Code"] ?? row.values["Adjustment Reason"],
                ) || null,
            }));
            transactionsCount += 1;
        }

        if (transactionsCount === 0) {
            warnings.push("No usable ledger rows found in 'Transactions' sheet for FULL_LEDGER mode.");
        }
    } else {
        const walletRows = getSheetRows("Wallet");
        const walletHeader = findHeaderIndex(walletRows, ["Name", "Amount"]);
        const walletObjects = mapRowsToObjects(walletRows, walletHeader);
        for (const row of walletObjects) {
            const name = normalizeText(row.values["Name"]);
            const amountPhp = parseNumeric(row.values["Amount (â‚±)(â‰ˆ)"]);
            const initialInvestmentPhp = parseNumeric(row.values["Initial Investment (â‚±)"]);
            const remarks = normalizeText(row.values["Remarks"]);

            if (!name || amountPhp === null || name.toLowerCase() === "total" || name.toLowerCase() === "smartcrowd") {
                continue;
            }

            rows.push(buildStagedRow(safeEntityId, "Wallet", row.rowIndex, {
                rowType: "wallet",
                name,
                amountPhp,
                initialInvestmentPhp,
                remarks: remarks || null,
            }));
            walletCount += 1;
        }

        const statisticsRows = getSheetRows("Statistics");
        const statisticsHeader = findHeaderIndex(statisticsRows, ["Date", "Wallet"]);
        const statisticsObjects = mapRowsToObjects(statisticsRows, statisticsHeader);
        for (const row of statisticsObjects) {
            const entryDate = parseExcelDate(row.values["Date"]);
            const walletAmountPhp = parseNumeric(row.values["Wallet (â‚±)(â‰ˆ)"]);
            const remarks = normalizeText(row.values["Remarks"]);
            if (!entryDate || walletAmountPhp === null) {
                continue;
            }

            rows.push(buildStagedRow(safeEntityId, "Statistics", row.rowIndex, {
                rowType: "statistics",
                entryDateIso: entryDate.toISOString(),
                walletAmountPhp,
                remarks: remarks || null,
            }));
            statisticsCount += 1;
        }

        const incomeRows = getSheetRows("Income");
        const incomeHeader = findHeaderIndex(incomeRows, ["Name", "Amount"]);
        const incomeObjects = mapRowsToObjects(incomeRows, incomeHeader);
        for (const row of incomeObjects) {
            const name = normalizeText(row.values["Name"]);
            const amountPhp = parseNumeric(row.values["Amount (â‚±)"]);
            const remarks = normalizeText(row.values["Remarks"]);
            if (!name || amountPhp === null || name.toLowerCase() === "total") {
                continue;
            }

            rows.push(buildStagedRow(safeEntityId, "Income", row.rowIndex, {
                rowType: "income",
                name,
                amountPhp,
                remarks: remarks || null,
            }));
            incomeCount += 1;
        }

        const budgetRows = getSheetRows("Budget");
        const budgetHeader = findHeaderIndex(budgetRows, ["Name", "Amount", "Pay To", "Budgets"]);
        const budgetObjects = mapRowsToObjects(budgetRows, budgetHeader);
        for (const row of budgetObjects) {
            const name = normalizeText(row.values["Name"]);
            if (!name || name.toLowerCase() === "overall total") {
                continue;
            }

            rows.push(buildStagedRow(safeEntityId, "Budget", row.rowIndex, {
                rowType: "budget",
                name,
                monthlyAmountPhp: parseNumeric(row.values["Amount (â‚±) (Monthly)"]),
                percentBase: parseNumeric(row.values["Pecent Base (%)"]),
                payTo: normalizeText(row.values["Pay To"]) || null,
                budgetBalancePhp: parseNumeric(row.values["Budgets (â‚±)"]),
                remarks: normalizeText(row.values["Remarks"]) || null,
            }));
            budgetCount += 1;
        }

        const loanRows = getSheetRows("Loan");
        const loanHeader = findHeaderIndex(loanRows, ["Item", "Price", "Monthly", "Paid", "Remaing"]);
        const loanObjects = mapRowsToObjects(loanRows, loanHeader);
        for (const row of loanObjects) {
            const itemName = normalizeText(row.values["Item"]);
            if (!itemName) {
                continue;
            }

            rows.push(buildStagedRow(safeEntityId, "Loan", row.rowIndex, {
                rowType: "loan",
                itemName,
                pricePhp: parseNumeric(row.values["Price (â‚±)"]),
                monthlyPhp: parseNumeric(row.values["Monthly (â‚±)"]),
                paidPhp: parseNumeric(row.values["Paid (â‚±)"]),
                remainingPhp: parseNumeric(row.values["Remaing (â‚±)"]),
                paidStatus: normalizeText(row.values["Paid"]) || null,
                payTo: normalizeText(row.values["Pay to"]) || null,
            }));
            loanCount += 1;
        }
    }

    return {
        sheetNames: workbook.SheetNames,
        rows,
        warnings,
        counts: {
            wallet: walletCount,
            statistics: statisticsCount,
            income: incomeCount,
            budget: budgetCount,
            loan: loanCount,
            transactions: transactionsCount,
            totalRows: rows.length,
        },
    };
};
