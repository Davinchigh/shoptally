import { useEffect, useState } from "react";
import { api, type Daily } from "../api";
import { ghs } from "../money";

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function Today({ shopName, initialDay, onSell }: { shopName: string; initialDay?: string; onSell: () => void }) {
  const [day, setDay] = useState(initialDay ?? todayIso());
  const [data, setData] = useState<Daily | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setData(null);
    setError("");
    api.daily(day).then(setData).catch((e) => setError(e.message));
  }, [day]);

  return (
    <div className="stack">
      <div className="page-head">
        <div className="title">
          <h1>{day === todayIso() ? "Today" : new Date(day + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</h1>
          {shopName && <p className="muted">{shopName}</p>}
        </div>
        <div className="controls">
          <label>
            <span className="visually-hidden">Show another day</span>
            <input type="date" value={day} max={todayIso()} onChange={(e) => e.target.value && setDay(e.target.value)} />
          </label>
          <button className="button" onClick={onSell}>New sale</button>
        </div>
      </div>
      {error && <p className="notice error" role="alert">{error}</p>}
      {data && data.sales_count === 0 && <p className="muted">No sales recorded on this day yet.</p>}
      <div className="grid" aria-busy={!data && !error}>
        {[
          ["Total sales", data?.total_pesewas],
          ["Cash", data?.cash_pesewas],
          ["MoMo", data?.momo_pesewas],
        ].map(([label, value]) => (
          <div className="card stat" key={label as string}>
            <p className="label">{label}</p>
            {data ? <p className="value num">{ghs(value as number)}</p> : <div className="skeleton" style={{ marginTop: 8, height: 28 }} />}
          </div>
        ))}
        <div className="card stat">
          <p className="label">Sales recorded</p>
          {data ? <p className="value num">{data.sales_count}</p> : <div className="skeleton" style={{ marginTop: 8, height: 28 }} />}
        </div>
      </div>
      <section className="card">
        <div className="section-head">
          <h2>Running low</h2>
          {data && <span className="muted">{data.low_stock.length} item{data.low_stock.length === 1 ? "" : "s"}</span>}
        </div>
        {!data && !error && <div className="skeleton" />}
        {data && data.low_stock.length === 0 && <p className="empty">Nothing is running low. Nice.</p>}
        {data?.low_stock.map((p) => (
          <div className="row" key={p.id}>
            <div>
              <p className="name">{p.name}</p>
              <small>{p.sku} · reorder at {p.reorder_level}</small>
            </div>
            <span className={`badge ${p.stock === 0 ? "bad" : "warn"}`}>{p.stock === 0 ? "Out of stock" : `${p.stock} left`}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
