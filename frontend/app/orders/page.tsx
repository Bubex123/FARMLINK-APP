"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, type ApiUser } from "../lib/api";

type Order = {
  id: string; orderNumber: string; buyerId: string; quantity: number; unitPrice: number | string;
  totalPrice: number | string; deliveryFee: number | string; status: string;
  paymentStatus: string; deliveryAddress: string; deliveryCity: string; deliveryPhone: string;
  specialInstructions?: string; createdAt: string; updatedAt?: string;
  product?: { id?: string; name: string; unit?: string };
  seller?: { farmName: string; phone?: string; email?: string };
};
type PageResult = { data: Order[]; total: number };
type Filter = "all" | "active" | "delivered" | "cancelled";
const steps = ["pending", "confirmed", "shipped", "delivered"];
const labels: Record<string, string> = {
  pending: "Order received", confirmed: "Farmer accepted", shipped: "On the way",
  delivered: "Delivered", rejected: "Declined by farmer", cancelled: "Cancelled",
};
const money = (value: number | string) => `TSh ${Number(value || 0).toLocaleString("en-US")}`;
const basketKey = "farmlinkBasket";

export default function CustomerOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [notice, setNotice] = useState("");
  const [basketCount, setBasketCount] = useState(0);
  const [cashInfoOrder, setCashInfoOrder] = useState<string | null>(null);

  const refresh = useCallback(async (token: string, manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const result = await apiRequest<PageResult>("/orders/mine?limit=100&offset=0", {}, token);
      setOrders(result.data || []);
      setLastUpdated(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your orders.");
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    let account: ApiUser | null = null;
    try { account = JSON.parse(localStorage.getItem("user") || "null") as ApiUser | null; } catch { /* invalid session */ }
    if (!token || account?.role !== "buyer") { router.replace(token ? "/" : "/login?next=%2Forders"); return; }
    const syncBasketCount = () => {
      try {
        const basket = JSON.parse(localStorage.getItem(basketKey) || "{}") as Record<string, number>;
        setBasketCount(Object.values(basket).reduce((sum, quantity) => sum + Number(quantity || 0), 0));
      } catch { setBasketCount(0); }
    };
    syncBasketCount();
    window.addEventListener("storage", syncBasketCount);
    window.addEventListener("focus", syncBasketCount);
    void refresh(token);
    const timer = window.setInterval(() => void refresh(token), 30000);
    return () => { window.clearInterval(timer); window.removeEventListener("storage", syncBasketCount); window.removeEventListener("focus", syncBasketCount); };
  }, [refresh, router]);

  const filteredOrders = useMemo(() => orders.filter((order) => {
    if (filter === "active") return ["pending", "confirmed", "shipped"].includes(order.status);
    if (filter === "delivered") return order.status === "delivered";
    if (filter === "cancelled") return ["cancelled", "rejected"].includes(order.status);
    return true;
  }), [filter, orders]);

  const totalSpent = orders.filter((order) => !["cancelled", "rejected"].includes(order.status))
    .reduce((sum, order) => sum + Number(order.totalPrice || 0), 0);
  const itemCount = orders.filter((order) => !["cancelled", "rejected"].includes(order.status))
    .reduce((sum, order) => sum + Number(order.quantity || 0), 0);
  const activeCount = orders.filter((order) => ["pending", "confirmed", "shipped"].includes(order.status)).length;
  const deliveredCount = orders.filter((order) => order.status === "delivered").length;

  function buyAgain(order: Order) {
    if (!order.product?.id) {
      setNotice("This product is no longer available in the catalogue. Browse current listings to order again.");
      window.setTimeout(() => setNotice(""), 4500);
      return;
    }
    let basket: Record<string, number> = {};
    try { basket = JSON.parse(localStorage.getItem(basketKey) || "{}") as Record<string, number>; } catch { /* replace malformed basket */ }
    basket[order.product.id] = (basket[order.product.id] || 0) + order.quantity;
    localStorage.setItem(basketKey, JSON.stringify(basket));
    router.push("/checkout");
  }

  function askForHelp(order: Order) {
    const subject = `Help with FarmLink order ${order.orderNumber}`;
    const body = `Order number: ${order.orderNumber}\nProduct: ${order.product?.name || "Farm product"}\nFarmer: ${order.seller?.farmName || "FarmLink farmer"}\nStatus: ${labels[order.status] || order.status}\n\nHow can we help?`;
    window.location.href = `mailto:hello@farmlink.co.tz?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  return <main className="customer-orders-page">
    <header className="site-header"><div className="nav-shell"><Link href="/" className="brand"><span className="brand-mark">F</span><span>FarmLink</span></Link><nav className="main-nav" aria-label="Customer navigation"><Link href="/">Home</Link><Link href="/#marketplace">Marketplace</Link><Link href="/farmer/dashboard">Farmers</Link><Link href="/logistics">Logistics</Link><Link href="/order-by-phone">Order by phone</Link></nav><Link href="/logistics" className="customer-logistics-shortcut">Logistics</Link><Link href="/#marketplace" className="customer-back">← &nbsp; Back to marketplace</Link></div></header>
    <section className="customer-orders-shell">
      <div className="customer-orders-heading"><div><span className="eyebrow">YOUR FARM TO DOOR</span><h1>Your orders, basket and delivery in one place</h1><p>See what you’ve ordered, follow delivery updates and shop again when you’re ready.</p></div><button className="customer-refresh" type="button" disabled={refreshing} onClick={() => { const token = localStorage.getItem("accessToken"); if (token) void refresh(token, true); }}>{refreshing ? "Refreshing…" : "↻ Refresh orders"}</button></div>
      <div className="customer-order-metrics"><article><span>Orders placed</span><strong>{loading ? "—" : orders.length}</strong><small>All time</small></article><article><span>Order value</span><strong>{loading ? "—" : money(totalSpent)}</strong><small>Excludes declined or cancelled orders</small></article><article><span>Items ordered</span><strong>{loading ? "—" : itemCount}</strong><small>Across your active and past orders</small></article><article><span>On the way</span><strong>{loading ? "—" : activeCount}</strong><small>{deliveredCount} delivered</small></article></div>
      <div className="customer-order-toolbar"><div className="customer-order-filters" role="group" aria-label="Filter orders">{([ ["all", "All orders"], ["active", "In progress"], ["delivered", "Delivered"], ["cancelled", "Cancelled"] ] as [Filter, string][]).map(([value, text]) => <button key={value} type="button" className={filter === value ? "selected" : ""} aria-pressed={filter === value} onClick={() => setFilter(value)}>{text}<span>{value === "all" ? orders.length : value === "active" ? activeCount : value === "delivered" ? deliveredCount : orders.filter((order) => ["cancelled", "rejected"].includes(order.status)).length}</span></button>)}</div><Link className="customer-basket-link" href={basketCount > 0 ? "/checkout" : "/#marketplace"}>{basketCount > 0 ? `View basket · ${basketCount} item${basketCount === 1 ? "" : "s"}` : "＋ Shop for more"}</Link></div>
      {lastUpdated && <p className="customer-orders-updated">Last checked at {lastUpdated} · Orders refresh automatically.</p>}
      {error && <div className="customer-orders-error" role="alert"><span>{error}</span><button type="button" onClick={() => { const token = localStorage.getItem("accessToken"); if (token) void refresh(token, true); }}>Try again</button></div>}
      {loading ? <div className="customer-orders-empty" role="status">Loading your orders…</div> : filteredOrders.length === 0 ? <div className="customer-orders-empty"><strong>{orders.length === 0 ? "Your order list is empty" : "No orders in this filter"}</strong><p>{orders.length === 0 ? "When you place an order, its status and delivery updates will appear here." : "Choose another status filter to see your orders."}</p>{orders.length === 0 && <Link className="button button-green" href="/#marketplace">Browse marketplace</Link>}</div> : <div className="customer-order-list">{filteredOrders.map((order) => {
        const completed = steps.indexOf(order.status);
        const terminal = order.status === "rejected" || order.status === "cancelled";
        return <article className="customer-order-card" key={order.id}>
          <div className="customer-order-top"><div><span className="customer-order-number">ORDER {order.orderNumber}</span><h2>{order.product?.name || "Farm product"}</h2><p>{order.seller?.farmName || "FarmLink farmer"} · {order.quantity} {order.product?.unit || "units"} · {new Date(order.createdAt).toLocaleDateString()}</p></div><span className={`order-status order-${order.status}`}>{labels[order.status] || order.status}</span></div>
          {!terminal ? <div className="customer-order-progress">{steps.map((step, index) => <div className={`customer-progress-step ${completed >= index ? "complete" : ""}`} key={step}><span>{completed >= index ? "✓" : index + 1}</span><small>{labels[step]}</small></div>)}</div> : <p className="customer-order-terminal">{labels[order.status] || order.status}. Contact FarmLink if you need help.</p>}
          <div className="customer-order-summary"><span><small>ORDER TOTAL</small><strong>{money(order.totalPrice)}</strong></span><span><small>DELIVER TO</small><strong>{order.deliveryCity}</strong></span><span><small>PAYMENT</small><strong>{order.paymentStatus === "cash_on_delivery" ? "Cash on delivery" : order.paymentStatus || "Cash on delivery"}</strong></span></div>
          <button className="customer-cash-payment-button" type="button" aria-expanded={cashInfoOrder === order.id} onClick={() => setCashInfoOrder((current) => current === order.id ? null : order.id)}>Cash payment · Pay on delivery <span aria-hidden="true">{cashInfoOrder === order.id ? "−" : "+"}</span></button>
          {cashInfoOrder === order.id && <p className="customer-cash-payment-info" role="status">No advance payment is needed. Pay {money(order.totalPrice)} in cash directly to the farmer when this order arrives. FarmLink does not collect the cash.</p>}
          <details className="customer-order-more"><summary>Delivery and order details</summary><div><span>Address<strong>{order.deliveryAddress}, {order.deliveryCity}</strong></span><span>Phone<strong>{order.deliveryPhone}</strong></span><span>Farmer<strong>{order.seller?.farmName || "FarmLink farmer"}</strong></span>{Number(order.deliveryFee) > 0 && <span>Delivery fee<strong>{money(order.deliveryFee)}</strong></span>}{order.specialInstructions && <span>Note<strong>{order.specialInstructions}</strong></span>}</div></details>
          <div className="customer-order-actions"><Link className="customer-track-button" href={`/logistics?order=${encodeURIComponent(order.orderNumber)}#track`}>Track delivery</Link><button type="button" onClick={() => buyAgain(order)}>Buy again</button><button type="button" className="customer-help-button" onClick={() => askForHelp(order)}>Get help</button>{order.seller?.phone && <a href={`tel:${order.seller.phone}`}>Call farmer</a>}</div>
        </article>;
      })}</div>}
      <div className="customer-order-bottom"><div><strong>Need help with a delivery?</strong><p>Contact FarmLink support and include your order number.</p></div><a className="button customer-help-cta" href="mailto:hello@farmlink.co.tz?subject=Help%20with%20a%20FarmLink%20delivery">Contact FarmLink</a></div>
    </section>
    {notice && <div className="toast" role="status"><span>✓</span>{notice}</div>}
    <footer className="account-footer"><div className="customer-orders-shell account-footer-inner"><span>© 2026 FarmLink</span><span>Made for Tanzania, with care ♥</span><Link href="/order-by-phone">Need help ordering?</Link></div></footer>
  </main>;
}
