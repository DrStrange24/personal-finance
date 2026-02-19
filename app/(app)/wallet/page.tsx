export default function WalletPage() {
    return (
        <section className="space-y-6">
            <header className="space-y-2">
                <p className="text-xs uppercase tracking-[0.3em] text-emerald-300/80">Main Page</p>
                <h2 className="text-3xl font-semibold text-white">Wallet</h2>
                <p className="text-sm text-slate-300">
                    This is the main page after login. Content is intentionally empty for now.
                </p>
            </header>

            <div className="rounded-3xl border border-dashed border-white/20 bg-slate-950/40 p-10 text-center">
                <p className="text-base text-slate-300">Wallet context is empty for now.</p>
            </div>
        </section>
    );
}
