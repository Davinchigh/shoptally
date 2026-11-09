const BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
const TOKEN_KEY = "shoptally.token";

export type Product = { id: number; name: string; sku: string; price_pesewas: number; stock: number; reorder_level: number; low_stock: boolean };
export type SaleItem = { product_id: number; quantity: number; unit_price_pesewas: number };
export type Sale = { id: number; payment_method: "cash" | "momo"; momo_reference: string | null; customer_phone: string | null; total_pesewas: number; created_at: string; items: SaleItem[] };
export type Daily = { date: string; sales_count: number; cash_pesewas: number; momo_pesewas: number; total_pesewas: number; low_stock: Product[] };
export type Match = { sale_id: number; transaction_id: string; amount_pesewas: number; method: string; minutes_apart: number };
export type Flag = {
  kind: "unrecorded_payment" | "missing_payment" | "amount_mismatch" | "duplicate_transaction";
  message: string;
  sale_id: number | null;
  transaction_id: string | null;
  expected_pesewas: number | null;
  received_pesewas: number | null;
};
export type Reconciliation = {
  period_start: string | null;
  period_end: string | null;
  statement_rows: number;
  skipped_rows: string[];
  momo_sales_count: number;
  expected_pesewas: number;
  received_pesewas: number;
  matched_pesewas: number;
  difference_pesewas: number;
  matches: Match[];
  exceptions: Flag[];
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const token = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (t: string) => { try { localStorage.setItem(TOKEN_KEY, t); } catch { /* private mode */ } },
  clear: () => { try { localStorage.removeItem(TOKEN_KEY); } catch { /* private mode */ } },
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const t = token.get();
  if (t) headers.set("Authorization", `Bearer ${t}`);
  if (init.body && !(init.body instanceof FormData) && !(init.body instanceof URLSearchParams)) {
    headers.set("Content-Type", "application/json");
  }
  let res: Response;
  try {
    res = await fetch(BASE + path, { ...init, headers });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }
  if (!res.ok) {
    let message = `Something went wrong (${res.status}).`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") message = body.detail;
      else if (Array.isArray(body.detail)) message = body.detail.map((d: { msg: string }) => d.msg).join("; ");
    } catch { /* not json */ }
    if (res.status === 401) token.clear();
    throw new ApiError(res.status, message);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export const api = {
  login: (email: string, password: string) =>
    request<{ access_token: string }>("/api/auth/login", { method: "POST", body: new URLSearchParams({ username: email, password }) }),
  register: (shop_name: string, email: string, password: string) =>
    request<{ access_token: string }>("/api/auth/register", { method: "POST", body: JSON.stringify({ shop_name, email, password }) }),
  me: () => request<{ id: number; name: string; email: string }>("/api/auth/me"),
  products: () => request<Product[]>("/api/products"),
  addProduct: (p: { name: string; sku: string; price_pesewas: number; stock: number; reorder_level: number }) =>
    request<Product>("/api/products", { method: "POST", body: JSON.stringify(p) }),
  restock: (id: number, quantity: number) =>
    request<Product>(`/api/products/${id}/restock`, { method: "POST", body: JSON.stringify({ quantity }) }),
  sell: (body: { items: { product_id: number; quantity: number }[]; payment_method: "cash" | "momo"; momo_reference?: string }) =>
    request<{ id: number; total_pesewas: number }>("/api/sales", { method: "POST", body: JSON.stringify(body) }),
  sales: (start: string, end: string) =>
    request<Sale[]>(`/api/sales?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&limit=500`),
  daily: (day?: string) => request<Daily>(`/api/reports/daily${day ? `?day=${day}` : ""}`),
  reconcile: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<Reconciliation>("/api/reconciliation", { method: "POST", body: form });
  },
};
