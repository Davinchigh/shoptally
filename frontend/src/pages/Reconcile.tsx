import { useRef, useState } from "react";
import { api, type Flag, type Reconciliation } from "../api";
import { ghs } from "../money";

const FLAG: Record<Flag["kind"], { label: string; tone: string; hint: string }> = {
  missing_payment: { label: "No payment", tone: "bad", hint: "Recorded as MoMo, but the money never arrived. Check with the customer." },
  amount_mismatch: { label: "Wrong amount", tone: "bad", hint: "The customer paid a different amount from the sale." },
  unrecorded_payment: { label: "No sale recorded", tone: "warn", hint: "Money came in that no sale explains. Was a sale missed?" },
  duplicate_transaction: { label: "Duplicate line", tone: "info", hint: "The same transaction appears twice in the file. Counted once." },
};

export default function Reconcile() {
  const [result, setResult] = useState<Reconciliation | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function run(file: File) {
    setBusy(true);
    setError("");
    try {
      setResult(await api.reconcile(file));
    } catch (e) {
      setResult(null);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function useSample() {
    const res = await fetch("/momo_statement_sample.csv");
    run(new File([await res.blob()], "momo_statement_sample.csv", { type: "text/csv" }));
  }

  return (
    <div className="stack">
      <div>
        <h1>Check MoMo payments</h1>
        <p className="muted">Upload the statement you exported from your MoMo account. Every payment is matched to a sale, and anything that doesn't add up is listed for you.</p>
      </div>

      <div
        className={`drop ${over ? "over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) run(f); }}
      >
        <p><strong>Drop a CSV statement here</strong></p>
        <p className="muted">or</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          <button className="button" disabled={busy} onClick={() => input.current?.click()}>{busy ? "Checking…" : "Choose file"}</button>
          <button className="button secondary" disabled={busy} onClick={useSample}>Use the sample statement</button>
        </div>
        <input ref={input} type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) run(f); e.target.value = ""; }} />
      </div>

      {error && <p className="notice error" role="alert">{error}</p>}

      {result && (
        <>
          <div className="grid">
            <div className="card stat"><p className="label">You recorded (MoMo)</p><p className="value num">{ghs(result.expected_pesewas)}</p><small className="muted">{result.momo_sales_count} sales</small></div>
            <div className="card stat"><p className="label">Statement received</p><p className="value num">{ghs(result.received_pesewas)}</p><small className="muted">{result.statement_rows} payments</small></div>
            <div className="card stat"><p className="label">Matched</p><p className="value num">{ghs(result.matched_pesewas)}</p><small className="muted">{result.matches.length} pairs</small></div>
            <div className="card stat">
              <p className="label">Difference</p>
              <p className="value num" style={{ color: result.difference_pesewas === 0 ? "var(--ok)" : "var(--bad)" }}>{ghs(result.difference_pesewas)}</p>
              <small className="muted">{result.difference_pesewas === 0 ? "All square" : result.difference_pesewas < 0 ? "Less than you sold" : "More than you sold"}</small>
            </div>
          </div>

          <section className="card">
            <div className="section-head"><h2>Needs a look</h2><span className="muted">{result.exceptions.length}</span></div>
            {result.exceptions.length === 0 && <p className="empty">Every payment matches a sale.</p>}
            {result.exceptions.map((f, i) => (
              <div className="row" key={i} style={{ alignItems: "flex-start" }}>
                <div>
                  <p>{f.message}</p>
                  <small>{FLAG[f.kind].hint}</small>
                </div>
                <span className={`badge ${FLAG[f.kind].tone}`}>{FLAG[f.kind].label}</span>
              </div>
            ))}
          </section>

          <section className="card">
            <div className="section-head"><h2>Matched</h2><span className="muted">{result.matches.length}</span></div>
            {result.matches.length === 0 && <p className="empty">Nothing matched yet.</p>}
            {result.matches.map((m) => (
              <div className="row" key={m.transaction_id}>
                <div>
                  <p className="name num">Sale #{m.sale_id} · {ghs(m.amount_pesewas)}</p>
                  <small>{m.transaction_id} · {m.method === "reference" ? "matched by transaction ID" : `matched by amount, ${m.minutes_apart} min apart`}</small>
                </div>
                <span className="badge ok">✓ Paid</span>
              </div>
            ))}
          </section>

          {result.skipped_rows.length > 0 && (
            <details className="card"><summary>{result.skipped_rows.length} lines in the file couldn't be read</summary>
              <ul>{result.skipped_rows.map((s) => <li key={s}>{s}</li>)}</ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}
