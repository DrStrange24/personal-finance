"use client";

import { useAmountVisibility } from "@/app/components/finance/use-amount-visibility";
import { AMOUNT_VISIBILITY_STORAGE_KEY, HIDDEN_AMOUNT_MASK } from "@/lib/finance/constants";

type AmountTextProps = {
    value: string;
    storageKey?: string;
    mask?: string;
};

export default function AmountText({
    value,
    storageKey = AMOUNT_VISIBILITY_STORAGE_KEY,
    mask = HIDDEN_AMOUNT_MASK,
}: AmountTextProps) {
    const { isHidden } = useAmountVisibility(storageKey);
    return <>{isHidden ? mask : value}</>;
}

