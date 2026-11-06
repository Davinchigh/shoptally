import { type FormEvent, useEffect, useState } from "react";
import { api, type Product } from "../api";
import { ghs, toPesewas } from "../money";

export default function Stock({ onChanged }: { onChanged: () => void }) {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", sku: "", price: "", stock: "0", reorder: "5" });
  const [formError, setFormError] = useState("");

  const load = () => api.products().then(setProducts).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function add(e: FormEvent) {
    e.preventDefault();
    setFormError("");
    const price = toPesewas(form.price);
    if (price === null) return setFormError("Enter a price like 45 or 12.50.");
    try {
      await api.addProduct({ name: form.name, sku: form.sku, price_pesewas: price, stock: Number(form.stock), reorder_level: Number(form.reorder) });
      setForm({ name: "", sku: "", price: "", stock: "0", reorder: "5" });
      await load();
      onChanged();
    } catch (err) {
      setFormError((err as Error).message);
    }
  }

  async function restock(p: Product) {
    const raw = window.prompt(`How many ${p.name} came in?`, "10");
    const n = Number(raw);
    if (!raw || !Number.isInteger(n) || n <= 0) return;
    try {
      await api.restock(p.id, n);
      await load();
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="stack">
      <h1>Stock</h1>
      {error && <p className="notice error" role="alert">{error}</p>}
      <section className="card">
        {!products && !error && <div className="skeleton" />}
        {products?.length === 0 && <p className="empty">No products yet. Add your first one below.</p>}
        {products?.map((p) => (
          <div className="row" key={p.id}>
            <div>
              <p className="name">{p.name}</p>
              <small className="num">{p.sku} · {ghs(p.price_pesewas)}</small>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className={`badge ${p.stock === 0 ? "bad" : p.low_stock ? "warn" : "ok"}`}>{p.stock} in stock</span>
              <button className="button secondary" onClick={() => restock(p)}>Restock</button>
            </div>
          </div>
        ))}
      </section>
      <section className="card">
        <h2 style={{ marginBottom: 12 }}>Add a product</h2>
        <form className="form" onSubmit={add}>
          <label>Name<input value={form.name} onChange={set("name")} required /></label>
          <div className="form-row">
            <label>Code (SKU)<input value={form.sku} onChange={set("sku")} required autoCapitalize="characters" /></label>
            <label>Price (GHS)<input value={form.price} onChange={set("price")} required inputMode="decimal" placeholder="45.00" /></label>
          </div>
          <div className="form-row">
            <label>Opening stock<input type="number" min={0} value={form.stock} onChange={set("stock")} required /></label>
            <label>Warn me at<input type="number" min={0} value={form.reorder} onChange={set("reorder")} required /></label>
          </div>
          {formError && <p className="notice error" role="alert">{formError}</p>}
          <button className="button">Add product</button>
        </form>
      </section>
    </div>
  );
}
