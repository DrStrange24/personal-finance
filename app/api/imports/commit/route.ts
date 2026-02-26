import { NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/auth";
import { getFinanceEntityContextFromCookie } from "@/lib/finance/entity-context";
import { commitImportBatchForUser } from "@/lib/import/commit";

export const runtime = "nodejs";

export async function POST(request: Request) {
    const cookieHeader = request.headers.get("cookie") ?? "";
    const tokenMatch = cookieHeader.match(/(?:^|;\s*)pf_session=([^;]+)/);
    const token = tokenMatch ? decodeURIComponent(tokenMatch[1]) : "";
    const session = token ? verifySessionToken(token) : null;

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: { batchId?: string; importId?: string } | null = null;
    try {
        body = await request.json();
    } catch {
        body = null;
    }

    const batchId = typeof body?.batchId === "string"
        ? body.batchId.trim()
        : (typeof body?.importId === "string" ? body.importId.trim() : "");
    if (!batchId) {
        return NextResponse.json({ error: "batchId is required." }, { status: 400 });
    }

    const entityContext = await getFinanceEntityContextFromCookie(session.userId);
    try {
        const result = await commitImportBatchForUser(
            session.userId,
            entityContext.activeEntity.id,
            batchId,
        );

        return NextResponse.json({
            ok: true,
            batchId,
            entityId: entityContext.activeEntity.id,
            result,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Import commit failed.";
        const status = message.includes("not found") ? 404 : 400;
        return NextResponse.json({ error: message }, { status });
    }
}
