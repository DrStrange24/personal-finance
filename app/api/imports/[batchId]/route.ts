import { NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/auth";
import { getFinanceEntityContextFromCookie } from "@/lib/finance/entity-context";
import { getImportBatchStatusForUser } from "@/lib/import/staging-store";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ batchId: string }> }) {
    const cookieHeader = request.headers.get("cookie") ?? "";
    const tokenMatch = cookieHeader.match(/(?:^|;\s*)pf_session=([^;]+)/);
    const token = tokenMatch ? decodeURIComponent(tokenMatch[1]) : "";
    const session = token ? verifySessionToken(token) : null;

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { batchId } = await context.params;
    if (!batchId || batchId.trim().length === 0) {
        return NextResponse.json({ error: "batchId is required." }, { status: 400 });
    }

    const entityContext = await getFinanceEntityContextFromCookie(session.userId);
    const status = await getImportBatchStatusForUser(
        session.userId,
        entityContext.activeEntity.id,
        batchId.trim(),
    );

    if (!status) {
        return NextResponse.json({ error: "Import batch not found." }, { status: 404 });
    }

    return NextResponse.json({
        ok: true,
        entityId: entityContext.activeEntity.id,
        batch: status,
    });
}
