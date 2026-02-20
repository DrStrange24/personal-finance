import { NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/auth";
import { commitWorkbookForUser } from "@/lib/import/commit";
import { getStagedWorkbook, removeStagedWorkbook } from "@/lib/import/staging-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
    const cookieHeader = request.headers.get("cookie") ?? "";
    const tokenMatch = cookieHeader.match(/(?:^|;\s*)pf_session=([^;]+)/);
    const token = tokenMatch ? decodeURIComponent(tokenMatch[1]) : "";
    const session = token ? verifySessionToken(token) : null;

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: { importId?: string } | null = null;
    try {
        body = await request.json();
    } catch {
        body = null;
    }

    const importId = typeof body?.importId === "string" ? body.importId.trim() : "";
    if (!importId) {
        return NextResponse.json({ error: "importId is required." }, { status: 400 });
    }

    const staged = getStagedWorkbook(importId);
    if (!staged) {
        return NextResponse.json({ error: "Import session not found or expired." }, { status: 404 });
    }

    const result = await commitWorkbookForUser(session.userId, staged);
    removeStagedWorkbook(importId);

    return NextResponse.json({
        ok: true,
        result,
    });
}
