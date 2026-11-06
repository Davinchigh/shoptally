import { type FormEvent, useState } from "react";
import { api, token } from "../api";

export default function Login({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [shop, setShop] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent, demo = false) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = demo
        ? await api.login("demo@shoptally.app", "demo-pass-123")
        : mode === "login"
          ? await api.login(email, password)
          : await api.register(shop, email, password);
      token.set(res.access_token);
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <div className="card stack">
        <div className="brand"><span className="brand-mark" aria-hidden>₵</span>ShopTally</div>
        <div className="stack" style={{ gap: 6 }}>
          <h1>{mode === "login" ? "Welcome back" : "Set up your shop"}</h1>
          <p className="muted">Record sales, watch your stock and check every MoMo payment against what you sold.</p>
        </div>
        <form className="form" onSubmit={submit}>
          {mode === "register" && (
            <label>Shop name<input value={shop} onChange={(e) => setShop(e.target.value)} required minLength={2} autoComplete="organization" /></label>
          )}
          <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></label>
          <label>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
              autoComplete={mode === "login" ? "current-password" : "new-password"} />
          </label>
          {error && <p className="notice error" role="alert">{error}</p>}
          <button className="button block" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create shop"}</button>
        </form>
        <button className="button secondary block" disabled={busy} onClick={(e) => submit(e, true)}>Try the demo shop</button>
        <p className="muted" style={{ textAlign: "center" }}>
          {mode === "login" ? "New here? " : "Have an account? "}
          <button className="button ghost" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
            {mode === "login" ? "Create a shop" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
