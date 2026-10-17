"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, type ApiUser } from "../lib/api";

type Order = {
  id: string; orderNumber: string; quantity: number; unitPrice: number | string;
  totalPrice: number | string; deliveryFee: number | string; status: string;
  paymentStatus: string; deliveryAddress: string; deliveryCity: string; createdAt: string;
  updatedAt?: string; product?: { name: string; unit?: string };
  seller?: { farmName: string };
};
type PageResult = { data: Order[]; total: number };

const steps = ["pending", "confirmed", "shipped", "delivered"];
const labels: Record<string, string> = {
  pending: "Waiting for farmer", confirmed: "Farmer accepted", shipped: "On the way",
  delivered: "Delivered", rejected: "Declined by farmer", cancelled: "Cancelled",
};
const money = (value: number | string) => `TSh ${Number(value || 0).toLocaleString("en-US")}`;

export default function CustomerOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

  const refresh = useCallback(async (token: string) => {
    try {
      const result = await apiRequest<PageResult>("/orders/mine?limit=100&offset=0", {}, token);
      setOrders(result.data || []);
      setLastUpdated(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your orders.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    let account: ApiUser | null = null;
    try { account = JSON.parse(localStorage.getItem("user") || "null") as ApiUser | null; } catch { /* invalid session */ }
    if (!token || account?.role !== "buyer") { router.replace(token ? "/" : "/login"); return; }
    void refresh(token);
    const timer = window.setInterval(() => void refresh(token), 15000);
    return () => window.clearInterval(timer);
  }, [refresh, router]);

  return <main className="customer-orders-page">
    <header className="site-header"><div className="nav-shell"><Link href="/" className="brand"><span className="brand-mark">F</span><span>FarmLink</span></Link><Link href="/" className="customer-back">← &nbsp; Back to marketplace</Link></div></header>
    <section className="customer-orders-shell">
      <div className="customer-orders-heading"><div><span className="eyebrow">YOUR FARM TO DOOR</span><h1>My orders</h1><p>See when the farmer accepts your order and when it is on the way.</p></div><button className="customer-refresh" onClick={() => { const token = localStorage.getItem("accessToken"); if (token) void refresh(token); }}>↻ &nbsp; Refresh</button></div>
      {lastUpdated && <p className="customer-orders-updated">Status checked at {lastUpdated}. This page refreshes automatically.</p>}
      {error && <div className="customer-orders-error" role="alert">{error}</div>}
      {loading ? <div className="customer-orders-empty">Loading your orders…</div> : orders.length === 0 ? <div className="customer-orders-empty"><strong>No orders yet</strong><p>When you place an order, you can follow its progress here.</p><Link className="button button-green" href="/#marketplace">Browse the marketplace</Link></div> : <div className="customer-order-list">{orders.map((order) => {
        const completed = steps.indexOf(order.status);
        const terminal = order.status === "rejected" || order.status === "cancelled";
        return <article className="customer-order-card" key={order.id}>
          <div className="customer-order-top"><div><span className="customer-order-number">{order.orderNumber}</span><h2>{order.product?.name || "Farm product"}</h2><p>{order.seller?.farmName || "FarmLink farmer"} · {order.quantity} {order.product?.unit || "units"}</p></div><span className={`order-status order-${order.status}`}>{labels[order.status] || order.status}</span></div>
          {!terminal ? <div className="customer-order-progress">{steps.map((step, index) => <div className={`customer-progress-step ${completed >= index ? "complete" : ""}`} key={step}><span>{completed >= index ? "✓" : index + 1}</span><small>{labels[step]}</small></div>)}</div> : <p className="customer-order-terminal">{labels[order.status] || order.status}. Contact FarmLink support if you need help.</p>}
          <div className="customer-order-details"><span>Total <strong>{money(order.totalPrice)}</strong></span><span>Delivery to <strong>{order.deliveryCity}</strong></span><span>Placed <strong>{new Date(order.createdAt).toLocaleDateString()}</strong></span></div>
        </article>;
      })}</div>}
      <Link className="button button-green customer-orders-shopping" href="/#marketplace">Browse the marketplace <span aria-hidden="true">→</span></Link>
    </section>
  </main>;
}
