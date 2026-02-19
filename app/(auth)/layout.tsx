import type { ReactNode } from "react";
import styles from "./layout.module.scss";

export default function AuthLayout({ children }: { children: ReactNode }) {
    return (
        <div className={styles.layout}>
            <div className={styles.background} aria-hidden="true">
                <div className={styles.glowLeft} />
                <div className={styles.glowRight} />
                <div className={styles.overlay} />
            </div>
            <div className={styles.content}>
                {children}
            </div>
        </div>
    );
}
