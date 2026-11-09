import { type FormEvent, useEffect, useState } from "react";
import { api, type Product } from "../api";
import { ghs, toPesewas } from "../money";
import { Icon, Sheet } from "../ui";

const blank = { name: "", sku: "", price: "", stock: "0", reorder: "5" };

export default function Stock({ onChanged }: { onChanged: (message: string) => void }) {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState(blank);
  const [formError, setFormError] = useState("");
  const [adding, setAdding] = useState(false);
  const [target, setTarget] = useState<Product | null>(null);
  const [came, setCame] = useState(10);
  const [busy, setBusy] = useState(false);

  const load = () => api.products().then(setProducts).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function add(e: FormEvent) {
    e.preventDefault();
    setFormError("");
    const price = toPesewas(form.price);
    if (price === null) return setFormError("Enter a price like 45 or 12.50.");
    setBusy(true);
    try {
      await api.addProduct({ name: form.name.trim(), sku: form.sku.trim(), price_pesewas: price, stock: Number(form.stock), reorder_level: Number(form.reorder) });
      setForm(blank);
      setAdding(false);
      onChanged(`${form.name.trim()} added to your stock`);
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function restock() {
    if (!target || came <= 0) return;
    setBusy(true);
    try {
      await api.restock(target.id, came);
      setTarget(null);
      onChanged(`${came} × ${target.name} added. ${target.stock + came} in stock now.`);
    } catch (err) {
      setError((err as Error).message);
      setTarget(null);
    } finally {
      setBusy(false);
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
  const low = (products ?? []).filter((p) => p.low_stock || p.stock === 0).length;

  return (
    <>
      <section className="hero">
        <h1>Stock</h1>
        <p>{products ? `${products.length} products${low ? `, ${low} running low` : ""}. Tap one when a delivery comes in.` : "Loading your products"}</p>
      </section>

      {error && <p className="note error inset" role="alert">{error}</p>}

      <div className="section">
        <div className="list" aria-busy={!products && !error}>
          {!products && !error && <><div className="skeleton line" /><div className="skeleton line" /><div className="skeleton line" /></>}
          {products?.length === 0 && <div className="empty"><strong>No products yet</strong>Add the first thing you sell.</div>}
          {products?.map((p) => (
            <button className="item row-btn" key={p.id} onClick={() => { setCame(10); setTarget(p); }}>
              <span className="grow">
                <span className="name">{p.name}</span>
                <span className="meta">{p.sku} · {ghs(p.price_pesewas)}</span>
                {(p.low_stock || p.stock === 0) && <span className={`tag${p.stock === 0 ? " out" : ""}`}>{p.stock === 0 ? "Out of stock" : `Reorder at ${p.reorder_level}`}</span>}
              </span>
              <span className={`count${p.low_stock || p.stock === 0 ? " low" : ""}`} aria-label={`${p.stock} in stock`}>{p.stock}</span>
            </button>
          ))}
        </div>
        <button className="btn dark block add-product" onClick={() => setAdding(true)}><Icon name="plus" />Add a product</button>
      </div>

      <Sheet open={target !== null} onClose={() => setTarget(null)} title={target ? `Restock ${target.name}` : ""} subtitle={target ? `${target.stock} in stock now` : undefined}>
        <label>
          How many came in?
          <div className="stepper big-stepper">
            <button aria-label="Ten fewer" onClick={() => setCame((n) => Math.max(1, n - 10))}><Icon name="minus" size={20} /></button>
            <input type="number" inputMode="numeric" min={1} value={came} onChange={(e) => setCame(Math.max(0, Math.floor(Number(e.target.value) || 0)))} aria-label="Quantity received" />
            <button aria-label="Ten more" onClick={() => setCame((n) => n + 10)}><Icon name="plus" size={20} /></button>
          </div>
        </label>
        <button className="btn primary block" disabled={busy || came <= 0} onClick={restock}>{busy ? "Saving" : `Add ${came} to stock`}</button>
        <button className="btn quiet block" onClick={() => setTarget(null)}>Cancel</button>
      </Sheet>

      <Sheet open={adding} onClose={() => setAdding(false)} title="Add a product" subtitle="It shows up on Sell straight away">
        <form className="form" onSubmit={add}>
          <label>Name<input value={form.name} onChange={set("name")} required maxLength={120} placeholder="Sunflower oil 1L" /></label>
          <div className="form-row">
            <label>Code<input value={form.sku} onChange={set("sku")} required maxLength={40} autoCapitalize="characters" placeholder="OIL1L" /></label>
            <label>Price (GHS)<input value={form.price} onChange={set("price")} required inputMode="decimal" placeholder="38.00" /></label>
          </div>
          <div className="form-row">
            <label>In stock now<input type="number" inputMode="numeric" min={0} value={form.stock} onChange={set("stock")} required /></label>
            <label>Warn me at<input type="number" inputMode="numeric" min={0} value={form.reorder} onChange={set("reorder")} required /></label>
          </div>
          {formError && <p className="note error" role="alert">{formError}</p>}
          <button className="btn primary block" disabled={busy}>{busy ? "Saving" : "Add product"}</button>
        </form>
      </Sheet>
    </>
  );
}
