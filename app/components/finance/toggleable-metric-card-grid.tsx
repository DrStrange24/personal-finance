"use client";

import MetricCard from "@/app/components/finance/metric-card";
import { useAmountVisibility } from "@/app/components/finance/use-amount-visibility";
import { HIDDEN_AMOUNT_MASK } from "@/lib/finance/constants";

type MetricGridItem = {
    id: string;
    label: string;
    value: string;
    helper?: string;
};

type ToggleableMetricCardGridProps = {
    metrics: MetricGridItem[];
    storageKey: string;
};

export default function ToggleableMetricCardGrid({
    metrics,
    storageKey,
}: ToggleableMetricCardGridProps) {
    const { isHidden } = useAmountVisibility(storageKey);

    return (
        <div className="d-grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            {metrics.map((metric) => (
                <MetricCard
                    key={metric.id}
                    label={metric.label}
                    value={isHidden ? HIDDEN_AMOUNT_MASK : metric.value}
                    helper={metric.helper}
                />
            ))}
        </div>
    );
}
