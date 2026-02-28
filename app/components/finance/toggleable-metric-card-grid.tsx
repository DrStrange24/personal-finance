"use client";

import { useState } from "react";
import MetricCard from "@/app/components/finance/metric-card";

type MetricGridItem = {
    id: string;
    label: string;
    value: string;
    helper?: string;
};

type ToggleableMetricCardGridProps = {
    metrics: MetricGridItem[];
    storageKey: string;
    hideAllLabel?: string;
    showAllLabel?: string;
};

const EyeIcon = () => (
    <svg aria-hidden="true" viewBox="0 0 16 16" width="20" height="20" fill="currentColor">
        <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5s3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.12 12.5 8 12.5s-3.879-1.168-5.168-2.457A13.133 13.133 0 0 1 1.172 8z" />
        <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z" />
    </svg>
);

const EyeSlashIcon = () => (
    <svg aria-hidden="true" viewBox="0 0 16 16" width="20" height="20" fill="currentColor">
        <path d="M13.359 11.238l1.147 1.147a.5.5 0 0 1-.707.707l-12-12a.5.5 0 1 1 .707-.707l2.14 2.14A8.772 8.772 0 0 1 8 2.5c5 0 8 5.5 8 5.5a16.768 16.768 0 0 1-2.641 3.238zM11.297 9.176 6.824 4.703A2.5 2.5 0 0 1 11.297 9.176z" />
        <path d="M3.131 5.01A13.326 13.326 0 0 0 1.172 8s3 5.5 8 5.5a7.24 7.24 0 0 0 2.205-.338l-.82-.82a6.2 6.2 0 0 1-1.557.158c-2.12 0-3.879-1.168-5.168-2.457A13.067 13.067 0 0 1 2.173 8c.26-.381.634-.876 1.11-1.42l-.152-.152z" />
    </svg>
);

export default function ToggleableMetricCardGrid({
    metrics,
    storageKey,
    hideAllLabel = "Hide all amounts",
    showAllLabel = "Show all amounts",
}: ToggleableMetricCardGridProps) {
    const [isHidden, setIsHidden] = useState<boolean>(() => {
        if (typeof window === "undefined") {
            return false;
        }

        return window.localStorage.getItem(storageKey) === "1";
    });

    const toggleAllMetrics = () => {
        setIsHidden((current) => {
            const next = !current;
            window.localStorage.setItem(storageKey, next ? "1" : "0");
            return next;
        });
    };

    return (
        <div className="d-grid gap-2">
            <div className="d-flex justify-content-end">
                <button
                    type="button"
                    onClick={toggleAllMetrics}
                    className="btn btn-link p-0 d-inline-flex align-items-center"
                    style={{ color: "var(--color-text-muted)" }}
                    aria-label={isHidden ? showAllLabel : hideAllLabel}
                    title={isHidden ? showAllLabel : hideAllLabel}
                >
                    {isHidden ? <EyeIcon /> : <EyeSlashIcon />}
                </button>
            </div>
            <div className="d-grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                {metrics.map((metric) => (
                    <MetricCard
                        key={metric.id}
                        label={metric.label}
                        value={isHidden ? "****" : metric.value}
                        helper={metric.helper}
                    />
                ))}
            </div>
        </div>
    );
}
