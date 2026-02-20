import type { Decimal } from "@prisma/client/runtime/library";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifySessionToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import WalletEntryGrid from "./entry-grid";

type WalletEntryType = "CASH_WALLET" | "ASSET_HOLDING";

type WalletEntryRow = {
    id: string;
    type: WalletEntryType;
    groupName: string | null;
    name: string;
    currentValuePhp: Decimal | string | number;
    initialInvestmentPhp: Decimal | string | number | null;
    remarks: string | null;
    sortOrder: number;
    createdAt: Date;
};

type WalletActionResult = {
    ok: boolean;
    message: string;
};

const walletTypeValues = new Set<WalletEntryType>(["CASH_WALLET", "ASSET_HOLDING"]);
const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "PHP",
});
const signedCurrencyFormatter = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});
const percentFormatter = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const getAuthenticatedSession = async () => {
    const cookieStore = await cookies();
    const token = cookieStore.get("pf_session")?.value;
    const session = token ? verifySessionToken(token) : null;

    if (!session) {
        redirect("/login");
    }

    return session;
};

const parseWalletEntryType = (value: FormDataEntryValue | null): WalletEntryType | null => {
    if (typeof value !== "string" || !walletTypeValues.has(value as WalletEntryType)) {
        return null;
    }

    return value as WalletEntryType;
};

const parseRequiredName = (value: FormDataEntryValue | null) => {
    if (typeof value !== "string") {
        return null;
    }

    const nextValue = value.trim();
    if (nextValue.length === 0 || nextValue.length > 80) {
        return null;
    }

    return nextValue;
};

const parseOptionalText = (value: FormDataEntryValue | null, maxLength: number) => {
    if (typeof value !== "string") {
        return { ok: true, value: null as string | null };
    }

    const nextValue = value.trim();
    if (nextValue.length === 0) {
        return { ok: true, value: null as string | null };
    }

    if (nextValue.length > maxLength) {
        return { ok: false, value: null as string | null };
    }

    return { ok: true, value: nextValue };
};

const parseMoney = (value: FormDataEntryValue | null, required: boolean) => {
    if (typeof value !== "string") {
        return required
            ? { ok: false, value: null as number | null }
            : { ok: true, value: null as number | null };
    }

    const nextValue = value.trim();
    if (nextValue.length === 0) {
        return required
            ? { ok: false, value: null as number | null }
            : { ok: true, value: null as number | null };
    }

    const parsedValue = Number(nextValue);
    if (!Number.isFinite(parsedValue) || parsedValue < 0) {
        return { ok: false, value: null as number | null };
    }

    return { ok: true, value: Math.round(parsedValue * 100) / 100 };
};

const parseSortOrder = (value: FormDataEntryValue | null) => {
    if (typeof value !== "string" || value.trim().length === 0) {
        return 0;
    }

    const parsedValue = Number(value.trim());
    if (!Number.isInteger(parsedValue) || parsedValue < 0) {
        return null;
    }

    return parsedValue;
};

const formatSignedCurrencyDelta = (value: number) => {
    if (value < 0) {
        return `(${signedCurrencyFormatter.format(Math.abs(value))})`;
    }

    return signedCurrencyFormatter.format(value);
};

export default async function WalletPage() {
    const session = await getAuthenticatedSession();

    const createWalletEntryAction = async (formData: FormData) => {
        "use server";

        const actionSession = await getAuthenticatedSession();
        const type = parseWalletEntryType(formData.get("type"));
        const name = parseRequiredName(formData.get("name"));
        const currentValuePhpResult = parseMoney(formData.get("currentValuePhp"), true);
        const initialInvestmentPhpResult = parseMoney(formData.get("initialInvestmentPhp"), false);
        const groupNameResult = parseOptionalText(formData.get("groupName"), 80);
        const remarksResult = parseOptionalText(formData.get("remarks"), 300);
        const sortOrder = parseSortOrder(formData.get("sortOrder"));

        if (
            !type
            || !name
            || !currentValuePhpResult.ok
            || !groupNameResult.ok
            || !remarksResult.ok
            || !initialInvestmentPhpResult.ok
            || sortOrder === null
        ) {
            return { ok: false, message: "Please provide valid wallet entry details." } satisfies WalletActionResult;
        }

        const initialInvestmentPhp = type === "ASSET_HOLDING" ? initialInvestmentPhpResult.value : null;

        try {
            await prisma.$executeRaw`
                INSERT INTO "WalletEntry" (
                    "userId",
                    "type",
                    "groupName",
                    "name",
                    "currentValuePhp",
                    "initialInvestmentPhp",
                    "remarks",
                    "sortOrder",
                    "updatedAt"
                )
                VALUES (
                    ${actionSession.userId},
                    ${type}::"WalletEntryType",
                    ${groupNameResult.value},
                    ${name},
                    ${currentValuePhpResult.value!},
                    ${initialInvestmentPhp},
                    ${remarksResult.value},
                    ${sortOrder},
                    NOW()
                )
            `;
        } catch {
            return { ok: false, message: "Could not create wallet entry. Please try again." } satisfies WalletActionResult;
        }

        revalidatePath("/wallet");
        return { ok: true, message: "Wallet entry created successfully." } satisfies WalletActionResult;
    };

    const updateWalletEntryAction = async (formData: FormData) => {
        "use server";

        const actionSession = await getAuthenticatedSession();
        const id = formData.get("id");
        const type = parseWalletEntryType(formData.get("type"));
        const name = parseRequiredName(formData.get("name"));
        const currentValuePhpResult = parseMoney(formData.get("currentValuePhp"), true);
        const initialInvestmentPhpResult = parseMoney(formData.get("initialInvestmentPhp"), false);
        const groupNameResult = parseOptionalText(formData.get("groupName"), 80);
        const remarksResult = parseOptionalText(formData.get("remarks"), 300);
        const sortOrder = parseSortOrder(formData.get("sortOrder"));

        if (
            typeof id !== "string"
            || id.trim().length === 0
            || !type
            || !name
            || !currentValuePhpResult.ok
            || !groupNameResult.ok
            || !remarksResult.ok
            || !initialInvestmentPhpResult.ok
            || sortOrder === null
        ) {
            return { ok: false, message: "Please provide valid wallet entry details." } satisfies WalletActionResult;
        }

        const initialInvestmentPhp = type === "ASSET_HOLDING" ? initialInvestmentPhpResult.value : null;

        let affectedRows = 0;
        try {
            const result = await prisma.$executeRaw`
                UPDATE "WalletEntry"
                SET
                    "type" = ${type}::"WalletEntryType",
                    "groupName" = ${groupNameResult.value},
                    "name" = ${name},
                    "currentValuePhp" = ${currentValuePhpResult.value!},
                    "initialInvestmentPhp" = ${initialInvestmentPhp},
                    "remarks" = ${remarksResult.value},
                    "sortOrder" = ${sortOrder},
                    "updatedAt" = NOW()
                WHERE "id" = ${id} AND "userId" = ${actionSession.userId} AND "isArchived" = false
            `;
            affectedRows = Number(result);
        } catch {
            return { ok: false, message: "Could not update wallet entry. Please try again." } satisfies WalletActionResult;
        }

        if (affectedRows < 1) {
            return { ok: false, message: "Wallet entry not found or access denied." } satisfies WalletActionResult;
        }

        revalidatePath("/wallet");
        return { ok: true, message: "Wallet entry updated successfully." } satisfies WalletActionResult;
    };

    const deleteWalletEntryAction = async (formData: FormData) => {
        "use server";

        const actionSession = await getAuthenticatedSession();
        const id = formData.get("id");

        if (typeof id !== "string" || id.trim().length === 0) {
            return { ok: false, message: "Invalid wallet entry id." } satisfies WalletActionResult;
        }

        let affectedRows = 0;
        try {
            const result = await prisma.$executeRaw`
                UPDATE "WalletEntry"
                SET "isArchived" = true, "updatedAt" = NOW()
                WHERE "id" = ${id} AND "userId" = ${actionSession.userId} AND "isArchived" = false
            `;
            affectedRows = Number(result);
        } catch {
            return { ok: false, message: "Could not delete wallet entry. Please try again." } satisfies WalletActionResult;
        }

        if (affectedRows < 1) {
            return { ok: false, message: "Wallet entry not found or access denied." } satisfies WalletActionResult;
        }

        revalidatePath("/wallet");
        return { ok: true, message: "Wallet entry deleted successfully." } satisfies WalletActionResult;
    };

    const walletEntries: WalletEntryRow[] = await prisma.$queryRaw<WalletEntryRow[]>`
        SELECT
            "id",
            "type",
            "groupName",
            "name",
            "currentValuePhp",
            "initialInvestmentPhp",
            "remarks",
            "sortOrder",
            "createdAt"
        FROM "WalletEntry"
        WHERE "userId" = ${session.userId} AND "isArchived" = false
        ORDER BY "type" ASC, "sortOrder" ASC, "createdAt" ASC
    `;

    const walletEntryView = walletEntries.map((entry) => {
        const currentValuePhp = Number(entry.currentValuePhp);
        const initialInvestmentPhp = entry.initialInvestmentPhp === null ? null : Number(entry.initialInvestmentPhp);
        const hasPnl = entry.type === "ASSET_HOLDING" && initialInvestmentPhp !== null && initialInvestmentPhp > 0;
        const pnlPhp = hasPnl ? currentValuePhp - initialInvestmentPhp : null;
        const pnlPercent = hasPnl ? (pnlPhp! / initialInvestmentPhp!) * 100 : null;

        return {
            id: entry.id,
            type: entry.type,
            groupName: entry.groupName ?? "",
            name: entry.name,
            currentValuePhp,
            currentValuePhpLabel: currencyFormatter.format(currentValuePhp),
            initialInvestmentPhp,
            initialInvestmentPhpLabel: initialInvestmentPhp === null ? null : currencyFormatter.format(initialInvestmentPhp),
            remarks: entry.remarks ?? "",
            sortOrder: entry.sortOrder,
            pnlPhp,
            pnlPhpLabel: pnlPhp === null ? null : formatSignedCurrencyDelta(pnlPhp),
            pnlPercent,
            pnlPercentLabel: pnlPercent === null ? null : `${percentFormatter.format(pnlPercent)}%`,
        };
    });

    const cashEntries = walletEntryView.filter((entry) => entry.type === "CASH_WALLET");
    const assetEntries = walletEntryView.filter((entry) => entry.type === "ASSET_HOLDING");
    const cashTotalPhp = cashEntries.reduce((total, entry) => total + entry.currentValuePhp, 0);
    const assetTotalPhp = assetEntries.reduce((total, entry) => total + entry.currentValuePhp, 0);
    const grandTotalPhp = cashTotalPhp + assetTotalPhp;

    return (
        <section className="d-grid gap-4">
            <header className="d-grid gap-2">
                <p className="m-0 text-uppercase small" style={{ letterSpacing: "0.3em", color: "var(--color-kicker-primary)" }}>Main Page</p>
                <h2 className="m-0 fs-2 fw-semibold" style={{ color: "var(--color-text-strong)" }}>Wallet</h2>
                <p className="m-0 small" style={{ color: "var(--color-text-muted)" }}>
                    Track your current cash wallets and asset holdings in PHP equivalent.
                </p>
            </header>

            <WalletEntryGrid
                entries={walletEntryView}
                cashEntries={cashEntries}
                assetEntries={assetEntries}
                grandTotalPhpLabel={currencyFormatter.format(grandTotalPhp)}
                cashTotalPhpLabel={currencyFormatter.format(cashTotalPhp)}
                assetTotalPhpLabel={currencyFormatter.format(assetTotalPhp)}
                createWalletEntryAction={createWalletEntryAction}
                updateWalletEntryAction={updateWalletEntryAction}
                deleteWalletEntryAction={deleteWalletEntryAction}
            />
        </section>
    );
}
