"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, type ApiUser } from "../../lib/api";

type SellerProfile = {
  id: string;
  farmName: string;
  description?: string | null;
  contactPerson: string;
  phone: string;
  email?: string | null;
  address: string;
  city: string;
  region: string;
  verificationStatus: "pending" | "verified" | "rejected" | "suspended";
  rating?: number | string;
  totalOrders?: number;
  totalReviews?: number;
};

type FarmerProduct = {
  id: string;
  name: string;
  category: string;
  price: number | string;
  quantity: number;
  unit: string;
  isActive: boolean;
};

type FarmerOrder = {
  id: string;
  orderNumber: string;
  quantity: number;
  unitPrice: number | string;
  totalPrice: number | string;
  deliveryFee: number | string;
  status: "pending" | "confirmed" | "rejected" | "shipped" | "delivered" | "cancelled";
  paymentStatus: string;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryPhone: string;
  createdAt: string;
  buyer?: { firstName: string; lastName: string; phone: string };
  product?: { name: string; unit?: string };
};

type PageResult<T> = { data: T[]; total: number };

const categories = ["vegetables", "fruits", "grains", "livestock", "poultry", "eggs", "dairy", "legumes", "other"];
const money = (value: number | string) => `TSh ${Number(value || 0).toLocaleString("en-US")}`;

function nextStatus(status: FarmerOrder["status"]): "confirmed" | "rejected" | "shipped" | "delivered" | null {
  if (status === "pending") return "confirmed";
  if (status === "confirmed") return "shipped";
  if (status === "shipped") return "delivered";
  return null;
}

export default function FarmerDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<ApiUser | null>(null);
  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [products, setProducts] = useState<FarmerProduct[]>([]);
  const [orders, setOrders] = useState<FarmerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [working, setWorking] = useState(false);
  const [workingOrder, setWorkingOrder] = useState("");
  const [orderFilter, setOrderFilter] = useState("all");

  const loadDashboard = useCallback(async (token: string) => {
    setLoading(true);
    setError("");
    try {
      const profile = await apiRequest<SellerProfile | null>("/sellers/me", {}, token);
      setSeller(profile);
      if (!profile) {
        setProducts([]);
        setOrders([]);
        return;
      }

      const [orderResult, productResult] = await Promise.all([
        apiRequest<PageResult<FarmerOrder>>("/orders/seller?limit=50&offset=0", {}, token),
        profile.verificationStatus === "verified"
          ? apiRequest<FarmerProduct[]>("/products/mine", {}, token)
          : Promise.resolve([] as FarmerProduct[]),
      ]);
      setOrders(orderResult.data || []);
      setProducts(productResult || []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load your dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    let currentUser: ApiUser | null = null;
    try {
      const stored = localStorage.getItem("user");
      currentUser = stored ? (JSON.parse(stored) as ApiUser) : null;
    } catch {
      localStorage.removeItem("user");
    }

    if (!token || !currentUser) {
      router.replace("/login");
      return;
    }
    if (currentUser.role !== "seller") {
      router.replace("/");
      return;
    }

    setUser(currentUser);
    void loadDashboard(token);
  }, [loadDashboard, router]);

  const visibleOrders = useMemo(
    () => orderFilter === "all" ? orders : orders.filter((order) => order.status === orderFilter),
    [orders, orderFilter],
  );
  const pendingOrders = orders.filter((order) => order.status === "pending").length;
  const deliveredSales = orders.filter((order) => order.status === "delivered").reduce((sum, order) => sum + Number(order.totalPrice), 0);

  async function createFarmProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = localStorage.getItem("accessToken");
    if (!token) return router.replace("/login");
    const form = new FormData(event.currentTarget);
    setWorking(true);
    setError("");
    setNotice("");
    try {
      await apiRequest("/sellers", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(form.entries())),
      }, token);
      setNotice("Farm application submitted. The FarmLink team will review it before your products go live.");
      await loadDashboard(token);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not submit your farm profile.");
    } finally {
      setWorking(false);
    }
  }

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = localStorage.getItem("accessToken");
    if (!token) return router.replace("/login");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const imageText = String(form.get("images") || "");
    const images = imageText.split(/[\n,]+/).map((image) => image.trim()).filter(Boolean);
    setWorking(true);
    setError("");
    setNotice("");
    try {
      await apiRequest<FarmerProduct>("/products", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          description: form.get("description"),
          category: form.get("category"),
          price: Number(form.get("price")),
          quantity: Number(form.get("quantity")),
          unit: form.get("unit"),
          images,
        }),
      }, token);
      formElement.reset();
      setNotice("Product listing added.");
      await loadDashboard(token);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not add this listing.");
    } finally {
      setWorking(false);
    }
  }

  async function updateOrder(order: FarmerOrder, status: "confirmed" | "rejected" | "shipped" | "delivered") {
    const token = localStorage.getItem("accessToken");
    if (!token) return router.replace("/login");
    setWorkingOrder(order.id);
    setError("");
    setNotice("");
    try {
      const updated = await apiRequest<FarmerOrder>(`/orders/${order.id}/status`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      }, token);
      setOrders((current) => current.map((item) => item.id === order.id ? { ...item, ...updated } : item));
      setNotice(`Order ${order.orderNumber} marked ${status}.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not update this order.");
    } finally {
      setWorkingOrder("");
    }
  }

  function logout() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    localStorage.removeItem("farmlinkBasket");
    router.replace("/login?loggedOut=1");
  }

  const statusLabel = seller?.verificationStatus || "not submitted";
  const statusClass = seller?.verificationStatus || "missing";

  return (
    <main className="farmer-dashboard">
      <header className="farmer-topbar">
        <Link href="/" className="brand"><span className="brand-mark">F</span><span>FarmLink</span></Link>
        <nav><a href="#overview">Overview</a><a href="#orders">Orders</a><a href="#products">Products</a></nav>
        <div className="farmer-top-actions"><span>{user ? `${user.firstName} ${user.lastName}` : "Farmer"}</span><button onClick={logout}>Log out</button></div>
      </header>

      <div className="farmer-dashboard-body">
        <div className="farmer-welcome" id="overview">
          <div><span className="eyebrow">FARMER WORKSPACE</span><h1>{seller?.farmName || `Welcome${user ? `, ${user.firstName}` : ""}`}</h1><p>Manage your farm, keep up with buyer orders, and grow your listings.</p></div>
          <span className={`farm-status status-${statusClass}`}><i /> Farm {statusLabel}</span>
        </div>

        {error && <div className="farmer-alert error" role="alert">{error}</div>}
        {notice && <div className="farmer-alert success" role="status">{notice}</div>}

        {loading ? <div className="farmer-panel farmer-loading">Loading your farm workspace…</div> : !seller ? <section className="farmer-panel farm-setup">
          <div className="farmer-section-title"><div><span className="eyebrow">FIRST STEP</span><h2>Complete your farm profile</h2><p>We need these details to set up your farmer workspace for review.</p></div></div>
          <form className="farmer-form-grid" onSubmit={createFarmProfile}>
            <label>Farm name<input name="farmName" required minLength={2} maxLength={120} /></label>
            <label>Contact person<input name="contactPerson" required minLength={2} maxLength={120} defaultValue={user ? `${user.firstName} ${user.lastName}` : ""} /></label>
            <label>Phone<input name="phone" required type="tel" placeholder="+255…" /></label>
            <label>Email<input name="email" type="email" defaultValue={user?.email || ""} /></label>
            <label>Address<input name="address" required minLength={3} maxLength={255} /></label>
            <label>City or district<input name="city" required minLength={2} maxLength={100} /></label>
            <label>Region<input name="region" required minLength={2} maxLength={100} /></label>
            <label className="wide-field">About your farm<textarea name="description" rows={3} maxLength={1000} /></label>
            <button className="farmer-primary-button wide-field" disabled={working}>{working ? "Submitting…" : "Submit farm profile for review"}</button>
          </form>
        </section> : <>
          <section className="farmer-stats" aria-label="Farm summary">
            <article><span>Pending orders</span><strong>{pendingOrders}</strong><small>Need your attention</small></article>
            <article><span>Product listings</span><strong>{products.length}</strong><small>{seller.verificationStatus === "verified" ? "In your inventory" : "Available after approval"}</small></article>
            <article><span>Completed sales</span><strong>{money(deliveredSales)}</strong><small>{orders.filter((order) => order.status === "delivered").length} delivered orders</small></article>
            <article><span>Farm rating</span><strong>{Number(seller.rating || 0).toFixed(1)}<small className="rating-star"> ★</small></strong><small>{seller.totalReviews || 0} buyer reviews</small></article>
          </section>

          {seller.verificationStatus !== "verified" && <section className={`farmer-review-notice review-${seller.verificationStatus}`}>
            <div><strong>{seller.verificationStatus === "pending" ? "Your farm is under review" : seller.verificationStatus === "rejected" ? "Your farm application needs an update" : "Your farmer account is suspended"}</strong>
              <p>{seller.verificationStatus === "pending" ? "You can review orders while we review your application. Product listings become available after approval." : seller.verificationStatus === "rejected" ? "Contact the FarmLink team for guidance on updating your application." : "Contact the FarmLink team for help with your account."}</p></div>
            <a href="mailto:hello@farmlink.co.tz">Contact FarmLink</a>
          </section>}

          <section className="farmer-panel" id="orders">
            <div className="farmer-section-title"><div><span className="eyebrow">BUYER ACTIVITY</span><h2>Orders</h2><p>Review new orders and update buyers as you prepare them.</p></div>
              <select aria-label="Filter orders" value={orderFilter} onChange={(event) => setOrderFilter(event.target.value)}><option value="all">All orders</option><option value="pending">Needs action</option><option value="confirmed">Confirmed</option><option value="shipped">Shipped</option><option value="delivered">Delivered</option><option value="rejected">Rejected</option></select>
            </div>
            {visibleOrders.length === 0 ? <div className="farmer-empty"><strong>No {orderFilter === "all" ? "orders" : `${orderFilter} orders`} yet</strong><span>New buyer orders for your farm will appear here.</span></div> : <div className="farmer-table-wrap"><table className="farmer-orders-table"><thead><tr><th>Order</th><th>Buyer and item</th><th>Delivery</th><th>Total</th><th>Status</th><th>Next step</th></tr></thead><tbody>{visibleOrders.map((order) => {
              const action = nextStatus(order.status);
              return <tr key={order.id}><td><strong>{order.orderNumber}</strong><small>{new Date(order.createdAt).toLocaleDateString()}</small></td><td>{order.buyer ? `${order.buyer.firstName} ${order.buyer.lastName}` : "FarmLink buyer"}<small>{order.quantity} × {order.product?.name || "Product"} {order.product?.unit || ""}</small><small>{order.buyer?.phone || order.deliveryPhone}</small></td><td>{order.deliveryAddress}<small>{order.deliveryCity}</small></td><td><strong>{money(order.totalPrice)}</strong><small>{order.paymentStatus || "Cash on delivery"}</small></td><td><span className={`order-status order-${order.status}`}>{order.status.replace("_", " ")}</span></td><td>{order.status === "pending" ? <div className="order-actions"><button disabled={workingOrder === order.id} onClick={() => void updateOrder(order, "confirmed")}>Confirm</button><button className="reject-order" disabled={workingOrder === order.id} onClick={() => void updateOrder(order, "rejected")}>Reject</button></div> : action ? <button className="order-next" disabled={workingOrder === order.id} onClick={() => void updateOrder(order, action)}>Mark {action}</button> : <span className="muted-dash">—</span>}</td></tr>;
            })}</tbody></table></div>}
          </section>

          <section className="farmer-panel" id="products">
            <div className="farmer-section-title"><div><span className="eyebrow">YOUR CATALOG</span><h2>Products</h2><p>Create and manage the produce buyers can order from your farm.</p></div><span className="inventory-count">{products.length} listings</span></div>
            {seller.verificationStatus === "verified" ? <div className="farmer-product-layout">
              <form className="farmer-product-form" onSubmit={createProduct}>
                <h3>Add a product</h3>
                <label>Product name<input name="name" required minLength={2} maxLength={120} placeholder="e.g. Fresh tomatoes" /></label>
                <label>Description<textarea name="description" required minLength={5} maxLength={2000} rows={3} placeholder="Describe the produce and how it is grown." /></label>
                <div className="farmer-form-row"><label>Category<select name="category" defaultValue="vegetables">{categories.map((category) => <option key={category} value={category}>{category[0].toUpperCase() + category.slice(1)}</option>)}</select></label><label>Unit<input name="unit" required maxLength={40} placeholder="kg, crate, piece" /></label></div>
                <div className="farmer-form-row"><label>Price (TSh)<input name="price" type="number" min="1" step="0.01" required /></label><label>Available quantity<input name="quantity" type="number" min="1" max="1000000" step="1" required /></label></div>
                <label>Product image URLs <span className="field-hint">Optional · one URL per line</span><textarea name="images" rows={2} placeholder="https://…" /></label>
                <button className="farmer-primary-button" disabled={working}>{working ? "Saving…" : "Add product listing"}</button>
              </form>
              <div className="farmer-inventory"><h3>Your inventory</h3>{products.length === 0 ? <div className="farmer-empty"><strong>No products listed yet</strong><span>Add your first product using the form.</span></div> : products.map((product) => <article className="inventory-row" key={product.id}><span className="inventory-icon">{product.category === "eggs" ? "🥚" : product.category === "livestock" ? "🐄" : "🌱"}</span><div><strong>{product.name}</strong><small>{product.category} · {money(product.price)} / {product.unit}</small></div><span className={product.quantity > 0 ? "stock-good" : "stock-empty"}>{product.quantity} in stock</span></article>)}</div>
            </div> : <div className="farmer-empty approval-empty"><strong>Product uploads unlock after farm approval</strong><span>Your farm status is <b>{seller.verificationStatus}</b>. You can still review orders above.</span></div>}
          </section>

          <section className="farmer-panel farmer-profile-card" id="farm-profile"><div><span className="eyebrow">FARM PROFILE</span><h2>{seller.farmName}</h2><p>{seller.address}, {seller.city}, {seller.region}</p><p>{seller.contactPerson} · {seller.phone}{seller.email ? ` · ${seller.email}` : ""}</p>{seller.description && <p>{seller.description}</p>}</div><span className={`farm-status status-${statusClass}`}><i /> {statusLabel}</span></section>
        </>}
        <footer className="farmer-footer"><Link href="/">← Back to FarmLink marketplace</Link><span>Need help? <a href="mailto:hello@farmlink.co.tz">Contact our team</a></span></footer>
      </div>
    </main>
  );
}
