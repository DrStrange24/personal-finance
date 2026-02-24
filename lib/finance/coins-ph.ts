const COINS_PH_BASE_URL = "https://api.pro.coins.ph";

type CoinsPhDepthResponse = {
    bids?: Array<[string, string]>;
};

export const getCoinsPhBidPricePhp = async (symbol: string): Promise<number | null> => {
    const normalizedSymbol = symbol.trim().toUpperCase();
    if (!normalizedSymbol) {
        return null;
    }

    const pair = `${normalizedSymbol}PHP`;
    const url = `${COINS_PH_BASE_URL}/openapi/quote/v1/depth?symbol=${encodeURIComponent(pair)}`;

    try {
        const response = await fetch(url, {
            next: { revalidate: 60 },
        });

        if (!response.ok) {
            return null;
        }

        const data = (await response.json()) as CoinsPhDepthResponse;
        const bestBid = Number(data?.bids?.[0]?.[0] ?? 0);
        if (!Number.isFinite(bestBid) || bestBid <= 0) {
            return null;
        }

        return bestBid;
    } catch {
        return null;
    }
};

export const getCoinsPhEstimatedValuePhp = async (symbol: string, amount: number): Promise<number | null> => {
    if (!Number.isFinite(amount) || amount < 0) {
        return null;
    }

    const bidPricePhp = await getCoinsPhBidPricePhp(symbol);
    if (bidPricePhp === null) {
        return null;
    }

    return bidPricePhp * amount;
};
