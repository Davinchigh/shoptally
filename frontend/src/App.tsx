import { useEffect, useState } from "react";
import { api, token } from "./api";
import Login from "./pages/Login";
import Privacy from "./pages/Privacy";
import Reconcile from "./pages/Reconcile";
import Sell from "./pages/Sell";
import Stock from "./pages/Stock";
import Today from "./pages/Today";
import { Icon, Mark, useToast } from "./ui";

// The demo shop's sales and the sample MoMo statement are both from this day.
const DEMO_DAY = "2026-11-05";

type Tab = "today" | "sell" | "stock" | "reconcile";
const LABELS: Record<Tab, string> = { today: "Today", sell: "Sell", stock: "Stock", reconcile: "Reconcile" };
type Route = Tab | "privacy";

function routeFromHash(): Route {
  const h = window.location.hash.replace("#", "");
  return h === "privacy" || h in LABELS ? (h as Route) : "today";
}

export default function App() {
  const [authed, setAuthed] = useState(Boolean(token.get()));
  const [shopName, setShopName] = useState("");
  const [isDemo, setIsDemo] = useState(false);
  const [route, setRoute] = useState<Route>(routeFromHash);
  const [version, setVersion] = useState(0); // bump to refresh screens after a sale or restock
  const [toastNode, toast] = useToast();

  useEffect(() => {
    const onHash = () => { setRoute(routeFromHash()); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (!authed) return;
    api.me()
      .then((s) => { setShopName(s.name); setIsDemo(s.email === "demo@shoptally.app"); })
      .catch(() => setAuthed(Boolean(token.get())));
  }, [authed]);

  const back = () => { window.location.hash = authed ? "today" : ""; };
  if (route === "privacy") return <Privacy onBack={back} />;
  if (!authed) return <Login onDone={() => { setAuthed(true); window.location.hash = "today"; }} />;

  const tab: Tab = route as Tab;
  const go = (t: Tab) => { window.location.hash = t; };
  const changed = () => setVersion((v) => v + 1);

  return (
    <div className={`app${tab === "today" ? " has-cta" : ""}`}>
      <a className="skip" href="#main">Skip to content</a>
      <header className="masthead">
        <div className="brand"><Mark />ShopTally</div>
        {isDemo && <span className="chip-demo" title="Made-up products and sales for trying the app">Demo shop</span>}
        <button className="icon-btn" aria-label={shopName ? `Sign out of ${shopName}` : "Sign out"}
          onClick={() => { token.clear(); setAuthed(false); window.location.hash = ""; }}>
          <Icon name="out" />
        </button>
      </header>

      <main id="main">
        {tab === "today" && <Today key={`${version}-${isDemo}`} shopName={shopName} initialDay={isDemo ? DEMO_DAY : undefined} onSell={() => go("sell")} />}
        {tab === "sell" && <Sell key={version} onSold={(msg) => { changed(); toast(msg); }} />}
        {tab === "stock" && <Stock key={version} onChanged={(msg) => { changed(); toast(msg); }} />}
        {tab === "reconcile" && <Reconcile />}
      </main>

      <p className="foot"><a href="#privacy">How ShopTally uses your data</a></p>

      <nav className="tabbar" aria-label="Main">
        {(Object.keys(LABELS) as Tab[]).map((t) => (
          <button key={t} className="tab" aria-current={tab === t ? "page" : undefined} onClick={() => go(t)}>
            <span className="pill"><Icon name={t} /></span>
            {LABELS[t]}
          </button>
        ))}
      </nav>
      {toastNode}
    </div>
  );
}
