import { useEffect, useMemo, useState } from "react";
import { api, type Daily, type Product, type Sale } from "../api";
import { amount, ghs } from "../money";
import { Icon } from "../ui";

const todayIso = () => new Date().toISOString().slice(0, 10);
const clock = (iso: string) => new Date(iso.endsWith("Z") ? iso : iso + "Z").toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
type Filter = "all" | "momo" | "cash";

export default function Today({ shopName, initialDay, onSell }: { shopName: string; initialDay?: string; onSell: () => void }) {
  const [day, setDay] = useState(initialDay ?? todayIso());
  const [data, setData] = useState<Daily | null>(null);
  const [sales, setSales] = useState<Sale[] | null>(null);
  const [names, setNames] = useState<Record<number, string>>({});
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState("");

  useEffect(() => {
    setData(null); setSales(null); setError("");
    Promise.all([api.daily(day), api.sales(`${day}T00:00:00`, `${day}T23:59:59`), api.products()])
      .then(([d, s, p]) => {
        setData(d); setSales(s);
        setNames(Object.fromEntries(p.map((x: Product) => [x.id, x.name])));
      })
      .catch((e) => setError(e.message));
  }, [day]);

  const shown = useMemo(() => (sales ?? []).filter((s) => filter === "all" || s.payment_method === filter), [sales, filter]);
  const count = (f: Filter) => (sales ?? []).filter((s) => f === "all" || s.payment_method === f).length;
  const label = day === todayIso() ? "Today" : new Date(day + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <>
      <section className="hero" aria-labelledby="today-title">
        <label className="day-pick">
          <span id="today-title" className="date">{label}</span>
          <span className="change">Change day</span>
          <input type="date" value={day} max={todayIso()} aria-label="Show another day" onChange={(e) => e.target.value && setDay(e.target.value)} />
        </label>
        {data ? (
          <>
            <h1 className="big"><span className="num">{amount(data.total_pesewas)}</span><span>GHS sold in {data.sales_count} receipt{data.sales_count === 1 ? "" : "s"}</span></h1>
            <div className="split">
              <span>MoMo <b>{amount(data.momo_pesewas)}</b></span>
              <span>Cash <b>{amount(data.cash_pesewas)}</b></span>
            </div>
          </>
        ) : (
          <h1 className="big"><span className="num" aria-busy="true">{error ? "?" : "…"}</span><span>{shopName}</span></h1>
        )}
      </section>

      {error && <p className="note error inset" role="alert">{error}</p>}

      {data && data.low_stock.length > 0 && (
        <div className="inset notes">
          {data.low_stock.map((p) => (
            <p className="note" key={p.id}>
              <Icon name="low" size={20} />
              <span><b>{p.name}:</b> {p.stock === 0 ? "out of stock" : `${p.stock} left`}, reorder at {p.reorder_level}</span>
            </p>
          ))}
        </div>
      )}

      <div className="chips" role="group" aria-label="Show receipts">
        {(["all", "momo", "cash"] as Filter[]).map((f) => (
          <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {f === "all" ? "All" : f === "momo" ? "MoMo" : "Cash"} {sales ? count(f) : ""}
          </button>
        ))}
      </div>

      <div className="feed" aria-busy={!sales && !error}>
        {!sales && !error && <><div className="skeleton" /><div className="skeleton" /></>}
        {sales && shown.length === 0 && (
          <div className="empty">
            <strong>{sales.length === 0 ? "No receipts yet" : "No receipts in this view"}</strong>
            {sales.length === 0 ? "Record your first sale and it shows up here." : "Try another filter."}
          </div>
        )}
        {shown.map((s) => (
          <div className="slip" key={s.id}>
            <div className="paper">
              <span className="top">
                <span className="no num">No. {String(s.id).padStart(4, "0")}</span>
                <span>{clock(s.created_at)} · {s.payment_method === "momo" ? "MoMo" : "Cash"}</span>
              </span>
              <span className="items">
                {s.items.map((i) => `${names[i.product_id] ?? "Item"}${i.quantity > 1 ? ` × ${i.quantity}` : ""}`).join(", ")}
              </span>
              <span className="bottom">
                <span className="amt num" aria-label={ghs(s.total_pesewas)}>{amount(s.total_pesewas)}</span>
                {s.payment_method === "momo"
                  ? <span className="status plain">{s.momo_reference ? `Ref ${s.momo_reference}` : "Check it on Reconcile"}</span>
                  : <span className="status plain">Cash</span>}
              </span>
            </div>
          </div>
        ))}
      </div>

      <button className="btn primary cta" onClick={onSell}><Icon name="plus" />Record a sale</button>
    </>
  );
}
