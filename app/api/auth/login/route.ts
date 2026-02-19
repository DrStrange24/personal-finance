import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { signSessionToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
    let body: { email?: string; password?: string } | null = null;

    try {
        body = await request.json();
    } catch {
        body = null;
    }

    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!email || !password) {
        return NextResponse.json(
            { error: "Email and password are required." },
            { status: 400 }
        );
    }

    const user = await prisma.user.findUnique({
        where: { email },
    });

    if (!user) {
        return NextResponse.json(
            { error: "Invalid email or password." },
            { status: 401 }
        );
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
        return NextResponse.json(
            { error: "Invalid email or password." },
            { status: 401 }
        );
    }

    const token = signSessionToken({ userId: user.id, email: user.email });

    const response = NextResponse.json({
        user: { id: user.id, email: user.email, name: user.name },
    });

    response.cookies.set("pf_session", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
    });

    return response;
}
