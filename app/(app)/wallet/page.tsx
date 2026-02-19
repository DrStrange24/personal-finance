import Card from "react-bootstrap/Card";
import CardBody from "react-bootstrap/CardBody";

export default function WalletPage() {
    return (
        <section className="d-grid gap-4">
            <header className="d-grid gap-2">
                <p className="m-0 text-uppercase small" style={{ letterSpacing: "0.3em", color: "var(--color-kicker-primary)" }}>Main Page</p>
                <h2 className="m-0 fs-2 fw-semibold" style={{ color: "var(--color-text-strong)" }}>Wallet</h2>
                <p className="m-0 small" style={{ color: "var(--color-text-muted)" }}>
                    This is the main page after login. Content is intentionally empty for now.
                </p>
            </header>

            <Card className="pf-surface-panel" style={{ borderStyle: "dashed", borderColor: "var(--color-border-dashed)" }}>
                <CardBody className="text-center py-5">
                    <p className="m-0" style={{ color: "var(--color-text-muted)" }}>Wallet context is empty for now.</p>
                </CardBody>
            </Card>
        </section>
    );
}
