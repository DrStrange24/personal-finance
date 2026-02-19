export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-start justify-center gap-10 px-6 py-20">
        <div className="space-y-6">
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-300/80">
            Personal Finance
          </p>
          <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
            Clear budgets. Confident decisions. Real-time clarity.
          </h1>
          <p className="max-w-2xl text-base text-slate-300 sm:text-lg">
            Sign in to track your spending, plan upcoming bills, and stay on top
            of every financial goal.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <a
            className="rounded-2xl bg-emerald-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
            href="/login"
          >
            Sign in
          </a>
          <a
            className="rounded-2xl border border-emerald-300/40 px-6 py-3 text-sm font-semibold text-emerald-200 transition hover:border-emerald-200 hover:text-emerald-100"
            href="/signup"
          >
            Create account
          </a>
        </div>
      </main>
    </div>
  );
}
