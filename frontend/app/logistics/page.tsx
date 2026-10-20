"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { apiRequest } from "../lib/api";

type Order = {
  orderNumber: string;
  status: string;
  deliveryCity: string;
  deliveryAddress: string;
  createdAt: string;
  updatedAt?: string;
  product?: { name?: string };
  seller?: { farmName?: string; city?: string; region?: string };
};
type TrackResult = { code: string; status: string; origin: string; destination: string; product: string; updatedAt?: string; demo?: boolean };

const demoDeliveries: Record<string, TrackResult> = {
  "FL-2041": { code: "FL-2041", status: "shipped", origin: "Morogoro", destination: "Dar es Salaam", product: "Fresh tomatoes", demo: true },
  "FL-2038": { code: "FL-2038", status: "confirmed", origin: "Arusha", destination: "Dar es Salaam", product: "Farm produce", demo: true },
  "FL-2039": { code: "FL-2039", status: "delivered", origin: "Dodoma", destination: "Morogoro", product: "Maize and beans", demo: true },
  "FL-2043": { code: "FL-2043", status: "pending", origin: "Mbeya", destination: "Dar es Salaam", product: "Avocados", demo: true },
};
const stages = ["pending", "confirmed", "shipped", "delivered"];
const stageTitles: Record<string, string> = { pending: "Order received", confirmed: "Order confirmed by farmer", shipped: "Picked up and on the way", delivered: "Delivered" };

function sendEmail(event: FormEvent<HTMLFormElement>, subject: string, fields: string[]) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const body = fields.map((field) => `${field}: ${String(form.get(field) || "").trim()}`).join("\n");
  window.location.href = `mailto:hello@farmlink.co.tz?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default function LogisticsPage() {
  const [activeForm, setActiveForm] = useState<"register" | "report">("register");
  const [trackingCode, setTrackingCode] = useState("FL-2041");
  const [trackResult, setTrackResult] = useState<TrackResult | null>(demoDeliveries["FL-2041"]);
  const [tracking, setTracking] = useState(false);
  const [trackError, setTrackError] = useState("");

  useEffect(() => {
    const orderCode = new URLSearchParams(window.location.search).get("order");
    if (orderCode) void trackDelivery(undefined, orderCode);
  }, []);

  async function trackDelivery(event?: FormEvent<HTMLFormElement>, code = trackingCode) {
    event?.preventDefault();
    const value = code.trim().toUpperCase();
    setTrackingCode(value);
    setTrackError("");
    const sample = demoDeliveries[value];
    if (sample) { setTrackResult(sample); return; }
    setTrackResult(null);
    const token = localStorage.getItem("accessToken");
    if (!token) { setTrackError("Log in with the customer account used to place this order to view its live status."); return; }
    setTracking(true);
    try {
      const result = await apiRequest<{ data: Order[] }>("/orders/mine?limit=100&offset=0", {}, token);
      const order = result.data?.find((item) => item.orderNumber.toUpperCase() === value);
      if (!order) { setTrackError("We couldn’t find that order in your account. Check the code or log in as the customer who placed it."); return; }
      setTrackResult({ code: order.orderNumber, status: order.status, origin: order.seller?.city || order.seller?.region || "Farm", destination: order.deliveryCity, product: order.product?.name || "Farm order", updatedAt: order.updatedAt });
    } catch (error) {
      setTrackError(error instanceof Error ? error.message : "Could not look up the order right now.");
    } finally { setTracking(false); }
  }

  const stageIndex = trackResult ? stages.indexOf(trackResult.status) : -1;

  return (
    <main className="logistics-page">
      <header className="site-header">
        <div className="nav-shell">
          <Link href="/" className="brand"><span className="brand-mark" aria-hidden="true">F</span><span>FarmLink</span></Link>
          <nav className="main-nav" aria-label="Main navigation"><Link href="/">Home</Link><Link href="/#marketplace">Marketplace</Link><Link href="/farmer/dashboard">Farmers</Link><Link href="/#how-it-works">How it works</Link></nav>
          <div className="nav-actions"><Link className="login-link" href="/login">Log in</Link><Link className="button button-green nav-register" href="/register">Join FarmLink</Link></div>
        </div>
      </header>

      <section className="logistics-hero">
        <div className="page-width logistics-hero-inner">
          <span className="hero-kicker"><span className="status-dot" /> FARMLINK LOGISTICS</span>
          <h1>Deliveries, tracked and sorted</h1>
          <p>Partner drivers move fresh produce across Tanzania every day. Track your delivery, report a problem, or register your vehicle and start earning on the routes you already run.</p>
          <div className="logistics-hero-actions"><a className="button button-light" href="#track">Track a delivery</a><a className="button button-outline-light" href="#report">Report a delivery issue</a></div>
        </div>
      </section>

      <section className="section-pad logistics-moves" id="services">
        <div className="page-width">
          <div className="center-heading"><span className="eyebrow">FROM FARM GATE TO FRONT DOOR</span><h2>How your goods move</h2><p>From a single crate of tomatoes to a full truckload of maize, we connect farmers to a reliable route.</p></div>
          <div className="delivery-service-grid">
            {[
              ["⇢", "Farm-to-hub trucking", "Farm trucks collect bulk crops from farms in regional hubs and bring them to approved pickup points for sorting.", "Scheduled routes", "Verified hand-off points", "Weight-based rates"],
              ["⌖", "Farm-to-market delivery", "Farmers can book a vehicle for their buyers in nearby towns or regional markets, from farm gate to market stall.", "Scheduled daily routes", "Transparent route costs", "Direct buyer drop-off"],
              ["⌁", "Last-mile delivery", "Boda riders and pickups take produce from the nearest hub to homes, restaurants and market stalls.", "Same-day inside city centres", "Driver details shared with buyer", "Cash paid on delivery"],
              ["✓", "Dairy and poultry care", "Refrigerated vans and insulated boxes help keep milk, yoghurt and eggs at the right temperature on the way to buyers.", "Temperature-aware handling", "Insulated crates for eggs", "Morning collection routes"],
              ["▧", "Livestock transport", "Approved livestock hauliers move animals in suitable vehicles with care before loading and after arrival.", "Planned collection time", "Suitable vehicle types", "Careful loading and hand-off"],
            ].map(([icon, title, description, a, b, c]) => <article className="delivery-service-card" key={title}><div className="delivery-service-top"><span>{icon}</span><b>{title === "Dairy and poultry care" ? "Cold chain" : title === "Last-mile delivery" ? "Same day" : "By arrangement"}</b></div><h3>{title}</h3><p>{description}</p><ul><li>{a}</li><li>{b}</li><li>{c}</li></ul></article>)}
          </div>
        </div>
      </section>

      <section className="logistics-track-section section-pad" id="track">
        <div className="page-width logistics-track-layout">
          <div className="logistics-track-intro"><span className="eyebrow">FOLLOW YOUR ORDER</span><h2>Track a delivery</h2><p>Enter the order number from your FarmLink confirmation to see its latest status.</p><form className="track-search-form" onSubmit={(event) => void trackDelivery(event)}><label htmlFor="tracking-code">Order number</label><div><input id="tracking-code" value={trackingCode} onChange={(event) => setTrackingCode(event.target.value)} placeholder="e.g. FL-2041" required /><button className="button button-green" type="submit" disabled={tracking}>{tracking ? "Looking…" : "Track order"}</button></div></form>
            <p className="track-demo-help">No code? Choose a sample delivery to see how tracking works:</p><div className="track-samples">{Object.keys(demoDeliveries).map((code) => <button type="button" key={code} className={trackingCode === code ? "selected" : ""} onClick={() => void trackDelivery(undefined, code)}>{code}</button>)}</div>
            {trackError && <p className="track-error" role="alert">{trackError} {trackError.startsWith("Log in") && <Link href="/login">Log in</Link>}</p>}
          </div>
          {trackResult && <article className="tracking-result-card" aria-live="polite"><span className="eyebrow">{trackResult.demo ? "DEMO TRACKING CODE" : "YOUR TRACKING CODE"}</span><h3>{trackResult.code}</h3><span className={`tracking-status-pill ${trackResult.status}`}>● &nbsp;{trackResult.status === "shipped" ? "Out for delivery" : stageTitles[trackResult.status] || trackResult.status}</span><div className="tracking-route"><small>ROUTE</small><strong>{trackResult.origin} → {trackResult.destination}</strong></div><div className="tracking-route"><small>ORDER</small><strong>{trackResult.product}</strong></div><ol className="tracking-timeline">{stages.map((stage, index) => <li className={index <= stageIndex ? "complete" : ""} key={stage}><span>{index <= stageIndex ? "✓" : index + 1}</span><div><strong>{stageTitles[stage]}</strong><small>{index === 0 && trackResult.updatedAt ? new Date(trackResult.updatedAt).toLocaleDateString() : index < stageIndex ? "Completed" : index === stageIndex ? "Latest update" : "Waiting"}</small></div></li>)}{trackResult.status === "rejected" && <li className="tracking-rejected"><span>!</span><div><strong>Farmer could not fulfil this order</strong><small>Contact FarmLink support if you need help.</small></div></li>}</ol>{trackResult.demo && <p className="tracking-demo-note">Sample tracking data. Real order lookups show orders from your signed-in customer account.</p>}</article>}
        </div>
      </section>

      <section className="logistics-support-section section-pad" id="report">
        <div className="page-width logistics-support-layout">
          <div><span className="eyebrow">NEED A HAND?</span><h2>Report a delivery problem</h2><p>Late truck, damaged produce, wrong drop-off or an update you can’t understand? Send the delivery reference and our team will follow up.</p></div>
          <article className="support-contact-card"><span className="eyebrow">CONTACT FARMLINK SUPPORT</span><strong>hello@farmlink.co.tz</strong><p>Use the form to prepare an email with your order number and details.</p><button className="button button-green" type="button" onClick={() => { setActiveForm("report"); document.getElementById("logistics-contact-form")?.scrollIntoView({ behavior: "smooth" }); }}>Report a delivery issue</button></article>
        </div>
      </section>

      <section className="logistics-coverage section-pad"><div className="page-width"><span className="eyebrow">GROWING ACROSS TANZANIA</span><h2>Delivery coverage</h2><p>Partner routes currently cover these regions, with more being added.</p><div className="coverage-list">{["Dar es Salaam", "Morogoro", "Dodoma", "Arusha", "Mbeya", "Mwanza", "Tanga", "Iringa", "Singida"].map((region) => <span key={region}>⌖ &nbsp;{region}</span>)}</div><small>Coverage shown is indicative. Confirm availability with FarmLink before arranging delivery.</small></div></section>

      <section className="logistics-faq section-pad"><div className="page-width"><div className="center-heading"><span className="eyebrow">HERE TO HELP</span><h2>Logistics questions</h2></div><div className="faq-list"><details><summary>What if my delivery is late?<span>＋</span></summary><p>Use the tracking code to check the latest order status. If it has not updated, send the order number to FarmLink support.</p></details><details><summary>How do I become a logistics partner?<span>＋</span></summary><p>Fill out the partner form below with your contact details, vehicle type and routes. FarmLink reviews each application before assigning deliveries.</p></details><details><summary>Can I deliver livestock?<span>＋</span></summary><p>Yes. Tell us about your livestock-capable vehicle in your application so the team can review suitability and routes.</p></details><details><summary>What does delivery cost?<span>＋</span></summary><p>Cost depends on the route, vehicle, load and handling needs. Confirm the delivery rate with the farmer or FarmLink team before the trip.</p></details><details><summary>What if my delivery is damaged?<span>＋</span></summary><p>Report the issue with your order number and a description so FarmLink support can follow up with the parties involved.</p></details></div></div></section>

      <section className="logistics-partner-cta"><div className="page-width logistics-partner-inner"><span className="eyebrow">JOIN THE FARM LINK NETWORK</span><h2>Own a truck, pickup or boda?<br />Earn on every drop.</h2><p>Deliver crops, livestock and dairy for farmers near you. You set your routes and rates; the FarmLink team checks your application before offering deliveries.</p><div className="logistics-perks"><span>Flexible routes</span><span>Vehicle and route matching</span><span>Reviewed partner network</span></div><a className="button button-light" href="#logistics-contact-form" onClick={() => setActiveForm("register")}>Apply to deliver with FarmLink <span aria-hidden="true">→</span></a></div></section>

      <section className="logistics-content page-width" id="logistics-contact-form">
        <div className="logistics-tabs" role="tablist" aria-label="Logistics contact forms"><button type="button" role="tab" aria-selected={activeForm === "register"} className={activeForm === "register" ? "active" : ""} onClick={() => setActiveForm("register")}>Partner registration</button><button type="button" role="tab" aria-selected={activeForm === "report"} className={activeForm === "report" ? "active" : ""} onClick={() => setActiveForm("report")}>Delivery issue</button></div>
        {activeForm === "register" ? <section className="logistics-form-card" role="tabpanel"><span className="logistics-icon" aria-hidden="true">↗</span><h2>Register as a logistics partner</h2><p>Tell us how to reach you and what vehicle you use. Our team reviews each application before assigning deliveries.</p><form onSubmit={(event) => sendEmail(event, "FarmLink logistics partner application", ["Full name", "Phone", "Email", "City or region", "Vehicle type", "Routes or delivery area"])}><label>Full name<input name="Full name" autoComplete="name" required /></label><label>Phone number<input name="Phone" type="tel" autoComplete="tel" placeholder="+255…" required /></label><label>Email address<input name="Email" type="email" autoComplete="email" required /></label><label>City or region<input name="City or region" required placeholder="e.g. Morogoro" /></label><label>Vehicle type<select name="Vehicle type" required defaultValue=""><option value="" disabled>Select a vehicle</option><option>Truck</option><option>Pickup</option><option>Boda boda</option><option>Refrigerated van</option><option>Other</option></select></label><label>Routes or delivery area<input name="Routes or delivery area" required placeholder="Where can you deliver?" /></label><button className="button button-green logistics-submit" type="submit">Email my application <span aria-hidden="true">→</span></button></form><small>This opens your email app with your application details. Review and send the message to FarmLink.</small></section> : <section className="logistics-form-card" role="tabpanel"><span className="logistics-icon issue" aria-hidden="true">!</span><h2>Report a delivery issue</h2><p>Share the delivery reference and a way to contact you. FarmLink support will follow up by email.</p><form onSubmit={(event) => sendEmail(event, "FarmLink delivery issue", ["Order or delivery reference", "Your name", "Phone", "Email", "What happened"])}><label>Order or delivery reference<input name="Order or delivery reference" required /></label><label>Your name<input name="Your name" autoComplete="name" required /></label><label>Phone number<input name="Phone" type="tel" autoComplete="tel" required /></label><label>Email address<input name="Email" type="email" autoComplete="email" required /></label><label className="logistics-wide-field">What happened?<textarea name="What happened" rows={4} maxLength={1500} required /></label><button className="button button-green logistics-submit" type="submit">Email delivery issue <span aria-hidden="true">→</span></button></form><small>This opens your email app with the issue details. Review and send the message to FarmLink.</small></section>}
        <Link className="logistics-back-link" href="/">← Back to the marketplace</Link>
      </section>
      <footer className="account-footer"><div className="page-width account-footer-inner"><span>FarmLink · Fresh from Tanzanian farms</span><a href="mailto:hello@farmlink.co.tz">hello@farmlink.co.tz</a></div></footer>
    </main>
  );
}
