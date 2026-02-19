import styles from "./page.module.scss";

export default function WalletPage() {
    return (
        <section className={styles.section}>
            <header className={styles.header}>
                <p className={styles.kicker}>Main Page</p>
                <h2 className={styles.title}>Wallet</h2>
                <p className={styles.description}>
                    This is the main page after login. Content is intentionally empty for now.
                </p>
            </header>

            <div className={styles.placeholder}>
                <p className={styles.placeholderText}>Wallet context is empty for now.</p>
            </div>
        </section>
    );
}
