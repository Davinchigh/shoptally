import { useEffect, useMemo, useState } from "react";
import { api, type Product } from "../api";
import { amount, cartTotal, ghs } from "../money";
import { Icon } from "../ui";

export default function Sell({ onSold }: { onSold: (message: string) => void }) {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [qty, setQty] = useState<Record<number, number>>({});
  const [method, setMethod] = useState<"cash" | "momo">("momo");
  const [reference, setReference] = useState("");
  const [showRef, setShowRef] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.products().then(setProducts).catch((e) => setError(e.message)); }, []);

  const lines = useMemo(
    () => (products ?? []).filter((p) => qty[p.id]).map((p) => ({ productId: p.id, quantity: qty[p.id], price: p.price_pesewas })),
    [products, qty],
  );
  const total = cartTotal(lines);
  const items = lines.reduce((n, l) => n + l.quantity, 0);
  const shown = (products ?? []).filter((p) => (p.name + p.sku).toLowerCase().includes(query.toLowerCase()));

  const bump = (p: Product, by: number) =>
    setQty((q) => ({ ...q, [p.id]: Math.max(0, Math.min(p.stock, (q[p.id] ?? 0) + by)) }));

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const sale = await api.sell({
        items: lines.map((l) => ({ product_id: l.productId, quantity: l.quantity })),
        payment_method: method,
        momo_reference: method === "momo" && reference.trim() ? reference.trim() : undefined,
      });
      setQty({});
      setReference("");
      setShowRef(false);
      onSold(`Receipt No. ${String(sale.id).padStart(4, "0")} saved · ${ghs(sale.total_pesewas)} ${method === "momo" ? "MoMo" : "cash"}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="hero">
        <h1>New sale</h1>
        <p>Tap + for each item, choose how they paid, then record it.</p>
      </section>

      <label className="search">
        <span className="visually-hidden">Find a product</span>
        <Icon name="search" size={20} />
        <input type="search" placeholder="Find a product" value={query} onChange={(e) => setQuery(e.target.value)} enterKeyHint="search" />
      </label>

      <div className="section">
        <div className="list" aria-busy={!products && !error}>
          {!products && !error && <><div className="skeleton line" /><div className="skeleton line" /><div className="skeleton line" /></>}
          {products?.length === 0 && <div className="empty"><strong>No products yet</strong>Add what you sell on the Stock tab first.</div>}
          {products && products.length > 0 && shown.length === 0 && <div className="empty"><strong>Nothing matches “{query}”</strong>Check the spelling or search by code.</div>}
          {shown.map((p) => (
            <div className="item" key={p.id}>
              <div className="grow">
                <p className="name">{p.name}</p>
                <span className="meta">{ghs(p.price_pesewas)} · {p.stock === 0 ? "out of stock" : `${p.stock} in stock`}</span>
              </div>
              <div className={`stepper${qty[p.id] ? " on" : ""}`}>
                <button aria-label={`One less ${p.name}`} onClick={() => bump(p, -1)} disabled={!qty[p.id]}><Icon name="minus" size={20} /></button>
                <output aria-live="polite" aria-label={`${p.name} quantity`}>{qty[p.id] ?? 0}</output>
                <button aria-label={`One more ${p.name}`} onClick={() => bump(p, 1)} disabled={(qty[p.id] ?? 0) >= p.stock}><Icon name="plus" size={20} /></button>
              </div>
            </div>
          ))}
        </div>
        {error && <p className="note error gap-top" role="alert">{error}</p>}
        <div className={`order-space ${method === "momo" && showRef ? "momo" : "cash"}`} aria-hidden="true" />
      </div>

      <section className="order" aria-label="This sale">
        <div className="seg" role="group" aria-label="How they paid">
          <button aria-pressed={method === "momo"} onClick={() => setMethod("momo")}>MoMo</button>
          <button aria-pressed={method === "cash"} onClick={() => setMethod("cash")}>Cash</button>
        </div>
        {method === "momo" && !showRef && (
          <button className="btn link ref-toggle" onClick={() => setShowRef(true)}>Add the MoMo transaction ID (optional)</button>
        )}
        {method === "momo" && showRef && (
          <label>
            <span>MoMo transaction ID <span className="hint">(optional, makes the check exact)</span></span>
            <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="MP251105.0812.A1" autoCapitalize="characters" autoCorrect="off" />
          </label>
        )}
        <div className="total">
          <span className="muted">{items} item{items === 1 ? "" : "s"}</span>
          <span className="num">GHS {amount(total)}</span>
        </div>
        <button className="btn primary block" disabled={busy || lines.length === 0} onClick={submit}>
          {busy ? "Saving the receipt" : lines.length === 0 ? "Add an item to record a sale" : `Record ${ghs(total)} sale`}
        </button>
      </section>
    </>
  );
}
