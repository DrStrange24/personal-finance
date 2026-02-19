import { Button, Container, Stack } from "react-bootstrap";

export default function Home() {
  return (
    <Container as="main" className="min-vh-100 d-flex align-items-center py-5">
      <Stack gap={4} className="col-12 col-lg-10">
        <div className="d-grid gap-3">
          <p className="m-0 text-uppercase small" style={{ letterSpacing: "0.35em", color: "var(--color-kicker-primary)" }}>
            Personal Finance
          </p>
          <h1 className="m-0 fw-semibold display-5">
            Clear budgets. Confident decisions. Real-time clarity.
          </h1>
          <p className="m-0 fs-5" style={{ maxWidth: "42rem", color: "var(--color-text-muted)" }}>
            Sign in to track your spending, plan upcoming bills, and stay on top
            of every financial goal.
          </p>
        </div>
        <div className="d-flex flex-wrap align-items-center gap-3">
          <Button href="/login" variant="primary" className="rounded-pill px-4 py-2 fw-semibold">
            Sign in
          </Button>
          <Button href="/signup" variant="outline-primary" className="rounded-pill px-4 py-2 fw-semibold">
            Create account
          </Button>
        </div>
      </Stack>
    </Container>
  );
}
