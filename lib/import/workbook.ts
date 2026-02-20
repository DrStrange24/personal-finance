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
    const normalized = String(value).replaceAll(",", "").replaceAll("₱", "").trim();
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

const mapRowsToObjects = (rows: unknown[][], headerIndex: number) => {
    if (headerIndex < 0 || headerIndex >= rows.length) {
        return [] as Record<string, unknown>[];
    }

    const headers = rows[headerIndex].map((header) => normalizeText(header));
    const dataRows = rows.slice(headerIndex + 1);

    return dataRows
        .map((row) => {
            const record: Record<string, unknown> = {};
            headers.forEach((header, idx) => {
                if (!header) {
                    return;
                }
                record[header] = row[idx] ?? null;
            });
            return record;
        })
        .filter((record) =>
            Object.values(record).some((value) => normalizeText(value).length > 0));
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

export type ParsedWorkbook = {
    sheetNames: string[];
    wallet: {
        name: string;
        amountPhp: number;
        initialInvestmentPhp: number | null;
        remarks: string | null;
    }[];
    statistics: {
        entryDate: Date;
        walletAmountPhp: number;
        remarks: string | null;
    }[];
    income: {
        name: string;
        amountPhp: number;
        remarks: string | null;
    }[];
    budget: {
        name: string;
        monthlyAmountPhp: number | null;
        percentBase: number | null;
        payTo: string | null;
        budgetBalancePhp: number | null;
        remarks: string | null;
    }[];
    loan: {
        itemName: string;
        pricePhp: number | null;
        monthlyPhp: number | null;
        paidPhp: number | null;
        remainingPhp: number | null;
        paidStatus: string | null;
        payTo: string | null;
    }[];
    netWorth: {
        monthlyPhp: number | null;
        currentPhp: number | null;
    };
    warnings: string[];
};

export const parseFinanceWorkbook = (buffer: Buffer): ParsedWorkbook => {
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const warnings: string[] = [];

    const getSheetRows = (name: string) => {
        const sheet = workbook.Sheets[name];
        if (!sheet) {
            warnings.push(`Sheet '${name}' is missing.`);
            return [] as unknown[][];
        }
        return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true }) as unknown[][];
    };

    const walletRows = getSheetRows("Wallet");
    const walletHeader = findHeaderIndex(walletRows, ["Name", "Amount"]);
    const walletObjects = mapRowsToObjects(walletRows, walletHeader);

    const statisticsRows = getSheetRows("Statistics");
    const statisticsHeader = findHeaderIndex(statisticsRows, ["Date", "Wallet"]);
    const statisticsObjects = mapRowsToObjects(statisticsRows, statisticsHeader);

    const incomeRows = getSheetRows("Income");
    const incomeHeader = findHeaderIndex(incomeRows, ["Name", "Amount"]);
    const incomeObjects = mapRowsToObjects(incomeRows, incomeHeader);

    const budgetRows = getSheetRows("Budget");
    const budgetHeader = findHeaderIndex(budgetRows, ["Name", "Amount", "Pay To", "Budgets"]);
    const budgetObjects = mapRowsToObjects(budgetRows, budgetHeader);

    const loanRows = getSheetRows("Loan");
    const loanHeader = findHeaderIndex(loanRows, ["Item", "Price", "Monthly", "Paid", "Remaing"]);
    const loanObjects = mapRowsToObjects(loanRows, loanHeader);

    const netWorthRows = getSheetRows("Net Worth");
    const netWorthMonthly = parseNumeric(netWorthRows[0]?.[1]);
    const netWorthCurrent = parseNumeric(netWorthRows[1]?.[1]);

    const wallet = walletObjects
        .map((row) => {
            const name = normalizeText(row["Name"]);
            const amountPhp = parseNumeric(row["Amount (₱)(≈)"]);
            const initialInvestmentPhp = parseNumeric(row["Initial Investment (₱)"]);
            const remarks = normalizeText(row["Remarks"]);

            if (!name || amountPhp === null || name.toLowerCase() === "total" || name.toLowerCase() === "smartcrowd") {
                return null;
            }

            return {
                name,
                amountPhp,
                initialInvestmentPhp,
                remarks: remarks || null,
            };
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    const statistics = statisticsObjects
        .map((row) => {
            const entryDate = parseExcelDate(row["Date"]);
            const walletAmountPhp = parseNumeric(row["Wallet (₱)(≈)"]);
            const remarks = normalizeText(row["Remarks"]);
            if (!entryDate || walletAmountPhp === null) {
                return null;
            }
            return {
                entryDate,
                walletAmountPhp,
                remarks: remarks || null,
            };
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    const income = incomeObjects
        .map((row) => {
            const name = normalizeText(row["Name"]);
            const amountPhp = parseNumeric(row["Amount (₱)"]);
            const remarks = normalizeText(row["Remarks"]);
            if (!name || amountPhp === null || name.toLowerCase() === "total") {
                return null;
            }
            return {
                name,
                amountPhp,
                remarks: remarks || null,
            };
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    const budget = budgetObjects
        .map((row) => {
            const name = normalizeText(row["Name"]);
            if (!name || name.toLowerCase() === "overall total") {
                return null;
            }
            return {
                name,
                monthlyAmountPhp: parseNumeric(row["Amount (₱) (Monthly)"]),
                percentBase: parseNumeric(row["Pecent Base (%)"]),
                payTo: normalizeText(row["Pay To"]) || null,
                budgetBalancePhp: parseNumeric(row["Budgets (₱)"]),
                remarks: normalizeText(row["Remarks"]) || null,
            };
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    const loan = loanObjects
        .map((row) => {
            const itemName = normalizeText(row["Item"]);
            if (!itemName) {
                return null;
            }
            return {
                itemName,
                pricePhp: parseNumeric(row["Price (₱)"]),
                monthlyPhp: parseNumeric(row["Monthly (₱)"]),
                paidPhp: parseNumeric(row["Paid (₱)"]),
                remainingPhp: parseNumeric(row["Remaing (₱)"]),
                paidStatus: normalizeText(row["Paid"]) || null,
                payTo: normalizeText(row["Pay to"]) || null,
            };
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    return {
        sheetNames: workbook.SheetNames,
        wallet,
        statistics,
        income,
        budget,
        loan,
        netWorth: {
            monthlyPhp: netWorthMonthly,
            currentPhp: netWorthCurrent,
        },
        warnings,
    };
};
