import { Prisma } from "@prisma/client";

const currencyFormatterPhp = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "PHP",
});

export const formatPhp = (value: number) => currencyFormatterPhp.format(value);

export const parseMoneyInput = (value: FormDataEntryValue | null, required = true) => {
    if (typeof value !== "string") {
        return required
            ? { ok: false, value: null as number | null }
            : { ok: true, value: null as number | null };
    }

    const normalized = value.replaceAll(",", "").trim();
    if (normalized.length === 0) {
        return required
            ? { ok: false, value: null as number | null }
            : { ok: true, value: null as number | null };
    }

    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed < 0) {
        return { ok: false, value: null as number | null };
    }

    return { ok: true, value: Math.round(parsed * 100) / 100 };
};

export const parseOptionalText = (value: FormDataEntryValue | null, maxLength: number) => {
    if (typeof value !== "string") {
        return { ok: true, value: null as string | null };
    }

    const normalized = value.trim();
    if (normalized.length === 0) {
        return { ok: true, value: null as string | null };
    }

    if (normalized.length > maxLength) {
        return { ok: false, value: null as string | null };
    }

    return { ok: true, value: normalized };
};

export const toDecimalNumber = (value: Prisma.Decimal | number | string | null) => {
    if (value === null) {
        return null;
    }

    return Number(value);
};

export const toPrismaDecimal = (value: number | string | Prisma.Decimal) => {
    return new Prisma.Decimal(value);
};
