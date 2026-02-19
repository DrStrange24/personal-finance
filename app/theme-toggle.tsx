"use client";

import styles from "./theme-toggle.module.scss";

type Theme = "light" | "dark";

export default function ThemeToggle() {
  const toggleTheme = () => {
    const currentTheme = document.documentElement.dataset.theme;
    const normalizedTheme: Theme = currentTheme === "light" || currentTheme === "dark"
      ? currentTheme
      : "dark";
    const nextTheme: Theme = normalizedTheme === "dark" ? "light" : "dark";

    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem("pf-theme", nextTheme);
  };

  return (
    <button type="button" className={styles.toggle} onClick={toggleTheme} aria-label="Toggle color theme">
      <span className={`${styles.iconWrap} ${styles.sunIcon}`} aria-hidden="true">
        <svg viewBox="0 0 24 24" className={styles.modeIcon}>
          <circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4L5.3 5.3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
      <span className={`${styles.iconWrap} ${styles.moonIcon}`} aria-hidden="true">
        <svg viewBox="0 0 24 24" className={styles.modeIcon}>
          <path d="M15.5 2.8a9.2 9.2 0 1 0 5.7 14.9A8.6 8.6 0 0 1 15.5 2.8Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      </span>
    </button>
  );
}
