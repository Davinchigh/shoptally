import { useEffect, useState } from "react";
import { api, token } from "./api";
import Login from "./pages/Login";
import Reconcile from "./pages/Reconcile";
import Sell from "./pages/Sell";
import Stock from "./pages/Stock";
import Today from "./pages/Today";

// The demo shop's sales and the sample MoMo statement are both from this day.
const DEMO_DAY = "2026-11-05";

type Tab = "today" | "sell" | "stock" | "reconcile";

const ICONS: Record<Tab, string> = {
  today: "M4 13h4v7H4zM10 8h4v12h-4zM16 4h4v16h-4z",
  sell: "M6 6h15l-1.5 9h-12zM6 6 5 3H2M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM18 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
  stock: "M3 7l9-4 9 4-9 4zM3 7v10l9 4 9-4V7M12 11v10",
  reconcile: "M4 7h11l-3-3M20 17H9l3 3",
};
const LABELS: Record<Tab, string> = { today: "Today", sell: "Sell", stock: "Stock", reconcile: "Reconcile" };

function tabFromHash(): Tab {
  const h = window.location.hash.replace("#", "") as Tab;
  return h in LABELS ? h : "today";
}

export default function App() {
  const [authed, setAuthed] = useState(Boolean(token.get()));
  const [shopName, setShopName] = useState("");
  const [isDemo, setIsDemo] = useState(false);
  const [tab, setTab] = useState<Tab>(tabFromHash);
  const [version, setVersion] = useState(0); // bump to refresh screens after a sale or restock

  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (!authed) return;
    api.me().then((s) => { setShopName(s.name); setIsDemo(s.email === "demo@shoptally.app"); }).catch(() => setAuthed(Boolean(token.get())));
  }, [authed]);

  if (!authed) return <Login onDone={() => setAuthed(true)} />;

  const go = (t: Tab) => { window.location.hash = t; setTab(t); };
  const changed = () => setVersion((v) => v + 1);

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark" aria-hidden>₵</span>ShopTally</div>
        <nav className="tabs" aria-label="Main">
          {(Object.keys(LABELS) as Tab[]).map((t) => (
            <button key={t} className="tab" aria-current={tab === t ? "page" : undefined} onClick={() => go(t)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={ICONS[t]} />
              </svg>
              {LABELS[t]}
            </button>
          ))}
        </nav>
        <button className="button ghost" onClick={() => { token.clear(); setAuthed(false); }} title={shopName ? `Signed in as ${shopName}` : undefined}>
          Sign out
        </button>
      </header>
      <main>
        {tab === "today" && <Today key={`${version}-${isDemo}`} shopName={shopName} initialDay={isDemo ? DEMO_DAY : undefined} onSell={() => go("sell")} />}
        {tab === "sell" && <Sell key={version} onSold={changed} />}
        {tab === "stock" && <Stock key={version} onChanged={changed} />}
        {tab === "reconcile" && <Reconcile />}
      </main>
    </div>
  );
}
