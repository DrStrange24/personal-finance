import styles from "./page.module.scss";

export default function MonthlyOverviewPage() {
    return (
        <section className={styles.section}>
            <header className={styles.header}>
                <p className={styles.kicker}>Planning</p>
                <h2 className={styles.title}>Monthly Overview</h2>
                <p className={styles.description}>
                    Placeholder UI for monthly money tracking and summaries.
                </p>
            </header>

            <div className={styles.placeholder}>
                <p className={styles.placeholderText}>Monthly overview content is coming next.</p>
            </div>
        </section>
    );
}
