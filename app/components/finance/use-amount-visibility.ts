"use client";

import { useEffect, useState } from "react";

const AMOUNT_VISIBILITY_EVENT = "pf-amount-visibility-change";
export const HIDDEN_AMOUNT_MASK = "********";

const readAmountVisibility = (storageKey: string): boolean => {
    if (typeof window === "undefined") {
        return false;
    }

    return window.localStorage.getItem(storageKey) === "1";
};

export const setAmountVisibility = (storageKey: string, hidden: boolean) => {
    if (typeof window === "undefined") {
        return;
    }

    window.localStorage.setItem(storageKey, hidden ? "1" : "0");
    window.dispatchEvent(new CustomEvent(AMOUNT_VISIBILITY_EVENT, {
        detail: { storageKey, hidden },
    }));
};

export const useAmountVisibility = (storageKey: string) => {
    const [isHidden, setIsHidden] = useState<boolean>(() => readAmountVisibility(storageKey));

    useEffect(() => {
        const onStorage = (event: StorageEvent) => {
            if (event.key === storageKey) {
                setIsHidden(readAmountVisibility(storageKey));
            }
        };

        const onVisibilityChange = (event: Event) => {
            const customEvent = event as CustomEvent<{ storageKey?: string; hidden?: boolean }>;
            if (customEvent.detail?.storageKey === storageKey) {
                setIsHidden(Boolean(customEvent.detail.hidden));
            }
        };

        window.addEventListener("storage", onStorage);
        window.addEventListener(AMOUNT_VISIBILITY_EVENT, onVisibilityChange);

        return () => {
            window.removeEventListener("storage", onStorage);
            window.removeEventListener(AMOUNT_VISIBILITY_EVENT, onVisibilityChange);
        };
    }, [storageKey]);

    const toggleAmountVisibility = () => {
        setAmountVisibility(storageKey, !isHidden);
    };

    return { isHidden, toggleAmountVisibility };
};
