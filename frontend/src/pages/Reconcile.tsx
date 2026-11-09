import { useRef, useState } from "react";
import { api, type Flag, type Reconciliation } from "../api";
import { amount, ghs } from "../money";
import { Icon } from "../ui";

const ORDER: Flag["kind"][] = ["amount_mismatch", "missing_payment", "unrecorded_payment", "duplicate_transaction"];
const KIND: Record<Flag["kind"], { title: string; why: string; copy: "off" | "none" | "stranger" | null }> = {
  amount_mismatch: { title: "Paid a different amount", why: "The customer paid a different amount from the sale.", copy: "off" },
  missing_payment: { title: "No payment yet", why: "Recorded as MoMo, but the money isn't on the statement. Check with the customer.", copy: "none" },
  unrecorded_payment: { title: "Money with no sale", why: "Money came in that no sale explains. Was a sale missed?", copy: "stranger" },
  duplicate_transaction: { title: "Same line twice", why: "The statement lists this transaction twice. It was counted once.", copy: null },
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

  const diff = result?.difference_pesewas ?? 0;

  return (
    <>
      <section className="hero">
        <h1>Check MoMo payments</h1>
        {!result && <p>Upload the statement from your MoMo account. Each payment is matched to a receipt, and anything that doesn't add up is listed.</p>}
        {result && (
          <>
            <p>{diff === 0 ? "Every cedi is accounted for." : diff < 0 ? `GHS ${amount(-diff)} less came in than you sold by MoMo.` : `GHS ${amount(diff)} more came in than you sold by MoMo.`}</p>
            <div className="totals">
              <div><span>You sold by MoMo</span><b>{amount(result.expected_pesewas)}</b></div>
              <div><span>Statement received</span><b>{amount(result.received_pesewas)}</b></div>
              <div><span>Matched</span><b>{result.matches.length} of {result.momo_sales_count}</b></div>
              <div><span>Needs a look</span><b>{result.exceptions.length}</b></div>
            </div>
          </>
        )}
      </section>

      <div
        className={`upload${over ? " over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) run(f); }}
      >
        <Icon name="upload" size={28} />
        <p><b>{result ? "Check another statement" : "Drop the CSV statement here"}</b></p>
        <div className="actions">
          <button className="btn dark" disabled={busy} onClick={() => input.current?.click()}>{busy ? "Checking" : "Choose file"}</button>
          <button className="btn quiet" disabled={busy} onClick={useSample}>Use the sample statement</button>
        </div>
        <input ref={input} type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) run(f); e.target.value = ""; }} />
      </div>

      {error && <p className="note error inset" role="alert">{error}</p>}

      {result && (
        <>
          <section className="section" aria-labelledby="look">
            <div className="section-head"><h2 id="look">Needs a look</h2><span className="muted">{result.exceptions.length}</span></div>
            {result.exceptions.length === 0 && <p className="note good"><Icon name="tick" size={20} />Every payment matches a receipt.</p>}
            <div className="feed flush">
              {[...result.exceptions].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind)).map((f, i) => {
                const k = KIND[f.kind];
                const money = f.expected_pesewas ?? f.received_pesewas ?? 0;
                return (
                  <div className="slip" key={i}>
                    {k.copy && <span className={`copy ${k.copy}`} aria-hidden="true" />}
                    <div className={`paper${f.kind === "unrecorded_payment" ? " stranger" : ""}`}>
                      <span className="top">
                        <span className="no num">{f.sale_id ? `No. ${String(f.sale_id).padStart(4, "0")}` : "Statement only"}</span>
                        <span>{f.transaction_id ?? "No transaction"}</span>
                      </span>
                      <span className="items">{k.title}</span>
                      <span className="why">{f.message}</span>
                      <span className="bottom">
                        <span className="amt num" aria-label={ghs(money)}>{amount(money)}</span>
                        <span className={`status ${f.kind === "duplicate_transaction" ? "plain" : "bad"}`}>
                          {f.kind === "amount_mismatch" && f.received_pesewas !== null ? <><Icon name="alert" size={18} />Paid {amount(f.received_pesewas)}</> : f.kind === "duplicate_transaction" ? "Counted once" : <><Icon name="alert" size={18} />{k.title}</>}
                        </span>
                      </span>
                      <span className="why">{k.why}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="section" aria-labelledby="matched">
            <div className="section-head"><h2 id="matched">Matched</h2><span className="muted">{result.matches.length}</span></div>
            {result.matches.length === 0 && <div className="empty"><strong>Nothing matched yet</strong>Check the statement covers the right days.</div>}
            <div className="feed flush">
              {result.matches.map((m, i) => (
                <div className="slip" key={m.transaction_id}>
                  <span className="copy align" style={{ ["--i" as string]: i }} aria-hidden="true" />
                  <div className="paper">
                    <span className="top"><span className="no num">No. {String(m.sale_id).padStart(4, "0")}</span><span>{m.transaction_id}</span></span>
                    <span className="bottom">
                      <span className="amt num" aria-label={ghs(m.amount_pesewas)}>{amount(m.amount_pesewas)}</span>
                      <span className="status ok"><Icon name="tick" size={18} />{m.method === "reference" ? "By transaction ID" : `By amount, ${m.minutes_apart} min apart`}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {result.skipped_rows.length > 0 && (
            <details className="section">
              <summary>{result.skipped_rows.length} line{result.skipped_rows.length === 1 ? "" : "s"} in the file couldn't be read</summary>
              <ul>{result.skipped_rows.map((s) => <li key={s}>{s}</li>)}</ul>
            </details>
          )}
        </>
      )}
    </>
  );
}
