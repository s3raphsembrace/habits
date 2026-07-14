import Link from "next/link";

export default function Home() {
  return (
    <>
      <section className="hero">
        <h1>Pay down your sleep debt. Reclaim your energy.</h1>
        <p>
          Habits calculates your sleep debt from the nights you log, estimates your melatonin
          window from your habits, and gives you concrete, research-based steps to become a
          better sleeper — including when a nap actually helps.
        </p>
        <div className="hero-actions">
          <Link href="/login" className="button primary">
            Get started free
          </Link>
          <Link href="/library" className="button">
            Read the sleep library
          </Link>
        </div>
      </section>

      <section className="feature-grid">
        <div className="card">
          <h3>📉 Sleep debt, quantified</h3>
          <p>
            A rolling 14-day ledger of the sleep you owe yourself. Surplus nights and naps pay it
            down; late nights add to it.
          </p>
        </div>
        <div className="card">
          <h3>🌙 Melatonin window</h3>
          <p>
            We estimate when your body starts releasing melatonin from your habitual bedtime, so
            you know exactly when to wind down.
          </p>
        </div>
        <div className="card">
          <h3>⚡ Energy insights</h3>
          <p>
            Rate your energy each day and see how it tracks against your sleep debt — the real
            cost of those late nights, in your own data.
          </p>
        </div>
        <div className="card">
          <h3>🎧 Wind-down sounds</h3>
          <p>
            Built-in noise generator for falling asleep, plus a growing library of sleep science
            you can act on.
          </p>
        </div>
      </section>
    </>
  );
}
