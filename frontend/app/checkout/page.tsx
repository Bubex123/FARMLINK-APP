"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { apiRequest, normalizeTanzanianPhone } from "../lib/api";

type Basket = Record<string, number>;
type Product = { id: string; name: string; price: number | string; quantity: number; unit: string; seller?: { farmName?: string } };
type ProductPage = { data: Product[] };
type Profile = { phone?: string; address?: string; city?: string };
type CreatedOrder = { id: string; orderNumber: string; totalPrice: number | string };
const BASKET_KEY = "farmlinkBasket";
const money = (value: number | string) => `TSh ${Number(value || 0).toLocaleString("en-US")}`;

export default function CheckoutPage() {
  const router = useRouter();
  const [items, setItems] = useState<Product[]>([]);
  const [basket, setBasket] = useState<Basket>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [orders, setOrders] = useState<CreatedOrder[]>([]);
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [instructions, setInstructions] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    let account: { role?: string } | null = null;
    try { account = JSON.parse(localStorage.getItem("user") || "null") as { role?: string } | null; } catch { /* invalid stored session */ }
    if (!token || account?.role !== "buyer") {
      router.replace(token ? "/" : "/login?next=%2Fcheckout");
      return;
    }

    let active = true;
    try {
      const savedBasket = JSON.parse(localStorage.getItem(BASKET_KEY) || "{}") as Basket;
      if (active) setBasket(savedBasket);
    } catch { localStorage.removeItem(BASKET_KEY); }

    Promise.all([
      apiRequest<ProductPage>("/products?limit=48&offset=0", {}, token),
      apiRequest<Profile>("/users/me", {}, token).catch(() => ({} as Profile)),
    ]).then(([productPage, profile]) => {
      if (!active) return;
      const savedBasket = JSON.parse(localStorage.getItem(BASKET_KEY) || "{}");
      setItems((productPage.data || []).filter((product) => Number(savedBasket[product.id]) > 0));
      setPhone(profile.phone || ""); setAddress(profile.address || ""); setCity(profile.city || "");
      if (!Object.keys(savedBasket).length) setError("Your basket is empty. Browse the marketplace and add products first.");
    }).catch((requestError) => {
      if (active) setError(requestError instanceof Error ? requestError.message : "Could not load your basket. Check your connection and try again.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [router]);

  const total = items.reduce((sum, product) => sum + Number(product.price) * (basket[product.id] || 0), 0);

  async function placeOrders(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = localStorage.getItem("accessToken");
    if (!token) { router.replace("/login?next=%2Fcheckout"); return; }
    setSubmitting(true); setError("");
    const form = new FormData(event.currentTarget);
    const completed: CreatedOrder[] = [];
    const failed: string[] = [];
    const failedProductIds = new Set<string>();

    for (const product of items) {
      try {
        const order = await apiRequest<CreatedOrder>("/orders", {
          method: "POST",
          body: JSON.stringify({
            productId: product.id,
            quantity: basket[product.id],
            deliveryAddress: String(form.get("address") || "").trim(),
            deliveryCity: String(form.get("city") || "").trim(),
            deliveryPhone: normalizeTanzanianPhone(String(form.get("phone") || "")),
            specialInstructions: String(form.get("instructions") || "").trim() || undefined,
          }),
        }, token);
        completed.push(order);
      } catch (requestError) {
        failedProductIds.add(product.id);
        failed.push(`${product.name}: ${requestError instanceof Error ? requestError.message : "Order could not be submitted."}`);
      }
    }

    setOrders(completed);
    const remaining = Object.fromEntries(Object.entries(basket).filter(([id]) => failedProductIds.has(id)));
    setBasket(remaining);
    localStorage.setItem(BASKET_KEY, JSON.stringify(remaining));
    setItems((current) => current.filter((item) => failedProductIds.has(item.id)));
    if (failed.length) setError(`${completed.length} order${completed.length === 1 ? " was" : "s were"} placed. Some items could not be ordered: ${failed.join("; ")}`);
    else if (!completed.length) setError("No items were available to order. Return to the marketplace and try again.");
    setSubmitting(false);
  }

  return <main className="checkout-page">
    <header className="site-header"><div className="nav-shell"><Link href="/" className="brand"><span className="brand-mark">F</span><span>FarmLink</span></Link><Link href="/" className="checkout-back">← Back to marketplace</Link></div></header>
    <section className="checkout-shell">
      <div className="checkout-heading"><span className="eyebrow">SECURE CHECKOUT</span><h1>Where should we deliver?</h1><p>Your order is sent directly to the farmer. You’ll pay cash when it arrives.</p></div>
      {orders.length > 0 && <div className="checkout-confirmation" role="status"><span>✓</span><div><strong>{orders.length === 1 ? "Your order has been placed" : `${orders.length} orders have been placed`}</strong><p>{orders.map((order) => order.orderNumber).join(" · ")}</p><small>Pay cash on delivery. You can return to the marketplace below.</small><Link className="checkout-track-order" href="/orders">Track your order status →</Link></div></div>}
      {error && <div className="checkout-alert" role="alert">{error}</div>}
      {loading ? <div className="checkout-loading">Loading your basket…</div> : <div className="checkout-layout">
        <form className="checkout-form" onSubmit={placeOrders}>
          <div className="checkout-panel"><div className="checkout-panel-title"><span>01</span><div><strong>Delivery details</strong><small>Let the farmer know where to bring your order.</small></div></div>
            <label>Delivery address<input required name="address" minLength={5} maxLength={255} value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Street, building, or village" /></label>
            <label>City or district<input required name="city" minLength={2} maxLength={100} value={city} onChange={(event) => setCity(event.target.value)} placeholder="e.g. Dar es Salaam" /></label>
            <label>Phone number<input required name="phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+255 7XX XXX XXX" /></label>
            <label>Note for the farmer <span className="optional-label">Optional</span><textarea name="instructions" rows={3} maxLength={1000} value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="Delivery directions or a note about your order" /></label>
          </div>
          <div className="checkout-panel checkout-items"><div className="checkout-panel-title"><span>02</span><div><strong>Your items</strong><small>Orders are placed separately with each farmer.</small></div></div>
            {items.map((product) => <div className="checkout-item" key={product.id}><div><strong>{product.name}</strong><small>{product.seller?.farmName || "Local farmer"} · {basket[product.id]} × {money(product.price)} / {product.unit}</small></div><b>{money(Number(product.price) * (basket[product.id] || 0))}</b></div>)}
            {items.length === 0 && <p className="checkout-empty">There are no remaining items to submit.</p>}
            <div className="checkout-total"><span>Order total</span><strong>{money(total)}</strong></div>
          </div>
          <button className="button button-green checkout-submit" disabled={submitting || items.length === 0}>{submitting ? "Placing your order…" : `Place ${items.length > 1 ? "orders" : "order"} · ${money(total)}`}</button>
        </form>
        <aside className="checkout-help"><span>✓</span><strong>Pay on delivery</strong><p>No advance payment is required. Pay the farmer when your order arrives.</p><div><b>Questions?</b><a href="mailto:hello@farmlink.co.tz">Contact FarmLink support</a></div></aside>
      </div>}
      <Link className="button button-green checkout-continue" href="/#marketplace">Browse the marketplace <span aria-hidden="true">→</span></Link>
    </section>
  </main>;
}
