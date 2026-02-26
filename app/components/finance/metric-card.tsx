import Card from "react-bootstrap/Card";
import CardBody from "react-bootstrap/CardBody";
import type { CSSProperties } from "react";

type MetricCardProps = {
    label: string;
    value: string;
    helper?: string;
    className?: string;
    style?: CSSProperties;
};

export default function MetricCard({ label, value, helper, className, style }: MetricCardProps) {
    return (
        <Card
            className={["pf-surface-card", className].filter(Boolean).join(" ")}
            style={{ width: "min(100%, 18rem)", justifySelf: "start", ...style }}
        >
            <CardBody className="d-grid gap-1">
                <small className="text-uppercase" style={{ letterSpacing: "0.08em", color: "var(--color-text-muted)" }}>
                    {label}
                </small>
                <p className="m-0 fs-5 fw-semibold" style={{ color: "var(--color-text-strong)" }}>
                    {value}
                </p>
                {helper && (
                    <p className="m-0 small" style={{ color: "var(--color-text-muted)" }}>
                        {helper}
                    </p>
                )}
            </CardBody>
        </Card>
    );
}
