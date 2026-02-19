import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { signSessionToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const isValidEmail = (value: string) => value.includes("@");

export async function POST(request: Request) {
    let body: { email?: string; password?: string; name?: string } | null = null;

    try {
        body = await request.json();
    } catch {
        body = null;
    }

    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const name = typeof body?.name === "string" ? body.name.trim() : "";

    if (!email || !isValidEmail(email) || !password || password.length < 8) {
        return NextResponse.json(
            { error: "Invalid email or password." },
            { status: 400 }
        );
    }

    const existingUser = await prisma.user.findUnique({
        where: { email },
    });

    if (existingUser) {
        return NextResponse.json(
            { error: "Email is already in use." },
            { status: 409 }
        );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
        data: {
            email,
            name: name || null,
            passwordHash,
        },
    });

    const token = signSessionToken({ userId: user.id, email: user.email });

    const response = NextResponse.json(
        {
            user: { id: user.id, email: user.email, name: user.name },
        },
        { status: 201 }
    );

    response.cookies.set("pf_session", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
    });

    return response;
}
