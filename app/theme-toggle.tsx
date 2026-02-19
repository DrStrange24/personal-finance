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
      <span className={styles.icon} aria-hidden="true">mode</span>
      <span className={styles.label}>Toggle theme</span>
    </button>
  );
}
