import { type FormEvent, useState } from "react";
import { api, token } from "../api";
import { Mark } from "../ui";

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
      <section className="hero">
        <div className="brand"><Mark />ShopTally</div>
        <h1>Know what you sold, and that every MoMo payment came in.</h1>
        <p>Record sales at the counter, watch your stock, and check the day's MoMo statement against your receipts.</p>
      </section>

      <div className="panel">
        <h2>{mode === "login" ? "Sign in to your shop" : "Set up your shop"}</h2>
        <form className="form" onSubmit={submit}>
          {mode === "register" && (
            <label>Shop name<input value={shop} onChange={(e) => setShop(e.target.value)} required minLength={2} autoComplete="organization" /></label>
          )}
          <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" autoCapitalize="none" autoCorrect="off" /></label>
          <label>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
              autoComplete={mode === "login" ? "current-password" : "new-password"} />
          </label>
          {error && <p className="note error" role="alert">{error}</p>}
          <button className="btn primary block" disabled={busy}>{busy ? "Signing in" : mode === "login" ? "Sign in" : "Create shop"}</button>
        </form>
        <p className="or">or</p>
        <button className="btn dark block" disabled={busy} onClick={(e) => submit(e, true)}>Try the demo shop</button>
        <p className="muted small-center">The demo shop has made-up products and sales, so you can try everything safely.</p>
        <p className="small-center">
          {mode === "login" ? "New here?" : "Have an account?"}
          <button className="btn link" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
            {mode === "login" ? "Create a shop" : "Sign in"}
          </button>
        </p>
      </div>
      <p className="foot"><a href="#privacy">How ShopTally uses your data</a></p>
    </div>
  );
}
