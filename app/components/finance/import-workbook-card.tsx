"use client";

import { useState } from "react";
import Button from "react-bootstrap/Button";
import Card from "react-bootstrap/Card";
import CardBody from "react-bootstrap/CardBody";
import FormControl from "react-bootstrap/FormControl";
import FormSelect from "react-bootstrap/FormSelect";
import { useAppToast } from "@/app/components/toast-provider";

type WorkbookImportCardProps = {
    onCommitted?: () => void;
};

export default function WorkbookImportCard({ onCommitted }: WorkbookImportCardProps) {
    const { showError, showSuccess } = useAppToast();
    const [file, setFile] = useState<File | null>(null);
    const [batchId, setBatchId] = useState<string | null>(null);
    const [importMode, setImportMode] = useState<"BALANCE_BOOTSTRAP" | "FULL_LEDGER">("BALANCE_BOOTSTRAP");
    const [isUploading, setIsUploading] = useState(false);
    const [isCommitting, setIsCommitting] = useState(false);
    const [preview, setPreview] = useState<string | null>(null);

    const uploadWorkbook = async () => {
        if (!file) {
            showError("Import Failed", "Choose a .xlsx file first.");
            return;
        }

        const formData = new FormData();
        formData.set("file", file);
        formData.set("importMode", importMode);
        setIsUploading(true);

        try {
            const response = await fetch("/api/imports/workbook", {
                method: "POST",
                body: formData,
            });

            const data = await response.json();
            if (!response.ok) {
                showError("Import Failed", data?.error ?? "Could not parse workbook.");
                return;
            }

            setBatchId(data.batchId as string);
            setPreview(
                `Rows ${data.counts.totalRows} (staged ${data.stagedRowCount}, duplicate ${data.duplicateRowCount}), Wallet ${data.counts.wallet}, Statistics ${data.counts.statistics}, Income ${data.counts.income}, Budget ${data.counts.budget}, Loan ${data.counts.loan}, Transactions ${data.counts.transactions}`,
            );
            showSuccess("Workbook Parsed", "Review the summary, then click commit.");
        } catch {
            showError("Import Failed", "Could not upload workbook.");
        } finally {
            setIsUploading(false);
        }
    };

    const commitWorkbook = async () => {
        if (!batchId) {
            showError("Commit Failed", "Upload and parse workbook first.");
            return;
        }

        setIsCommitting(true);
        try {
            const response = await fetch("/api/imports/commit", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ batchId }),
            });

            const data = await response.json();
            if (!response.ok) {
                showError("Commit Failed", data?.error ?? "Could not commit workbook.");
                return;
            }

            showSuccess("Import Complete", "Workbook data has been committed to your finance app.");
            setBatchId(null);
            if (onCommitted) {
                onCommitted();
            }
        } catch {
            showError("Commit Failed", "Could not commit workbook.");
        } finally {
            setIsCommitting(false);
        }
    };

    return (
        <Card className="pf-surface-panel">
            <CardBody className="d-grid gap-3">
                <div className="d-grid gap-1">
                    <h3 className="m-0 fs-6 fw-semibold" style={{ color: "var(--color-text-strong)" }}>
                        Workbook Import (.xlsx)
                    </h3>
                    <p className="m-0 small" style={{ color: "var(--color-text-muted)" }}>
                        Parse all six sheets, review counts, then commit the import.
                    </p>
                </div>

                <FormControl
                    type="file"
                    accept=".xlsx"
                    onChange={(event) => {
                        const input = event.target as HTMLInputElement;
                        setFile(input.files?.[0] ?? null);
                    }}
                />
                <FormSelect
                    aria-label="Import mode"
                    value={importMode}
                    onChange={(event) => {
                        const value = event.target.value === "FULL_LEDGER" ? "FULL_LEDGER" : "BALANCE_BOOTSTRAP";
                        setImportMode(value);
                    }}
                >
                    <option value="BALANCE_BOOTSTRAP">Balance Bootstrap</option>
                    <option value="FULL_LEDGER">Full Ledger</option>
                </FormSelect>

                {preview && (
                    <p className="m-0 small" style={{ color: "var(--color-text-muted)" }}>
                        {preview}
                    </p>
                )}

                <div className="d-flex flex-wrap gap-2">
                    <Button type="button" variant="outline-primary" onClick={uploadWorkbook} disabled={isUploading}>
                        {isUploading ? "Parsing..." : "Parse Workbook"}
                    </Button>
                    <Button type="button" onClick={commitWorkbook} disabled={!batchId || isCommitting}>
                        {isCommitting ? "Committing..." : "Commit Import"}
                    </Button>
                </div>
            </CardBody>
        </Card>
    );
}
