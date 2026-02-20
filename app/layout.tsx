import type { Metadata } from "next";
import { Orbitron, Space_Grotesk, Space_Mono } from "next/font/google";
import ThemeToggle from "@/app/theme-toggle";
import { AppToastProvider } from "@/app/components/toast-provider";
import "bootstrap/dist/css/bootstrap.min.css";
import "./globals.scss";

const appSans = Space_Grotesk({
  variable: "--font-app-sans",
  subsets: ["latin"],
});

const appMono = Space_Mono({
  variable: "--font-app-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const appDisplay = Orbitron({
  variable: "--font-app-display",
  subsets: ["latin"],
  weight: ["500", "700"],
});

export const metadata: Metadata = {
  title: "Personal Finance",
  description: "Track budgets, spending, and financial goals.",
};

const themeInitScript = `
(() => {
  try {
    const stored = localStorage.getItem("pf-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = stored === "light" || stored === "dark" ? stored : (prefersDark ? "dark" : "light");
    document.documentElement.dataset.theme = theme;
  } catch {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${appSans.variable} ${appMono.variable} ${appDisplay.variable}`}>
        <AppToastProvider>
          <ThemeToggle />
          {children}
        </AppToastProvider>
      </body>
    </html>
  );
}
