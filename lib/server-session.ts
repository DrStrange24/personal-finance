import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionToken } from "@/lib/auth";

export type AuthenticatedSession = {
    userId: string;
    email: string;
};

export const getAuthenticatedSession = async (): Promise<AuthenticatedSession> => {
    const cookieStore = await cookies();
    const token = cookieStore.get("pf_session")?.value;
    const session = token ? verifySessionToken(token) : null;

    if (!session) {
        redirect("/login");
    }

    return session;
};
