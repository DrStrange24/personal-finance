import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { ImportMode } from "@prisma/client";
import { verifySessionToken } from "@/lib/auth";
import { getFinanceEntityContextFromCookie } from "@/lib/finance/entity-context";
import { parseFinanceWorkbook } from "@/lib/import/workbook";
import { stageWorkbookImportInDb } from "@/lib/import/staging-store";

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
    const entityContext = await getFinanceEntityContextFromCookie(session.userId);
    const entityId = entityContext.activeEntity.id;
    const importModeRaw = formData.get("importMode");
    const importMode = importModeRaw === ImportMode.FULL_LEDGER
        ? ImportMode.FULL_LEDGER
        : ImportMode.BALANCE_BOOTSTRAP;

    try {
        const workbookBuffer = Buffer.from(arrayBuffer);
        const parsed = parseFinanceWorkbook(workbookBuffer, entityId, importMode);
        const sourceFileHash = createHash("sha256").update(workbookBuffer).digest("hex");

        const staged = await stageWorkbookImportInDb({
            userId: session.userId,
            entityId,
            sourceFileName: file.name,
            sourceFileHash,
            importMode,
            parsedWorkbook: parsed,
        });

        return NextResponse.json({
            batchId: staged.batchId,
            importMode,
            sheets: parsed.sheetNames,
            warnings: parsed.warnings,
            counts: parsed.counts,
            stagedRowCount: staged.stagedRowCount,
            duplicateRowCount: staged.duplicateRowCount,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Could not parse workbook.";
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
