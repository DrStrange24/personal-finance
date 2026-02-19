import Card from "react-bootstrap/Card";
import CardBody from "react-bootstrap/CardBody";

export default function MonthlyOverviewPage() {
    return (
        <section className="d-grid gap-4">
            <header className="d-grid gap-2">
                <p className="m-0 text-uppercase small" style={{ letterSpacing: "0.3em", color: "var(--color-kicker-cyan)" }}>Planning</p>
                <h2 className="m-0 fs-2 fw-semibold" style={{ color: "var(--color-text-strong)" }}>Monthly Overview</h2>
                <p className="m-0 small" style={{ color: "var(--color-text-muted)" }}>
                    Placeholder UI for monthly money tracking and summaries.
                </p>
            </header>

            <Card className="pf-surface-panel" style={{ borderStyle: "dashed", borderColor: "var(--color-border-dashed)" }}>
                <CardBody className="text-center py-5">
                    <p className="m-0" style={{ color: "var(--color-text-muted)" }}>Monthly overview content is coming next.</p>
                </CardBody>
            </Card>
        </section>
    );
}
