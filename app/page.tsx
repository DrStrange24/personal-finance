import styles from "./page.module.scss";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.content}>
          <p className={styles.kicker}>
            Personal Finance
          </p>
          <h1 className={styles.title}>
            Clear budgets. Confident decisions. Real-time clarity.
          </h1>
          <p className={styles.description}>
            Sign in to track your spending, plan upcoming bills, and stay on top
            of every financial goal.
          </p>
        </div>
        <div className={styles.actions}>
          <a
            className={styles.primaryAction}
            href="/login"
          >
            Sign in
          </a>
          <a
            className={styles.secondaryAction}
            href="/signup"
          >
            Create account
          </a>
        </div>
      </main>
    </div>
  );
}
