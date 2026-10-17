"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiRequest, type ApiUser } from "../../lib/api";

type Section = "overview" | "users" | "farmers" | "products" | "orders" | "payments";
type PageResult<T> = { data: T[]; total: number };
type Overview = {
  totalUsers: number; customers: number; sellerAccounts: number; totalFarmers: number;
  pendingFarmers: number; verifiedFarmers: number; totalProducts: number; totalOrders: number;
  pendingOrders: number; deliveredOrders: number; pendingPayments: number; completedPayments: number;
  completedPaymentAmount: number;
};
type AdminUser = ApiUser & { phone: string; createdAt: string };
type AdminFarmer = {
  id: string; farmName: string; contactPerson: string; phone: string; email?: string;
  city: string; region: string; verificationStatus: string; rating: number | string;
  totalOrders: number; totalReviews: number; createdAt: string;
  user?: { id: string; firstName: string; lastName: string; email: string; phone: string };
};
type AdminProduct = {
  id: string; name: string; category: string; price: number | string; quantity: number;
  unit: string; isActive: boolean; createdAt: string; seller?: { id: string; farmName: string };
};
type AdminOrder = {
  id: string; orderNumber: string; quantity: number; totalPrice: number | string; deliveryFee: number | string;
  status: string; paymentStatus: string; deliveryAddress: string; deliveryCity: string; deliveryPhone: string;
  createdAt: string; buyer?: { firstName: string; lastName: string; email: string; phone: string };
  seller?: { farmName: string; email?: string; phone?: string };
  product?: { id: string; name: string; category: string; unit: string };
};
type AdminPayment = {
  id: string; orderId: string; amount: number | string; method: string; transactionId: string;
  paymentStatus: string; escrowStatus: string; payerPhone?: string; createdAt: string;
  order?: { orderNumber: string; buyer?: { firstName: string; lastName: string; email: string; phone: string }; seller?: { farmName: string } };
};

const sections: { id: Section; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "▦" }, { id: "users", label: "Users", icon: "♙" },
  { id: "farmers", label: "Farmers", icon: "♧" }, { id: "products", label: "Products", icon: "◫" },
  { id: "orders", label: "Orders", icon: "▤" }, { id: "payments", label: "Payments", icon: "◉" },
];
const money = (value: number | string) => `TSh ${Number(value || 0).toLocaleString("en-US")}`;
const date = (value: string) => new Date(value).toLocaleDateString("en-TZ", { day: "numeric", month: "short", year: "numeric" });
const title = (value: string) => value ? value.charAt(0).toUpperCase() + value.slice(1) : "—";
const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

export default function AdminDashboard() {
  const router = useRouter();
  const [section, setSection] = useState<Section>("overview");
  const [user, setUser] = useState<ApiUser | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [farmers, setFarmers] = useState<AdminFarmer[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [workingFarmer, setWorkingFarmer] = useState("");
  const [today, setToday] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [userRole, setUserRole] = useState("all");
  const [farmerStatus, setFarmerStatus] = useState("all");
  const [farmerSort, setFarmerSort] = useState("rating");
  const [productSearch, setProductSearch] = useState("");
  const [orderStatus, setOrderStatus] = useState("all");
  const [paymentStatus, setPaymentStatus] = useState("all");

  const loadData = useCallback(async (token: string) => {
    setLoading(true);
    setError("");
    try {
      async function fetchAll<T>(path: string) {
        const separator = path.includes("?") ? "&" : "?";
        const first = await apiRequest<PageResult<T>>(`${path}${separator}limit=100&offset=0`, {}, token);
        const data = [...(first.data || [])];
        for (let offset = data.length; offset < first.total; offset += 100) {
          const next = await apiRequest<PageResult<T>>(`${path}${separator}limit=100&offset=${offset}`, {}, token);
          data.push(...(next.data || []));
          if (!next.data?.length) break;
        }
        return data;
      }
      const [stats, allUsers, allFarmers, allProducts, allOrders, allPayments] = await Promise.all([
        apiRequest<Overview>("/admin/overview", {}, token),
        fetchAll<AdminUser>("/users"),
        fetchAll<AdminFarmer>("/sellers/admin/all?sort=rating"),
        fetchAll<AdminProduct>("/products/admin/all"),
        fetchAll<AdminOrder>("/orders/admin/all"),
        fetchAll<AdminPayment>("/payments/admin/all"),
      ]);
      setOverview(stats); setUsers(allUsers); setFarmers(allFarmers);
      setProducts(allProducts); setOrders(allOrders); setPayments(allPayments);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load admin operations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setToday(new Date().toLocaleDateString("en-TZ", { weekday: "short", day: "numeric", month: "short" }));
    const token = localStorage.getItem("accessToken");
    let currentUser: ApiUser | null = null;
    try { const stored = localStorage.getItem("user"); currentUser = stored ? JSON.parse(stored) as ApiUser : null; }
    catch { localStorage.removeItem("user"); }
    if (!token || !currentUser) { router.replace("/login"); return; }
    if (currentUser.role !== "admin") { router.replace("/"); return; }
    setUser(currentUser);
    void loadData(token);
  }, [loadData, router]);

  const filteredUsers = useMemo(() => users.filter((item) => {
    const matchesRole = userRole === "all" || item.role === userRole;
    const haystack = `${item.firstName} ${item.lastName} ${item.email} ${item.phone}`.toLowerCase();
    return matchesRole && haystack.includes(userSearch.toLowerCase());
  }), [users, userRole, userSearch]);
  const filteredFarmers = useMemo(() => farmers.filter((item) => farmerStatus === "all" || item.verificationStatus === farmerStatus)
    .sort((a, b) => farmerSort === "rating" ? Number(b.rating) - Number(a.rating) : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [farmers, farmerStatus, farmerSort]);
  const filteredProducts = useMemo(() => products.filter((item) => `${item.name} ${item.category} ${item.seller?.farmName || ""}`.toLowerCase().includes(productSearch.toLowerCase())), [products, productSearch]);
  const filteredOrders = useMemo(() => orders.filter((item) => orderStatus === "all" || item.status === orderStatus), [orders, orderStatus]);
  const filteredPayments = useMemo(() => payments.filter((item) => paymentStatus === "all" || item.paymentStatus === paymentStatus), [payments, paymentStatus]);
  const soldByProduct = useMemo(() => orders.reduce<Record<string, number>>((map, order) => {
    if (order.product?.id && !["rejected", "cancelled"].includes(order.status)) map[order.product.id] = (map[order.product.id] || 0) + order.quantity;
    return map;
  }, {}), [orders]);

  async function reviewFarmer(farmer: AdminFarmer, status: "verified" | "rejected") {
    const token = localStorage.getItem("accessToken");
    if (!token) return router.replace("/login");
    setWorkingFarmer(farmer.id); setError(""); setNotice("");
    try {
      await apiRequest(`/sellers/${farmer.id}/verification`, { method: "PUT", body: JSON.stringify({ status }) }, token);
      setFarmers((current) => current.map((item) => item.id === farmer.id ? { ...item, verificationStatus: status } : item));
      setOverview((current) => current ? { ...current, pendingFarmers: Math.max(0, current.pendingFarmers - (farmer.verificationStatus === "pending" ? 1 : 0)), verifiedFarmers: current.verifiedFarmers + (status === "verified" && farmer.verificationStatus !== "verified" ? 1 : 0) } : current);
      setNotice(`${farmer.farmName} marked ${status}.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not update farmer approval.");
    } finally { setWorkingFarmer(""); }
  }

  function exportReport() {
    const popup = window.open("", "_blank", "width=1000,height=750");
    if (!popup) { setError("Allow pop-ups to export the report as PDF."); return; }
    const sectionTable = (heading: string, headers: string[], rows: unknown[][]) => `<h2>${escapeHtml(heading)}</h2><table><thead><tr>${headers.map((cell) => `<th>${escapeHtml(cell)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    const report = `<!doctype html><html><head><meta charset="utf-8"><title>FarmLink Operations Report</title><style>body{font:12px Arial,sans-serif;color:#243328;padding:28px}h1{font-size:24px}h2{margin:26px 0 8px;color:#315c37}p{color:#687364}table{width:100%;border-collapse:collapse;margin-bottom:15px}th,td{padding:7px;border:1px solid #d8dfd2;text-align:left}th{background:#edf2e9}.stats{display:flex;flex-wrap:wrap;gap:10px}.stat{padding:10px 13px;border:1px solid #d8dfd2;border-radius:8px}.stat b{display:block;font-size:17px;margin-top:4px}@media print{body{padding:0}h2{break-after:avoid}table{break-inside:auto}tr{break-inside:avoid}}</style></head><body><h1>FarmLink Operations Report</h1><p>Generated ${escapeHtml(new Date().toLocaleString())} · Prepared by ${escapeHtml(user?.firstName || "Admin")}</p><div class="stats">${[["Registered users", overview?.totalUsers], ["Farmers", overview?.totalFarmers], ["Pending farmer reviews", overview?.pendingFarmers], ["Products", overview?.totalProducts], ["Orders", overview?.totalOrders], ["Pending orders", overview?.pendingOrders], ["Pending payments", overview?.pendingPayments], ["Completed payments", money(overview?.completedPaymentAmount || 0)]].map(([label, value]) => `<div class="stat">${escapeHtml(label)}<b>${escapeHtml(value)}</b></div>`).join("")}</div>${sectionTable("Registered users", ["Name", "Role", "Email", "Phone", "Joined"], users.map((item) => [`${item.firstName} ${item.lastName}`, item.role, item.email, item.phone, date(item.createdAt)]))}${sectionTable("Farmers", ["Farm", "Owner", "Status", "Rating", "Region", "Email", "Phone"], farmers.map((item) => [item.farmName, item.contactPerson, item.verificationStatus, Number(item.rating || 0).toFixed(1), `${item.city}, ${item.region}`, item.email || item.user?.email || "", item.phone]))}${sectionTable("Products and sales", ["Product", "Farmer", "Category", "Price", "Stock", "Units ordered"], products.map((item) => [item.name, item.seller?.farmName || "—", item.category, money(item.price), `${item.quantity} ${item.unit}`, soldByProduct[item.id] || 0]))}${sectionTable("Orders", ["Order", "Buyer", "Farmer", "Product", "Status", "Total", "Placed"], orders.map((item) => [item.orderNumber, item.buyer ? `${item.buyer.firstName} ${item.buyer.lastName}` : "", item.seller?.farmName || "", item.product?.name || "", item.status, money(item.totalPrice), date(item.createdAt)]))}${sectionTable("Payments", ["Order", "Buyer", "Amount", "Method", "Payment status", "Escrow", "Transaction"], payments.map((item) => [item.order?.orderNumber || item.orderId, item.order?.buyer ? `${item.order.buyer.firstName} ${item.order.buyer.lastName}` : "", money(item.amount), item.method, item.paymentStatus, item.escrowStatus, item.transactionId]))}</body></html>`;
    popup.document.open(); popup.document.write(report); popup.document.close();
    popup.onload = () => { popup.focus(); popup.print(); };
  }

  function logout() {
    localStorage.removeItem("accessToken"); localStorage.removeItem("refreshToken"); localStorage.removeItem("user"); localStorage.removeItem("farmlinkBasket"); router.replace("/login?loggedOut=1");
  }

  const pageTitle = sections.find((item) => item.id === section)?.label || "Overview";

  return <main className="admin-app">
    <aside className="admin-sidebar">
      <Link href="/" className="admin-brand"><span>F</span><div>FarmLink<small>OPERATIONS</small></div></Link>
      <p className="admin-nav-label">WORKSPACE</p>
      <nav>{sections.map((item) => <button key={item.id} className={section === item.id ? "active" : ""} onClick={() => setSection(item.id)}><span>{item.icon}</span>{item.label}{item.id === "farmers" && (overview?.pendingFarmers || 0) > 0 && <i>{overview?.pendingFarmers}</i>}</button>)}</nav>
      <div className="admin-sidebar-bottom"><span>Signed in as</span><strong>{user ? `${user.firstName} ${user.lastName}` : "Admin"}</strong><button onClick={logout}>↪ &nbsp; Sign out</button></div>
    </aside>
    <section className="admin-main">
      <header className="admin-header"><div><span className="admin-breadcrumb">ADMINISTRATION / {pageTitle.toUpperCase()}</span><h1>{pageTitle}</h1></div><div className="admin-header-actions"><span className="admin-today">{today}</span><button className="admin-export" onClick={exportReport}>↓ &nbsp; Export PDF</button></div></header>
      {error && <div className="admin-alert admin-error" role="alert">{error}</div>}{notice && <div className="admin-alert admin-success" role="status">{notice}</div>}
      {loading ? <div className="admin-loading">Loading FarmLink operations…</div> : !overview ? <div className="admin-loading">Could not load admin data. Check the backend and try refreshing.</div> : <>
        {section === "overview" && <>
          <div className="admin-welcome"><div><h2>Good day{user ? `, ${user.firstName}` : ""}</h2><p>Here’s what’s happening across FarmLink.</p></div><button onClick={() => { const token = localStorage.getItem("accessToken"); if (token) void loadData(token); }}>↻ &nbsp; Refresh data</button></div>
          <div className="admin-metric-grid">
            <article className="admin-metric"><span>Registered users</span><strong>{overview.totalUsers.toLocaleString()}</strong><small>{overview.customers} customers · {overview.sellerAccounts} farmer accounts</small><i className="metric-icon">♙</i></article>
            <article className="admin-metric"><span>Farmers</span><strong>{overview.totalFarmers.toLocaleString()}</strong><small>{overview.verifiedFarmers} verified · {overview.pendingFarmers} awaiting review</small><i className="metric-icon metric-amber">♧</i></article>
            <article className="admin-metric"><span>Orders</span><strong>{overview.totalOrders.toLocaleString()}</strong><small>{overview.pendingOrders} pending · {overview.deliveredOrders} delivered</small><i className="metric-icon metric-blue">▤</i></article>
            <article className="admin-metric"><span>Completed payments</span><strong>{money(overview.completedPaymentAmount)}</strong><small>{overview.pendingPayments} payments pending · {overview.completedPayments} completed</small><i className="metric-icon metric-gold">◉</i></article>
          </div>
          <div className="admin-overview-grid">
            <section className="admin-card"><div className="admin-card-heading"><div><span className="admin-overline">REVIEW QUEUE</span><h2>Farmers awaiting approval</h2></div><button onClick={() => setSection("farmers")}>View all →</button></div>{farmers.filter((farmer) => farmer.verificationStatus === "pending").slice(0, 5).length ? farmers.filter((farmer) => farmer.verificationStatus === "pending").slice(0, 5).map((farmer) => <div className="admin-queue-row" key={farmer.id}><span className="admin-avatar">{farmer.farmName.slice(0, 1).toUpperCase()}</span><div><strong>{farmer.farmName}</strong><small>{farmer.contactPerson} · {farmer.region}</small></div><button onClick={() => setSection("farmers")}>Review</button></div>) : <div className="admin-empty">No farmer applications are waiting.</div>}</section>
            <section className="admin-card"><div className="admin-card-heading"><div><span className="admin-overline">LATEST ACTIVITY</span><h2>Recent orders</h2></div><button onClick={() => setSection("orders")}>All orders →</button></div>{orders.slice(0, 5).length ? orders.slice(0, 5).map((order) => <div className="admin-activity-row" key={order.id}><div><strong>{order.orderNumber}</strong><small>{order.product?.name || "Farm order"} · {order.seller?.farmName || "Farmer"}</small></div><span className={`admin-status status-${order.status}`}>{title(order.status)}</span><b>{money(order.totalPrice)}</b></div>) : <div className="admin-empty">No orders have been placed yet.</div>}</section>
          </div>
          <div className="admin-footnote">The dashboard refreshes when opened. Select <b>Refresh data</b> to fetch the latest activity.</div>
        </>}

        {section === "users" && <section className="admin-card admin-data-card"><div className="admin-card-heading"><div><span className="admin-overline">CUSTOMER AND ACCOUNT DIRECTORY</span><h2>Registered users <small>{users.length}</small></h2><p>Contact account holders directly by email or phone.</p></div></div><div className="admin-toolbar"><input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Search name, email or phone"/><select value={userRole} onChange={(event) => setUserRole(event.target.value)}><option value="all">All roles</option><option value="buyer">Customers</option><option value="seller">Farmers</option><option value="admin">Admins</option><option value="rider">Riders</option></select></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>User</th><th>Role</th><th>Contact</th><th>Joined</th></tr></thead><tbody>{filteredUsers.map((item) => <tr key={item.id}><td><strong>{item.firstName} {item.lastName}</strong></td><td><span className="admin-status">{title(item.role)}</span></td><td><a href={`mailto:${item.email}`}>{item.email}</a><small><a href={`tel:${item.phone}`}>{item.phone}</a></small></td><td>{date(item.createdAt)}</td></tr>)}</tbody></table>{filteredUsers.length === 0 && <div className="admin-empty">No users match your search.</div>}</div></section>}

        {section === "farmers" && <section className="admin-card admin-data-card"><div className="admin-card-heading"><div><span className="admin-overline">FARMER NETWORK</span><h2>Farmer applications <small>{farmers.length}</small></h2><p>Review applications, contact farmers, and compare ratings.</p></div></div><div className="admin-toolbar"><select value={farmerStatus} onChange={(event) => setFarmerStatus(event.target.value)}><option value="all">All statuses</option><option value="pending">Pending review</option><option value="verified">Verified</option><option value="rejected">Rejected</option><option value="suspended">Suspended</option></select><select value={farmerSort} onChange={(event) => setFarmerSort(event.target.value)}><option value="rating">Highest rated</option><option value="recent">Recently joined</option></select></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Farm and owner</th><th>Location</th><th>Rating</th><th>Orders</th><th>Status</th><th>Contact / action</th></tr></thead><tbody>{filteredFarmers.map((farmer) => <tr key={farmer.id}><td><strong>{farmer.farmName}</strong><small>{farmer.contactPerson}</small></td><td>{farmer.city}, {farmer.region}</td><td><b className="rating-value">★ {Number(farmer.rating || 0).toFixed(1)}</b><small>{farmer.totalReviews || 0} reviews</small></td><td>{farmer.totalOrders || 0}</td><td><span className={`admin-status status-${farmer.verificationStatus}`}>{title(farmer.verificationStatus)}</span></td><td className="admin-contact-cell">{(farmer.email || farmer.user?.email) && <a href={`mailto:${farmer.email || farmer.user?.email}`}>Email</a>}<a href={`tel:${farmer.phone}`}>Call</a>{farmer.verificationStatus === "pending" && <><button className="approve-button" disabled={workingFarmer === farmer.id} onClick={() => void reviewFarmer(farmer, "verified")}>{workingFarmer === farmer.id ? "Saving…" : "Approve"}</button><button className="reject-button" disabled={workingFarmer === farmer.id} onClick={() => void reviewFarmer(farmer, "rejected")}>Reject</button></>}</td></tr>)}</tbody></table>{filteredFarmers.length === 0 && <div className="admin-empty">No farmers match this status.</div>}</div></section>}

        {section === "products" && <section className="admin-card admin-data-card"><div className="admin-card-heading"><div><span className="admin-overline">MARKETPLACE CATALOG</span><h2>Products and farmer sales <small>{products.length}</small></h2><p>See every listing alongside orders placed for that product.</p></div></div><div className="admin-toolbar"><input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Search product, category or farm"/></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Product</th><th>Farmer</th><th>Category</th><th>Price</th><th>Stock</th><th>Units ordered</th><th>Listing</th></tr></thead><tbody>{filteredProducts.map((product) => <tr key={product.id}><td><strong>{product.name}</strong></td><td>{product.seller?.farmName || "—"}</td><td>{title(product.category)}</td><td>{money(product.price)} / {product.unit}</td><td>{product.quantity} {product.unit}</td><td>{soldByProduct[product.id] || 0}</td><td><span className={`admin-status ${product.isActive ? "status-verified" : "status-suspended"}`}>{product.isActive ? "Active" : "Inactive"}</span></td></tr>)}</tbody></table>{filteredProducts.length === 0 && <div className="admin-empty">No products match your search.</div>}</div></section>}

        {section === "orders" && <section className="admin-card admin-data-card"><div className="admin-card-heading"><div><span className="admin-overline">FULFILMENT MONITOR</span><h2>All orders <small>{orders.length}</small></h2><p>Track order progress and reach the buyer or farmer when needed.</p></div></div><div className="admin-toolbar"><select value={orderStatus} onChange={(event) => setOrderStatus(event.target.value)}><option value="all">All order statuses</option>{["pending", "confirmed", "shipped", "delivered", "rejected", "cancelled"].map((status) => <option key={status} value={status}>{title(status)}</option>)}</select></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Order</th><th>Buyer</th><th>Farmer / product</th><th>Delivery</th><th>Total</th><th>Order / payment</th></tr></thead><tbody>{filteredOrders.map((order) => <tr key={order.id}><td><strong>{order.orderNumber}</strong><small>{date(order.createdAt)}</small></td><td>{order.buyer ? `${order.buyer.firstName} ${order.buyer.lastName}` : "—"}<small><a href={`mailto:${order.buyer?.email || ""}`}>{order.buyer?.email}</a></small><small><a href={`tel:${order.buyer?.phone || order.deliveryPhone}`}>{order.buyer?.phone || order.deliveryPhone}</a></small></td><td>{order.seller?.farmName || "—"}<small>{order.product?.name || "—"} · {order.quantity} {order.product?.unit || ""}</small></td><td>{order.deliveryAddress}<small>{order.deliveryCity}</small></td><td><strong>{money(order.totalPrice)}</strong></td><td><span className={`admin-status status-${order.status}`}>{title(order.status)}</span><small><span className={`admin-status payment-${order.paymentStatus}`}>{title(order.paymentStatus)}</span></small></td></tr>)}</tbody></table>{filteredOrders.length === 0 && <div className="admin-empty">No orders match this status.</div>}</div></section>}

        {section === "payments" && <section className="admin-card admin-data-card"><div className="admin-card-heading"><div><span className="admin-overline">TRANSACTION MONITOR</span><h2>Payments and escrow <small>{payments.length}</small></h2><p>Review payment state, escrow state, and the associated order.</p></div></div><div className="admin-payment-summary"><span>Pending <b>{overview.pendingPayments}</b></span><span>Completed <b>{overview.completedPayments}</b></span><span>Completed volume <b>{money(overview.completedPaymentAmount)}</b></span></div><div className="admin-toolbar"><select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)}><option value="all">All payment statuses</option>{["pending", "completed", "failed", "cancelled"].map((status) => <option key={status} value={status}>{title(status)}</option>)}</select></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Transaction</th><th>Order / buyer</th><th>Farmer</th><th>Amount / method</th><th>Payment</th><th>Escrow</th></tr></thead><tbody>{filteredPayments.map((payment) => <tr key={payment.id}><td><strong>{payment.transactionId || payment.id.slice(0, 8)}</strong><small>{date(payment.createdAt)}</small></td><td>{payment.order?.orderNumber || payment.orderId}<small>{payment.order?.buyer ? `${payment.order.buyer.firstName} ${payment.order.buyer.lastName}` : ""}</small>{payment.order?.buyer?.email && <small><a href={`mailto:${payment.order.buyer.email}`}>{payment.order.buyer.email}</a></small>}</td><td>{payment.order?.seller?.farmName || "—"}</td><td><strong>{money(payment.amount)}</strong><small>{title(payment.method)}</small></td><td><span className={`admin-status payment-${payment.paymentStatus}`}>{title(payment.paymentStatus)}</span></td><td><span className="admin-status">{title(payment.escrowStatus)}</span></td></tr>)}</tbody></table>{filteredPayments.length === 0 && <div className="admin-empty">No payment records match this status.</div>}</div></section>}
      </>}
      <footer className="admin-footer"><span>FarmLink operations console</span><Link href="/">Open marketplace ↗</Link></footer>
    </section>
  </main>;
}
