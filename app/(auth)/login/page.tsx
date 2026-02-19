"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Card from "react-bootstrap/Card";
import CardBody from "react-bootstrap/CardBody";
import Form from "react-bootstrap/Form";
import FormControl from "react-bootstrap/FormControl";
import FormGroup from "react-bootstrap/FormGroup";
import FormLabel from "react-bootstrap/FormLabel";
import Placeholder from "react-bootstrap/Placeholder";
import Stack from "react-bootstrap/Stack";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError("");
        setIsSubmitting(true);

        try {
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data?.error ?? "Login failed.");
                return;
            }

            router.push("/wallet");
        } catch {
            setError("Unable to connect. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Card className="pf-surface-card w-100 border-0" style={{ maxWidth: "28rem" }}>
            <CardBody className="p-4 d-grid gap-4">
                <div className="d-grid gap-2">
                    <p className="m-0 text-uppercase small" style={{ letterSpacing: "0.3em", color: "var(--color-kicker-emerald)" }}>
                    Personal Finance
                    </p>
                    <h1 className="m-0 fs-2 fw-semibold" style={{ color: "var(--color-text-strong)" }}>Welcome back</h1>
                    <p className="m-0 small" style={{ color: "var(--color-text-muted)" }}>
                        Sign in to track your spending, budgets, and insights.
                    </p>
                </div>

                {isMounted ? (
                    <Form className="d-grid gap-3" onSubmit={handleSubmit}>
                        <FormGroup controlId="loginEmail">
                            <FormLabel className="small" style={{ color: "var(--color-text-subtle)" }}>Email</FormLabel>
                            <FormControl
                            type="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            required
                            autoComplete="email"
                        />
                        </FormGroup>
                        <FormGroup controlId="loginPassword">
                            <FormLabel className="small" style={{ color: "var(--color-text-subtle)" }}>Password</FormLabel>
                            <FormControl
                            type="password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            required
                            minLength={8}
                            autoComplete="current-password"
                        />
                        </FormGroup>

                        {error ? (
                            <Alert variant="danger" className="py-2 px-3 mb-0">
                                {error}
                            </Alert>
                        ) : null}

                        <Button type="submit" variant="success" disabled={isSubmitting} className="w-100 rounded-3 py-2 fw-semibold">
                            {isSubmitting ? "Signing in..." : "Sign in"}
                        </Button>
                    </Form>
                ) : (
                    <Stack gap={3} aria-hidden="true">
                        <Placeholder as="div" animation="wave">
                            <Placeholder xs={12} style={{ height: "4rem", borderRadius: "1rem" }} />
                        </Placeholder>
                        <Placeholder as="div" animation="wave">
                            <Placeholder xs={12} style={{ height: "4rem", borderRadius: "1rem" }} />
                        </Placeholder>
                        <Placeholder as="div" animation="wave">
                            <Placeholder bg="success" xs={12} style={{ height: "2.75rem", borderRadius: "1rem" }} />
                        </Placeholder>
                    </Stack>
                )}

                <p className="mb-0 text-center small" style={{ color: "var(--color-text-muted)" }}>
                    New here?{" "}
                    <Link className="fw-semibold" style={{ color: "var(--color-link-emerald)" }} href="/signup">
                        Create an account
                    </Link>
                </p>
            </CardBody>
        </Card>
    );
}
