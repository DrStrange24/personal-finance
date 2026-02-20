"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";

type ChartPoint = {
    id: string;
    dateLabel: string;
    walletValue: number;
};

type MonthlyOverviewChartModalProps = {
    points: ChartPoint[];
};

const numberFormatter = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export default function MonthlyOverviewChartModal({ points }: MonthlyOverviewChartModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [panX, setPanX] = useState(0);
    const [panY, setPanY] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStartX, setDragStartX] = useState(0);
    const [dragStartY, setDragStartY] = useState(0);
    const chartViewportRef = useRef<HTMLDivElement | null>(null);
    const [viewportHeight, setViewportHeight] = useState(0);

    useEffect(() => {
        if (!isOpen || !chartViewportRef.current) {
            return;
        }

        const updateSize = () => {
            const nextHeight = chartViewportRef.current?.clientHeight ?? 0;
            setViewportHeight(nextHeight);
        };

        updateSize();

        const observer = new ResizeObserver(updateSize);
        observer.observe(chartViewportRef.current);

        return () => observer.disconnect();
    }, [isOpen]);

    const chart = useMemo(() => {
        const chartPaddingLeft = 96;
        const chartPaddingRight = 24;
        const chartPaddingTop = 16;
        const chartPaddingBottom = 110;
        const chartHeight = Math.max(420, viewportHeight || 0);
        const chartAxisY = chartHeight - chartPaddingBottom;
        const barWidth = 18;
        const barGap = 10;
        const chartInnerWidth = Math.max(780, points.length * (barWidth + barGap));
        const chartWidth = chartPaddingLeft + chartPaddingRight + chartInnerWidth;
        const chartInnerHeight = chartAxisY - chartPaddingTop;
        const rawMaxWallet = points.length > 0 ? Math.max(...points.map((point) => point.walletValue)) : 0;
        const roundedMaxWallet = Math.max(50000, Math.ceil(rawMaxWallet / 50000) * 50000);
        const yTickValues = [0, roundedMaxWallet * 0.25, roundedMaxWallet * 0.5, roundedMaxWallet * 0.75, roundedMaxWallet];

        const getBarX = (index: number) => chartPaddingLeft + index * (barWidth + barGap);
        const getBarHeight = (walletValue: number) => {
            if (roundedMaxWallet <= 0) {
                return 0;
            }
            return (walletValue / roundedMaxWallet) * chartInnerHeight;
        };
        const getBarY = (walletValue: number) => chartAxisY - getBarHeight(walletValue);

        return {
            chartPaddingLeft,
            chartPaddingRight,
            chartPaddingTop,
            chartAxisY,
            barWidth,
            chartWidth,
            chartHeight,
            yTickValues,
            getBarX,
            getBarHeight,
            getBarY,
            roundedMaxWallet,
            chartInnerHeight,
        };
    }, [points, viewportHeight]);

    const resetView = () => {
        setZoom(1);
        setPanX(0);
        setPanY(0);
    };

    const onDragStart = (clientX: number, clientY: number) => {
        setIsDragging(true);
        setDragStartX(clientX);
        setDragStartY(clientY);
    };

    const onDragMove = (clientX: number, clientY: number) => {
        if (!isDragging) {
            return;
        }
        setPanX((prev) => prev + (clientX - dragStartX));
        setPanY((prev) => prev + (clientY - dragStartY));
        setDragStartX(clientX);
        setDragStartY(clientY);
    };

    const onZoomIn = () => setZoom((prev) => clamp(prev + 0.2, 0.6, 4));
    const onZoomOut = () => setZoom((prev) => clamp(prev - 0.2, 0.6, 4));
    const onMoveLeft = () => setPanX((prev) => prev - 80);
    const onMoveRight = () => setPanX((prev) => prev + 80);

    return (
        <>
            <div className="d-flex align-items-center gap-2">
                <Button variant="outline-primary" size="sm" onClick={() => setIsOpen(true)}>
                    Open Chart Modal
                </Button>
                <span className="small" style={{ color: "var(--color-text-muted)" }}>
                    Zoom and drag inside modal.
                </span>
            </div>

            <Modal
                show={isOpen}
                onHide={() => {
                    setIsOpen(false);
                    setIsDragging(false);
                }}
                fullscreen
                centered
            >
                <Modal.Header closeButton>
                    <Modal.Title>Wallet Trend Chart</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div className="d-flex flex-wrap gap-2 mb-3">
                        <Button variant="outline-secondary" size="sm" onClick={onZoomOut}>Zoom Out</Button>
                        <Button variant="outline-secondary" size="sm" onClick={onZoomIn}>Zoom In</Button>
                        <Button variant="outline-secondary" size="sm" onClick={onMoveLeft}>Move Left</Button>
                        <Button variant="outline-secondary" size="sm" onClick={onMoveRight}>Move Right</Button>
                        <Button variant="outline-secondary" size="sm" onClick={resetView}>Reset</Button>
                    </div>

                    <div
                        ref={chartViewportRef}
                        className="border rounded"
                        style={{
                            overflow: "hidden",
                            background: "var(--color-surface-elevated)",
                            cursor: isDragging ? "grabbing" : "grab",
                            touchAction: "none",
                            height: "calc(100vh - 220px)",
                        }}
                        onMouseDown={(event) => onDragStart(event.clientX, event.clientY)}
                        onMouseMove={(event) => onDragMove(event.clientX, event.clientY)}
                        onMouseUp={() => setIsDragging(false)}
                        onMouseLeave={() => setIsDragging(false)}
                        onWheel={(event) => {
                            event.preventDefault();
                            const delta = event.deltaY > 0 ? -0.12 : 0.12;
                            setZoom((prev) => clamp(prev + delta, 0.6, 4));
                        }}
                    >
                        <div
                            style={{
                                transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
                                transformOrigin: "center center",
                                transition: isDragging ? "none" : "transform 0.15s ease",
                            }}
                        >
                            <svg
                                viewBox={`0 0 ${chart.chartWidth} ${chart.chartHeight}`}
                                width={chart.chartWidth}
                                height={chart.chartHeight}
                                role="img"
                                aria-label="Wallet trend chart by date"
                            >
                                {chart.yTickValues.map((tickValue) => {
                                    const y = chart.chartAxisY - (tickValue / chart.roundedMaxWallet) * chart.chartInnerHeight;
                                    return (
                                        <g key={tickValue}>
                                            <line
                                                x1={chart.chartPaddingLeft}
                                                y1={y}
                                                x2={chart.chartWidth - chart.chartPaddingRight}
                                                y2={y}
                                                stroke="var(--color-border-subtle)"
                                                strokeWidth="1"
                                            />
                                            <text
                                                x={chart.chartPaddingLeft - 10}
                                                y={y + 4}
                                                textAnchor="end"
                                                fontSize="12"
                                                fill="var(--color-text-muted)"
                                            >
                                                {numberFormatter.format(tickValue)}
                                            </text>
                                        </g>
                                    );
                                })}

                                {points.map((point, index) => {
                                    const x = chart.getBarX(index);
                                    const y = chart.getBarY(point.walletValue);
                                    const height = chart.getBarHeight(point.walletValue);

                                    return (
                                        <g key={point.id}>
                                            <rect
                                                x={x}
                                                y={y}
                                                width={chart.barWidth}
                                                height={height}
                                                rx="2"
                                                fill="var(--color-primary)"
                                            />
                                            <text
                                                x={x + chart.barWidth / 2}
                                                y={y - 6}
                                                textAnchor="middle"
                                                fontSize="11"
                                                fill="var(--color-primary)"
                                            >
                                                {numberFormatter.format(point.walletValue)}
                                            </text>
                                            <text
                                                x={x + chart.barWidth / 2}
                                                y={chart.chartAxisY + 14}
                                                textAnchor="end"
                                                fontSize="11"
                                                fill="var(--color-text-muted)"
                                                transform={`rotate(-40 ${x + chart.barWidth / 2} ${chart.chartAxisY + 14})`}
                                            >
                                                {point.dateLabel}
                                            </text>
                                            <title>{`${point.dateLabel} - ${numberFormatter.format(point.walletValue)}`}</title>
                                        </g>
                                    );
                                })}

                                <line
                                    x1={chart.chartPaddingLeft}
                                    y1={chart.chartAxisY}
                                    x2={chart.chartWidth - chart.chartPaddingRight}
                                    y2={chart.chartAxisY}
                                    stroke="var(--color-border-strong)"
                                    strokeWidth="1"
                                />
                                <line
                                    x1={chart.chartPaddingLeft}
                                    y1={chart.chartPaddingTop}
                                    x2={chart.chartPaddingLeft}
                                    y2={chart.chartAxisY}
                                    stroke="var(--color-border-strong)"
                                    strokeWidth="1"
                                />
                            </svg>
                        </div>
                    </div>
                </Modal.Body>
            </Modal>
        </>
    );
}
