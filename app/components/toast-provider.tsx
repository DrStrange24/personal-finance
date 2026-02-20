"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import Toast from "react-bootstrap/Toast";
import ToastContainer from "react-bootstrap/ToastContainer";

type ToastLevel = "success" | "danger" | "info";

type ToastItem = {
    id: number;
    title: string;
    message: string;
    level: ToastLevel;
};

type ToastContextValue = {
    showSuccess: (title: string, message: string) => void;
    showError: (title: string, message: string) => void;
    showInfo: (title: string, message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function AppToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const dismissToast = useCallback((id: number) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    const pushToast = useCallback((level: ToastLevel, title: string, message: string) => {
        const id = Date.now() + Math.floor(Math.random() * 1000);
        setToasts((prev) => [...prev, { id, level, title, message }]);
    }, []);

    const contextValue = useMemo<ToastContextValue>(
        () => ({
            showSuccess: (title, message) => pushToast("success", title, message),
            showError: (title, message) => pushToast("danger", title, message),
            showInfo: (title, message) => pushToast("info", title, message),
        }),
        [pushToast],
    );

    return (
        <ToastContext.Provider value={contextValue}>
            {children}
            <ToastContainer position="top-end" className="p-3" style={{ zIndex: 1200 }}>
                {toasts.map((toast) => (
                    <Toast
                        key={toast.id}
                        onClose={() => dismissToast(toast.id)}
                        bg={toast.level}
                        delay={3500}
                        autohide
                    >
                        <Toast.Header closeButton>
                            <strong className="me-auto">{toast.title}</strong>
                        </Toast.Header>
                        <Toast.Body className={toast.level === "info" ? "" : "text-white"}>
                            {toast.message}
                        </Toast.Body>
                    </Toast>
                ))}
            </ToastContainer>
        </ToastContext.Provider>
    );
}

export const useAppToast = () => {
    const context = useContext(ToastContext);

    if (!context) {
        throw new Error("useAppToast must be used within AppToastProvider");
    }

    return context;
};
