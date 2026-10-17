"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiRequest, type ApiUser } from "./lib/api";

type Category = "All" | "Crops" | "Livestock" | "Eggs" | "Dairy";
type Product = {
  id: number | string;
  name: string;
  category: Exclude<Category, "All">;
  seller: string;
  region: string;
  rating: string;
  price: number;
  unit: string;
  image: string;
  badge?: string;
};

const products: Product[] = [
  { id: 1, name: "Premium Mchele (Rice)", category: "Crops", seller: "Mama Amina Farms", region: "Morogoro", rating: "4.9", price: 2800, unit: "/kg", image: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=900&q=85" },
  { id: 2, name: "Round Maize (Mahindi)", category: "Crops", seller: "Kilimo Bora Co-op", region: "Dodoma", rating: "4.7", price: 950, unit: "/kg", image: "https://images.unsplash.com/photo-1551754655-cd27e38d2076?auto=format&fit=crop&w=900&q=85" },
  { id: 3, name: "Fresh Tomatoes", category: "Crops", seller: "Neema Vegetables", region: "Arusha", rating: "4.8", price: 1800, unit: "/kg", image: "https://images.unsplash.com/photo-1546094096-0df4bcaaa337?auto=format&fit=crop&w=900&q=85" },
  { id: 4, name: "Red Onions (Vitunguu)", category: "Crops", seller: "Singida Growers", region: "Singida", rating: "4.6", price: 2500, unit: "/kg", image: "https://images.unsplash.com/photo-1508747703725-719777637510?auto=format&fit=crop&w=900&q=85" },
  { id: 5, name: "Sukuma Wiki (Kale)", category: "Crops", seller: "Green Valley Farm", region: "Dar es Salaam", rating: "4.5", price: 1200, unit: "/bunch", image: "https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=900&q=85" },
  { id: 6, name: "Avocado (Parachichi)", category: "Crops", seller: "Mbeya Highlands", region: "Mbeya", rating: "4.9", price: 3200, unit: "/kg", image: "https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?auto=format&fit=crop&w=900&q=85", badge: "In season" },
  { id: 7, name: "Farm Fresh Eggs", category: "Eggs", seller: "Upendo Poultry", region: "Morogoro", rating: "4.8", price: 9000, unit: "/tray", image: "https://images.unsplash.com/photo-1506976785307-8732e854ad03?auto=format&fit=crop&w=900&q=85" },
  { id: 8, name: "Free-range Goats", category: "Livestock", seller: "Mlimani Ranch", region: "Dodoma", rating: "4.7", price: 185000, unit: "/head", image: "https://images.unsplash.com/photo-1524024973431-2ad916746881?auto=format&fit=crop&w=900&q=85" },
  { id: 9, name: "Fresh Farm Milk", category: "Dairy", seller: "Kilimanjaro Dairy", region: "Moshi", rating: "4.9", price: 2500, unit: "/litre", image: "https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=900&q=85" },
];

const categories: { title: Exclude<Category, "All">; image: string; note: string }[] = [
  { title: "Crops", image: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=85", note: "Fresh from the field" },
  { title: "Livestock", image: "https://images.unsplash.com/photo-1500595046743-cd271d694d30?auto=format&fit=crop&w=900&q=85", note: "Raised with care" },
  { title: "Eggs", image: "https://images.unsplash.com/photo-1518569656558-1f25e69d93d7?auto=format&fit=crop&w=900&q=85", note: "Collected each morning" },
  { title: "Dairy", image: "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=900&q=85", note: "Straight from local farms" },
];

const money = (amount: number) => `TSh ${amount.toLocaleString("en-US")}`;
const BASKET_STORAGE_KEY = "farmlinkBasket";

type ApiProduct = {
  id: string;
  name: string;
  category: string;
  price: number | string;
  unit?: string | null;
  images?: string[] | null;
  rating?: number | string;
  seller?: { farmName?: string; region?: string; city?: string };
};

type ProductPage = { data: ApiProduct[]; total: number };

function fromApiProduct(product: ApiProduct, index: number): Product {
  const category: Product["category"] = product.category === "livestock" || product.category === "poultry"
    ? "Livestock"
    : product.category === "eggs" ? "Eggs" : product.category === "dairy" ? "Dairy" : "Crops";
  const imageFallbacks: Record<Product["category"], string> = {
    Crops: products[2].image,
    Livestock: products[7].image,
    Eggs: products[6].image,
    Dairy: products[8].image,
  };

  return {
    id: product.id,
    name: product.name,
    category,
    seller: product.seller?.farmName || "Verified farm",
    region: product.seller?.region || product.seller?.city || "Tanzania",
    rating: Number(product.rating || 0).toFixed(1),
    price: Number(product.price),
    unit: product.unit ? `/${product.unit}` : "",
    image: product.images?.[0] || imageFallbacks[category] || products[index % products.length].image,
  };
}

function Mark({ children }: { children: React.ReactNode }) {
  return <span className="brand-mark" aria-hidden="true">{children}</span>;
}

export default function Home() {
  const [category, setCategory] = useState<Category>("All");
  const [search, setSearch] = useState("");
  const [catalog, setCatalog] = useState<Product[]>(products);
  const [catalogStatus, setCatalogStatus] = useState<"connecting" | "connected" | "empty" | "offline">("connecting");
  const [basket, setBasket] = useState<Record<string, number>>({});
  const [basketReady, setBasketReady] = useState(false);
  const [saved, setSaved] = useState<Array<Product["id"]>>([]);
  const [notice, setNotice] = useState("");
  const [accountUser, setAccountUser] = useState<ApiUser | null>(null);

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("user");
      if (storedUser) setAccountUser(JSON.parse(storedUser) as ApiUser);
    } catch {
      localStorage.removeItem("user");
    }
    try {
      const storedBasket = localStorage.getItem(BASKET_STORAGE_KEY);
      if (storedBasket) setBasket(JSON.parse(storedBasket) as Record<string, number>);
    } catch {
      localStorage.removeItem(BASKET_STORAGE_KEY);
    }
    setBasketReady(true);

    let active = true;
    apiRequest<ProductPage>("/products?limit=48&offset=0")
      .then((result) => {
        if (!active) return;
        if (result.data.length > 0) {
          setCatalog(result.data.map(fromApiProduct));
          setCatalogStatus("connected");
        } else {
          setCatalog(products);
          setCatalogStatus("empty");
        }
      })
      .catch(() => {
        if (active) setCatalogStatus("offline");
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (basketReady) localStorage.setItem(BASKET_STORAGE_KEY, JSON.stringify(basket));
  }, [basket, basketReady]);

  const visibleProducts = useMemo(() => catalog.filter((product) => {
    const inCategory = category === "All" || product.category === category;
    const phrase = `${product.name} ${product.seller} ${product.region} ${product.category}`.toLowerCase();
    return inCategory && phrase.includes(search.toLowerCase());
  }), [catalog, category, search]);

  const itemCount = Object.values(basket).reduce((sum, count) => sum + count, 0);
  const total = catalog.reduce((sum, product) => sum + product.price * (basket[product.id] || 0), 0);
  const savedProducts = catalog.filter((product) => saved.includes(product.id));

  const addToBasket = (id: Product["id"]) => {
    setBasket((current) => ({ ...current, [id]: (current[id] || 0) + 1 }));
    const product = catalog.find((entry) => entry.id === id);
    setNotice(`${product?.name} added to your order`);
    window.setTimeout(() => setNotice(""), 2400);
  };

  const toggleSaved = (id: Product["id"]) => setSaved((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  const logout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    localStorage.removeItem(BASKET_STORAGE_KEY);
    setBasket({});
    setAccountUser(null);
    setNotice("You have been logged out.");
    window.setTimeout(() => setNotice(""), 3000);
  };

  const continueToCheckout = () => {
    localStorage.setItem(BASKET_STORAGE_KEY, JSON.stringify(basket));
    const token = localStorage.getItem("accessToken");
    let currentUser: ApiUser | null = accountUser;
    try { currentUser = JSON.parse(localStorage.getItem("user") || "null") as ApiUser | null; } catch { currentUser = null; }
    window.location.href = token && currentUser?.role === "buyer" ? "/checkout" : "/login?next=%2Fcheckout";
  };

  return (
    <main>
      <header className="site-header">
        <div className="nav-shell">
          <Link href="#home" className="brand" aria-label="FarmLink home"><Mark>F</Mark><span>FarmLink</span></Link>
          <nav className="main-nav" aria-label="Main navigation">
            <a href="#home">Home</a><a href="#marketplace">Marketplace</a><a href="#farmers">Farmers</a><a href="#how-it-works">How It Works</a><a href="#contact">Contact</a>
          </nav>
          <div className="nav-actions">
            <a className="icon-link" href="#wishlist" aria-label={`Wishlist, ${saved.length} saved`}><svg viewBox="0 0 24 24"><path d="M20.8 8.8c0 5.5-8.8 11-8.8 11s-8.8-5.5-8.8-11A4.6 4.6 0 0 1 12 6.1a4.6 4.6 0 0 1 8.8 2.7Z" /></svg>{saved.length > 0 && <i>{saved.length}</i>}</a>
            <a className="icon-link basket-link" href="#your-order" aria-label={`Order, ${itemCount} items`}><svg viewBox="0 0 24 24"><path d="M3 9h18l-1.7 11H4.7L3 9Z" /><path d="m7 9 5-6 5 6M9 13v3m6-3v3" /></svg>{itemCount > 0 && <i>{itemCount}</i>}</a>
            {accountUser ? <>{accountUser.role === "buyer" && <Link className="login-link" href="/orders">My orders</Link>}<span className="login-link account-name">{accountUser.firstName}&apos;s account</span><button className="button button-green nav-register" type="button" onClick={logout}>Log out</button></> : <><Link className="login-link" href="/login">Log in</Link><Link className="button button-green nav-register" href="/register">Register</Link></>}
          </div>
        </div>
      </header>

      <section className="hero" id="home">
        <div className="hero-photo" />
        <div className="hero-inner page-width">
          <div className="hero-copy">
            <span className="hero-kicker"><span className="status-dot" /> Tanzania&apos;s direct farmer-to-consumer market</span>
            <h1>Fresh crops &amp; healthy livestock from verified farmers</h1>
            <p>Browse rice, maize, vegetables, eggs and dairy. Build your order from admin-approved farmers across Tanzania and pay cash on delivery.</p>
            <div className="hero-actions"><a className="button button-light" href="#marketplace">Browse marketplace <span>↗</span></a><a className="button button-outline-light" href="#how-it-works">How it works</a></div>
            <div className="hero-proof"><div className="avatar-stack"><span>A</span><span>N</span><span>M</span></div><span><strong>Local farms, trusted produce</strong><small>Reviewed before every listing goes live</small></span></div>
          </div>
          <div className="hero-note"><span className="note-icon">✳</span><span><strong>From farm to table</strong><small>Good food starts with good people.</small></span></div>
        </div>
        <div className="hero-bottom page-width"><span><span className="tiny-check">✓</span> Pay on delivery</span><span><span className="tiny-check">✓</span> Verified farmers</span><span><span className="tiny-check">✓</span> Grown in Tanzania</span></div>
      </section>

      <section className="features-section section-pad" id="farmers">
        <div className="page-width">
          <div className="section-heading"><span className="eyebrow">GOOD FOOD, GOOD PEOPLE</span><h2>Everything you need<br />for direct farm trade</h2><p>FarmLink makes it simple to buy from real farmers without middlemen.</p></div>
          <div className="feature-grid">
            {[
              ["🌾", "Crop listings", "Browse fresh rice, maize, vegetables and more, posted by approved farms."],
              ["🐐", "Livestock listings", "Find cattle, goats, poultry and eggs from trusted local producers."],
              ["🧺", "Cart & wishlist", "Build an order as you browse and keep your favourite finds close."],
              ["✓", "Approved farmers", "Every farm is reviewed before its listings go live on FarmLink."],
              ["◉", "Cash on delivery", "No advance payment. Pay the farmer when your order arrives."],
              ["★", "Ratings from buyers", "Real buyer reviews help you choose farmers with confidence."],
            ].map(([icon, title, description]) => <article className="feature-card" key={title}><div className="feature-icon">{icon}</div><h3>{title}</h3><p>{description}</p></article>)}
          </div>
        </div>
      </section>

      <section className="farmer-cta-section">
        <div className="farmer-cta-inner page-width">
          <div className="farmer-cta-copy">
            <Link className="farmer-cta-kicker" href="/register"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20v-8m0 2c-5.5 0-7-4-7-8 4.5 0 7 2 7 8Zm0-3c0-5 3-8 8-8 0 4.5-2.5 8-8 8Z" /></svg> Join FarmLink</Link>
            <h2>Are you a farmer? Start selling on FarmLink</h2>
            <p>Register your farm, get approved by our admin team, and reach buyers across Tanzania without middlemen.</p>
            <ul>
              <li><span>✓</span> Free farmer account with public listings</li>
              <li><span>✓</span> Admin reviews and approves every farmer</li>
              <li><span>✓</span> Get paid cash on delivery, no surprises</li>
            </ul>
          </div>
          <div className="farmer-cta-card">
            <Link className="farmer-cta-button primary" href="/register?type=farmer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20v-8m0 2c-5.5 0-7-4-7-8 4.5 0 7 2 7 8Zm0-3c0-5 3-8 8-8 0 4.5-2.5 8-8 8Z" /></svg> Register as a Farmer</Link>
            <Link className="farmer-cta-button" href="/register?type=customer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10h18l-1.5 10h-15L3 10Zm4 0 5-7 5 7m-8 3v4m6-4v4" /></svg> Register as a Customer</Link>
            <p>Free to join. Admin-approved farmers only.</p>
          </div>
        </div>
      </section>

      <section className="categories-section section-pad">
        <div className="page-width">
          <div className="center-heading"><span className="eyebrow">SHOP WHAT&apos;S IN SEASON</span><h2>Shop by category</h2><p>Fresh crops, livestock, eggs and dairy — sourced straight from approved Tanzanian farms.</p></div>
          <div className="category-grid">{categories.map((item) => <button key={item.title} className="category-card" onClick={() => { setCategory(item.title); document.getElementById("marketplace")?.scrollIntoView({ behavior: "smooth" }); }} style={{ backgroundImage: `linear-gradient(0deg, rgba(24,38,21,.76), transparent 75%), url("${item.image}")` }}><span className="category-note">{item.note}</span><span className="category-name">{item.title}<span>↗</span></span></button>)}</div>
        </div>
      </section>

      <section className="market-section section-pad" id="marketplace">
        <div className="page-width">
          <div className="market-head"><div className="section-heading"><span className="eyebrow">STRAIGHT FROM THE SOURCE</span><h2>Fresh from Tanzanian farms</h2><p>Search crops, livestock and eggs from admin-approved farmers. Add what you need to your order and pay cash on delivery.</p></div><span className="live-pill"><i /> {catalogStatus === "connecting" ? "Connecting to marketplace..." : catalogStatus === "connected" ? `${catalog.length} live listings` : catalogStatus === "empty" ? `${catalog.length} sample listings · no live listings yet` : `${catalog.length} sample listings · API offline`}</span></div>
          <div className="market-tools"><div className="filter-list" aria-label="Filter listings">{(["All", "Crops", "Livestock", "Eggs", "Dairy"] as Category[]).map((item) => <button key={item} onClick={() => setCategory(item)} className={`filter-chip ${category === item ? "active" : ""}`}>{item}</button>)}</div><label className="search-box"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.3 4.3" /></svg><input aria-label="Search listings" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search rice, goats, eggs..." />{search && <button onClick={() => setSearch("")} aria-label="Clear search">×</button>}</label></div>
          {visibleProducts.length ? <div className="product-grid">{visibleProducts.map((product) => <article className="product-card" key={product.id}>
            <div className="product-image" style={{ backgroundImage: `linear-gradient(0deg, rgba(27,35,20,.13), transparent 45%), url("${product.image}")` }}><span className="product-category">{product.category}</span>{product.badge && <span className="product-badge">{product.badge}</span>}<button className={`save-button ${saved.includes(product.id) ? "saved" : ""}`} onClick={() => toggleSaved(product.id)} aria-label={saved.includes(product.id) ? "Remove from wishlist" : "Add to wishlist"}><svg viewBox="0 0 24 24"><path d="M20.8 8.8c0 5.5-8.8 11-8.8 11s-8.8-5.5-8.8-11A4.6 4.6 0 0 1 12 6.1a4.6 4.6 0 0 1 8.8 2.7Z" /></svg></button></div>
            <div className="product-body"><h3>{product.name}</h3><p className="seller-line"><span>◉</span> {product.seller} <b>·</b> {product.region}</p><p className="rating-line"><span>★</span> {product.rating} <small>· rated by buyers</small></p><div className="product-buy"><p><strong>{money(product.price)}</strong><small>{product.unit}</small></p><button className="button button-green add-button" onClick={() => addToBasket(product.id)}>{basket[product.id] ? <><span>✓</span> Added ({basket[product.id]})</> : <><span>＋</span> Add</>}</button></div></div>
          </article>)}</div> : <div className="no-results"><span>⌕</span><h3>No listings match that search</h3><p>Try another product, region or category.</p><button className="button button-green" onClick={() => { setSearch(""); setCategory("All"); }}>Show all listings</button></div>}
        </div>
      </section>

      <section className="order-section" id="your-order"><div className="page-width order-layout"><div className="order-message"><div className="basket-round"><svg viewBox="0 0 24 24"><path d="M3 9h18l-1.7 11H4.7L3 9Z" /><path d="m7 9 5-6 5 6" /></svg></div><h2>{itemCount === 0 ? "Your order starts here" : "Your order is taking shape"}</h2><p>{itemCount === 0 ? "Add crops, livestock or eggs from the marketplace above and build an order from local farms." : `${itemCount} ${itemCount === 1 ? "item" : "items"} from the marketplace. Add a little more or review your order.`}</p><a className="button button-light" href="#marketplace">Browse listings <span>↗</span></a></div>
          <div className="order-summary"><div className="summary-top"><strong>Your order</strong><span>{itemCount} {itemCount === 1 ? "item" : "items"}</span></div>{itemCount > 0 && <div className="summary-items">{catalog.filter((product) => basket[product.id]).map((product) => <div className="summary-row" key={product.id}><span>{product.name}<small>{basket[product.id]} × {money(product.price)}</small></span><strong>{money(product.price * basket[product.id])}</strong><div className="quantity-controls"><button onClick={() => setBasket((current) => ({ ...current, [product.id]: Math.max(0, (current[product.id] || 0) - 1) }))} aria-label={`Remove one ${product.name}`}>−</button><span>{basket[product.id]}</span><button onClick={() => addToBasket(product.id)} aria-label={`Add one ${product.name}`}>+</button></div></div>)}</div>}<div className="total-row"><span>Estimated total</span><strong>{money(total)}</strong></div><p className="delivery-note">No advance payment. You pay cash when the farmer delivers your order.</p><button type="button" className={`button button-green checkout-button ${itemCount === 0 ? "disabled" : ""}`} disabled={itemCount === 0} onClick={continueToCheckout}><span>▱</span> Request this order</button></div>
        </div></section>

      <section className="wishlist-section section-pad" id="wishlist"><div className="page-width"><div className="section-heading"><span className="eyebrow">A LITTLE SOMETHING FOR LATER</span><h2>Your wishlist</h2><p>Saved favourites, ready to order when you are.</p></div>{savedProducts.length ? <div className="product-grid wishlist-grid">{savedProducts.map((product) => <article className="product-card" key={product.id}><div className="product-image" style={{ backgroundImage: `url("${product.image}")` }}><button className="save-button saved" onClick={() => toggleSaved(product.id)} aria-label="Remove from wishlist"><svg viewBox="0 0 24 24"><path d="M20.8 8.8c0 5.5-8.8 11-8.8 11s-8.8-5.5-8.8-11A4.6 4.6 0 0 1 12 6.1a4.6 4.6 0 0 1 8.8 2.7Z" /></svg></button></div><div className="product-body"><h3>{product.name}</h3><p className="seller-line">{product.seller} · {product.region}</p><div className="product-buy"><p><strong>{money(product.price)}</strong><small>{product.unit}</small></p><button className="button button-green add-button" onClick={() => addToBasket(product.id)}>＋ Add</button></div></div></article>)}</div> : <div className="empty-wishlist"><div className="heart-empty">♡</div><h3>Your next favourite is out there</h3><p>Tap the heart on any listing to save it here for later.</p><a className="button button-green" href="#marketplace">Browse listings</a></div>}</div></section>

      <section className="how-section section-pad" id="how-it-works"><div className="page-width how-layout"><div><span className="eyebrow">SIMPLE, FROM START TO FINISH</span><h2>How FarmLink works</h2><div className="steps-list"><div className="step-item"><span>01</span><div><strong>Approved farmers post produce</strong><small>Every farm is reviewed before it can list.</small></div><b>↗</b></div><div className="step-item"><span>02</span><div><strong>Browse and compare freely</strong><small>Find a great match from farms near you.</small></div><b>↗</b></div><div className="step-item"><span>03</span><div><strong>Build your order and wishlist</strong><small>Collect your favourites as you shop.</small></div><b>↗</b></div><div className="step-item"><span>04</span><div><strong>Pay cash on delivery</strong><small>Pay when your farm-fresh order arrives.</small></div><b>↗</b></div></div></div><article className="trust-card"><span className="trust-illustration">🌱</span><span className="eyebrow">A BETTER WAY TO BUY LOCAL</span><h3>Good food. Trusted farms. Fair trade.</h3><p>FarmLink brings you closer to the people who grow and raise your food. Every seller is reviewed by our team before their products reach the marketplace.</p><div className="trust-stats"><span><strong>100%</strong><small>farmer reviewed</small></span><span><strong>0</strong><small>middlemen</small></span><span><strong>TZ</strong><small>grown locally</small></span></div></article></div></section>

      <section className="farms-section section-pad"><div className="page-width farms-banner"><div><span className="eyebrow">MEET THE PEOPLE BEHIND YOUR FOOD</span><h2>Real farms, real food</h2><p>Every seller is reviewed and approved before their listings go live.</p></div><div className="farmer-quote"><span>“</span><p>We help small farms reach buyers in their town, without the middlemen.</p><small>FarmLink farmer community · Morogoro</small></div><div className="farm-strip"><span>Dar es Salaam</span><span>Morogoro</span><span>Dodoma</span><span>Arusha</span><span>Mbeya</span><span>Mwanza</span></div></div></section>

      <section className="reviews-section section-pad"><div className="page-width"><div className="section-heading"><span className="eyebrow">GOOD WORDS FROM THE COMMUNITY</span><h2>What farmers and buyers say</h2></div><div className="review-grid">{[["Amina J.", "Smallholder farmer, Morogoro", "FarmLink made it easy to reach customers in my town without middlemen. I sell my maize faster every week.", "AJ"], ["Baraka M.", "Buyer, Dar es Salaam", "I browse crops and livestock from approved farmers and pay when my order arrives. It feels safe and simple.", "BM"], ["Neema K.", "Market trader, Dodoma", "The public listings help me compare fresh vegetables and goats before I choose. Cash on delivery gives me confidence.", "NK"]].map(([name, location, quote, initials]) => <article className="review-card" key={name}><div className="review-stars">★★★★★</div><p>“{quote}”</p><div className="review-person"><span>{initials}</span><div><strong>{name}</strong><small>{location}</small></div></div></article>)}</div></div></section>

      <section className="faq-section section-pad"><div className="page-width faq-layout"><div><span className="eyebrow">HERE TO HELP</span><h2>Frequently asked questions</h2><p>Everything you need to shop and sell with confidence.</p></div><div className="faq-list"><details><summary>How do I buy crops or livestock on FarmLink?<span>＋</span></summary><p>Browse listings, add what you need to your order, then request it. You pay the farmer in cash when your order is delivered.</p></details><details><summary>Who can post listings?<span>＋</span></summary><p>Farmers can register for free. Our admin team reviews each farm before its listings go live.</p></details><details><summary>Do I have to pay before delivery?<span>＋</span></summary><p>No. FarmLink orders are paid in cash when the farmer delivers them.</p></details><details><summary>How are farmers verified?<span>＋</span></summary><p>Our team reviews each farmer application and farm details before approving their public listings.</p></details></div></div></section>

      <section className="join-section"><div className="page-width join-inner"><span className="eyebrow">GROW WITH FARM LINK</span><h2>Ready to connect<br />farm to table?</h2><p>Join trusted farmers and buyers using FarmLink across Tanzania.</p><div><Link className="button button-light" href="/register">Join FarmLink <span>↗</span></Link><a className="button button-outline-light" href="#marketplace">Explore the market</a></div></div></section>

      <footer className="site-footer" id="contact"><div className="page-width"><div className="footer-main"><div><Link href="#home" className="brand footer-brand"><Mark>F</Mark><span>FarmLink</span></Link><p>Fresh crops and healthy livestock, directly from approved Tanzanian farmers.</p><span className="footer-location">⌖ &nbsp; Dar es Salaam, Tanzania</span></div><div className="footer-links"><strong>Explore FarmLink</strong><a href="#home">Home</a><a href="#marketplace">Marketplace</a><Link href="/register?type=farmer">Sell as a farmer</Link><Link href="/register?type=customer">Register as a customer</Link><Link href="/login">Log in</Link></div><div className="footer-links"><strong>Need a hand?</strong><a href="#how-it-works">How it works</a><a href="mailto:hello@farmlink.co.tz">Contact our team</a><span>Cash on delivery</span><span>Admin-approved farms</span></div><div className="footer-signup"><span className="eyebrow">THE GOOD STUFF, OCCASIONALLY</span><p>Fresh market news from farms around Tanzania.</p><form onSubmit={(event) => { event.preventDefault(); setNotice("Thanks for joining the FarmLink updates!"); window.setTimeout(() => setNotice(""), 3000); }}><input aria-label="Your email" placeholder="Your email address" type="email" required /><button aria-label="Subscribe">→</button></form></div></div><div className="footer-bottom"><div className="region-list"><span>⌖</span>{["Dar es Salaam", "Morogoro", "Dodoma", "Arusha", "Mwanza", "Iringa", "Tanga"].map((region) => <span className="region-pill" key={region}>{region}</span>)}</div><p>© 2026 FarmLink <span>Made for Tanzania, with care <b>♥</b></span></p></div></div></footer>

      {notice && <div className="toast" role="status"><span>✓</span>{notice}</div>}
    </main>
  );
}
