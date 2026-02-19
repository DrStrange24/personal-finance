"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Card from "react-bootstrap/Card";
import CardBody from "react-bootstrap/CardBody";
import Form from "react-bootstrap/Form";
import FormControl from "react-bootstrap/FormControl";
import FormGroup from "react-bootstrap/FormGroup";
import FormLabel from "react-bootstrap/FormLabel";

export default function SignupPage() {
    const router = useRouter();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError("");

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setIsSubmitting(true);

        try {
            const response = await fetch("/api/auth/signup", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ name, email, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data?.error ?? "Signup failed.");
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
                    <p className="m-0 text-uppercase small" style={{ letterSpacing: "0.3em", color: "var(--color-kicker-primary)" }}>
                    Personal Finance
                    </p>
                    <h1 className="m-0 fs-2 fw-semibold" style={{ color: "var(--color-text-strong)" }}>Create account</h1>
                    <p className="m-0 small" style={{ color: "var(--color-text-muted)" }}>
                        Set up your profile to start organizing your finances.
                    </p>
                </div>

                <Form className="d-grid gap-3" onSubmit={handleSubmit}>
                    <FormGroup controlId="signupName">
                        <FormLabel className="small" style={{ color: "var(--color-text-subtle)" }}>Name</FormLabel>
                        <FormControl
                        type="text"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        autoComplete="name"
                    />
                    </FormGroup>
                    <FormGroup controlId="signupEmail">
                        <FormLabel className="small" style={{ color: "var(--color-text-subtle)" }}>Email</FormLabel>
                        <FormControl
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        required
                        autoComplete="email"
                    />
                    </FormGroup>
                    <FormGroup controlId="signupPassword">
                        <FormLabel className="small" style={{ color: "var(--color-text-subtle)" }}>Password</FormLabel>
                        <FormControl
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                        minLength={8}
                        autoComplete="new-password"
                    />
                    </FormGroup>
                    <FormGroup controlId="signupConfirmPassword">
                        <FormLabel className="small" style={{ color: "var(--color-text-subtle)" }}>Confirm password</FormLabel>
                        <FormControl
                        type="password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        required
                        minLength={8}
                        autoComplete="new-password"
                    />
                    </FormGroup>

                    {error ? (
                        <Alert variant="danger" className="py-2 px-3 mb-0">
                            {error}
                        </Alert>
                    ) : null}

                    <Button type="submit" variant="primary" disabled={isSubmitting} className="w-100 rounded-3 py-2 fw-semibold">
                        {isSubmitting ? "Creating account..." : "Create account"}
                    </Button>
                </Form>

                <p className="mb-0 text-center small" style={{ color: "var(--color-text-muted)" }}>
                    Already have an account?{" "}
                    <Link className="fw-semibold" style={{ color: "var(--color-link-primary)" }} href="/login">
                        Sign in
                    </Link>
                </p>
            </CardBody>
        </Card>
    );
}
