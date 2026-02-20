import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/auth";
import { parseFinanceWorkbook } from "@/lib/import/workbook";
import { saveStagedWorkbook } from "@/lib/import/staging-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
    const cookieHeader = request.headers.get("cookie") ?? "";
    const tokenMatch = cookieHeader.match(/(?:^|;\s*)pf_session=([^;]+)/);
    const token = tokenMatch ? decodeURIComponent(tokenMatch[1]) : "";
    const session = token ? verifySessionToken(token) : null;

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
        return NextResponse.json({ error: "Workbook file is required." }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
        return NextResponse.json({ error: "Only .xlsx files are supported." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const parsed = parseFinanceWorkbook(Buffer.from(arrayBuffer));
    const importId = randomUUID();
    saveStagedWorkbook(importId, parsed);

    return NextResponse.json({
        importId,
        sheets: parsed.sheetNames,
        warnings: parsed.warnings,
        counts: {
            wallet: parsed.wallet.length,
            statistics: parsed.statistics.length,
            income: parsed.income.length,
            budget: parsed.budget.length,
            loan: parsed.loan.length,
        },
    });
}
