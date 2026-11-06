import { useEffect, useMemo, useState } from "react";
import { api, type Product } from "../api";
import { cartTotal, ghs } from "../money";

export default function Sell({ onSold }: { onSold: () => void }) {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [qty, setQty] = useState<Record<number, number>>({});
  const [method, setMethod] = useState<"cash" | "momo">("momo");
  const [reference, setReference] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.products().then(setProducts).catch((e) => setError(e.message)); }, []);

  const lines = useMemo(
    () => (products ?? []).filter((p) => qty[p.id]).map((p) => ({ productId: p.id, quantity: qty[p.id], price: p.price_pesewas })),
    [products, qty],
  );
  const total = cartTotal(lines);
  const shown = (products ?? []).filter((p) => (p.name + p.sku).toLowerCase().includes(query.toLowerCase()));

  const bump = (p: Product, by: number) =>
    setQty((q) => ({ ...q, [p.id]: Math.max(0, Math.min(p.stock, (q[p.id] ?? 0) + by)) }));

  async function submit() {
    setBusy(true);
    setError("");
    setDone("");
    try {
      const sale = await api.sell({
        items: lines.map((l) => ({ product_id: l.productId, quantity: l.quantity })),
        payment_method: method,
        momo_reference: method === "momo" && reference.trim() ? reference.trim() : undefined,
      });
      setDone(`Sale #${sale.id} saved: ${ghs(sale.total_pesewas)} by ${method === "momo" ? "MoMo" : "cash"}.`);
      setQty({});
      setReference("");
      setProducts(await api.products());
      onSold();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <h1>New sale</h1>
      {done && <p className="notice success" role="status">{done}</p>}
      <label>
        <span className="visually-hidden">Find a product</span>
        <input type="search" placeholder="Find a product" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <section className="card">
        {!products && !error && <div className="skeleton" />}
        {products?.length === 0 && <p className="empty">No products yet. Add some on the Stock tab first.</p>}
        {shown.map((p) => (
          <div className="row" key={p.id}>
            <div>
              <p className="name">{p.name}</p>
              <small className="num">{ghs(p.price_pesewas)} · {p.stock} in stock</small>
            </div>
            <div className="stepper">
              <button aria-label={`One less ${p.name}`} onClick={() => bump(p, -1)} disabled={!qty[p.id]}>−</button>
              <output aria-live="polite" aria-label={`${p.name} quantity`}>{qty[p.id] ?? 0}</output>
              <button aria-label={`One more ${p.name}`} onClick={() => bump(p, 1)} disabled={(qty[p.id] ?? 0) >= p.stock}>+</button>
            </div>
          </div>
        ))}
      </section>
      <section className="card stack">
        <div className="segmented" role="group" aria-label="Payment method">
          <button aria-pressed={method === "momo"} onClick={() => setMethod("momo")}>MoMo</button>
          <button aria-pressed={method === "cash"} onClick={() => setMethod("cash")}>Cash</button>
        </div>
        {method === "momo" && (
          <label>
            MoMo transaction ID <span className="muted" style={{ fontWeight: 400 }}>(optional, makes matching exact)</span>
            <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. MP251105.0812.A1" autoCapitalize="characters" />
          </label>
        )}
        <div className="section-head" style={{ margin: 0 }}>
          <span className="muted">{lines.reduce((n, l) => n + l.quantity, 0)} items</span>
          <strong className="num" style={{ fontSize: "1.4rem" }}>{ghs(total)}</strong>
        </div>
        {error && <p className="notice error" role="alert">{error}</p>}
        <button className="button block" disabled={busy || lines.length === 0} onClick={submit}>
          {busy ? "Saving…" : `Record ${ghs(total)} sale`}
        </button>
      </section>
    </div>
  );
}
