import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionToken } from "@/lib/auth";
import {
    getFinanceEntityContextFromCookie,
    type FinanceEntitySummary,
} from "@/lib/finance/entity-context";

export type AuthenticatedSession = {
    userId: string;
    email: string;
};

export type AuthenticatedEntitySession = AuthenticatedSession & {
    activeEntity: FinanceEntitySummary;
    entities: FinanceEntitySummary[];
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

export const getAuthenticatedEntitySession = async (): Promise<AuthenticatedEntitySession> => {
    const session = await getAuthenticatedSession();
    const entityContext = await getFinanceEntityContextFromCookie(session.userId);

    return {
        ...session,
        activeEntity: entityContext.activeEntity,
        entities: entityContext.entities,
    };
};
