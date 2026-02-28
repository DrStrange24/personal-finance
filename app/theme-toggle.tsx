"use client";

import { useAmountVisibility } from "@/app/components/finance/use-amount-visibility";
import { AMOUNT_VISIBILITY_STORAGE_KEY } from "@/lib/finance/constants";
import styles from "./theme-toggle.module.scss";

type Theme = "light" | "dark";

export default function ThemeToggle() {
  const { isHidden, toggleAmountVisibility } = useAmountVisibility(AMOUNT_VISIBILITY_STORAGE_KEY);

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
    <div className={styles.toggleStack}>
      <button type="button" className={styles.toggle} onClick={toggleTheme} aria-label="Toggle color theme" title="Toggle color theme">
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
      <button
        type="button"
        className={styles.toggle}
        onClick={toggleAmountVisibility}
        aria-label={isHidden ? "Show amounts" : "Hide amounts"}
        title={isHidden ? "Show amounts" : "Hide amounts"}
      >
        <span className={styles.iconWrap} aria-hidden="true">
          {isHidden ? (
            <svg viewBox="0 0 16 16" className={styles.modeIcon} fill="currentColor">
              <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5s3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.12 12.5 8 12.5s-3.879-1.168-5.168-2.457A13.133 13.133 0 0 1 1.172 8z" />
              <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z" />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" className={styles.modeIcon} fill="currentColor">
              <path d="M13.359 11.238l1.147 1.147a.5.5 0 0 1-.707.707l-12-12a.5.5 0 1 1 .707-.707l2.14 2.14A8.772 8.772 0 0 1 8 2.5c5 0 8 5.5 8 5.5a16.768 16.768 0 0 1-2.641 3.238zM11.297 9.176 6.824 4.703A2.5 2.5 0 0 1 11.297 9.176z" />
              <path d="M3.131 5.01A13.326 13.326 0 0 0 1.172 8s3 5.5 8 5.5a7.24 7.24 0 0 0 2.205-.338l-.82-.82a6.2 6.2 0 0 1-1.557.158c-2.12 0-3.879-1.168-5.168-2.457A13.067 13.067 0 0 1 2.173 8c.26-.381.634-.876 1.11-1.42l-.152-.152z" />
            </svg>
          )}
        </span>
      </button>
    </div>
  );
}
