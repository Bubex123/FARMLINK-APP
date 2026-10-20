"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function OrderByPhonePage() {
  const [emailHref, setEmailHref] = useState("");

  function prepareEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const subject = "FarmLink order request";
    const body = [
      `Name: ${form.get("name")}`,
      `Phone number: ${form.get("phone")}`,
      `Delivery location: ${form.get("location")}`,
      "",
      "Products and quantities:",
      String(form.get("items") || "").trim(),
      "",
      "Please contact me to confirm availability and delivery details.",
    ].join("\n");
    setEmailHref(`mailto:hello@farmlink.co.tz?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  }

  return (
    <main className="phone-order-page">
      <header className="site-header">
        <div className="nav-shell">
          <Link href="/" className="brand" aria-label="FarmLink home"><span className="brand-mark" aria-hidden="true">F</span><span>FarmLink</span></Link>
          <nav className="main-nav" aria-label="Main navigation"><Link href="/">Home</Link><Link href="/#marketplace">Marketplace</Link><Link href="/logistics">Delivery &amp; logistics</Link></nav>
          <div className="nav-actions"><Link className="login-link" href="/login">Log in</Link><Link className="button button-green nav-register" href="/register">Join FarmLink</Link></div>
        </div>
      </header>

      <section className="phone-order-hero">
        <div className="page-width phone-order-hero-inner">
          <span className="eyebrow">A SIMPLE WAY TO ORDER</span>
          <h1>Text, call, or email your order</h1>
          <p>No smartphone? You can still ask FarmLink for fresh produce. For now, send your order list by email and our team will help connect you with a farmer.</p>
          <div className="phone-order-actions"><a className="button button-light" href="#email-order">Write your order</a><Link className="button button-outline-light" href="/#marketplace">Browse marketplace</Link></div>
        </div>
      </section>

      <section className="phone-order-content page-width">
        <div className="phone-order-heading"><span className="eyebrow">THREE WAYS TO ORDER</span><h2>Choose what works for you</h2><p>We’re making it easier to buy from local farmers, even without using the website.</p></div>
        <div className="phone-order-methods">
          <article className="phone-order-card"><span className="phone-order-icon">✉</span><span className="phone-order-label">AVAILABLE NOW</span><h3>Email your order</h3><p>Write the products and quantities you need, plus your location and phone number. Our team will follow up to confirm the details.</p><a href="#email-order">Write an order email <span aria-hidden="true">→</span></a></article>
          <article className="phone-order-card phone-order-card-muted"><span className="phone-order-icon">☎</span><span className="phone-order-label">COMING LATER</span><h3>Call FarmLink</h3><p>We don’t have a public order phone line yet. Email us for now and we’ll share updates when phone ordering is ready.</p><a href="mailto:hello@farmlink.co.tz?subject=FarmLink%20phone%20ordering">Ask about phone ordering <span aria-hidden="true">→</span></a></article>
          <article className="phone-order-card phone-order-card-muted"><span className="phone-order-icon">▦</span><span className="phone-order-label">COMING LATER</span><h3>Text a short code</h3><p>SMS or USSD ordering will be added after FarmLink has an active service code. No code is active right now.</p><a href="mailto:hello@farmlink.co.tz?subject=FarmLink%20SMS%20ordering">Ask about SMS ordering <span aria-hidden="true">→</span></a></article>
        </div>

        <div className="phone-order-form-layout" id="email-order">
          <div className="phone-order-form-copy"><span className="eyebrow">ORDER BY EMAIL</span><h2>Tell us what you need</h2><p>Fill this in, then choose “Open email” to send your order details to FarmLink. Your email app will open with the message ready to review.</p><div className="phone-order-note"><strong>What happens next?</strong><span>Our team reviews your request, checks availability with approved farmers, and contacts you to confirm the price and delivery.</span></div></div>
          <form className="phone-order-form" onSubmit={prepareEmail}>
            <label>Your name<input name="name" autoComplete="name" required maxLength={100} placeholder="e.g. Asha" /></label>
            <label>Phone number<input name="phone" type="tel" autoComplete="tel" required maxLength={30} placeholder="e.g. +255 7XX XXX XXX" /></label>
            <label>Delivery location<input name="location" autoComplete="street-address" required maxLength={180} placeholder="Village, town or district" /></label>
            <label>Products and quantities<textarea name="items" required rows={5} maxLength={1500} placeholder={"e.g.\nRice — 5 kg\nTomatoes — 2 kg"} /></label>
            <button className="button button-green" type="submit">Prepare order email <span aria-hidden="true">→</span></button>
            {emailHref && <a className="button phone-order-email-link" href={emailHref}>Open email to send your order</a>}
            <small>This opens your own email app. The order is sent only when you press Send there.</small>
          </form>
        </div>

        <section className="phone-order-faq"><span className="eyebrow">QUESTIONS</span><h2>Good to know</h2><details><summary>Can I order with a text message right now?</summary><p>Not yet. FarmLink does not have an active SMS or USSD order code. Use the email form above for now.</p></details><details><summary>Does this form place an order automatically?</summary><p>No. It opens a prefilled email for you to review and send. FarmLink will contact you to confirm availability, price and delivery.</p></details><details><summary>Can I shop on the website instead?</summary><p>Yes. Browse the marketplace, add products to your basket, and place an order online.</p></details></section>
      </section>

      <footer className="site-footer"><div className="page-width"><div className="footer-main"><div><Link href="/" className="brand footer-brand"><span className="brand-mark" aria-hidden="true">F</span><span>FarmLink</span></Link><p>Fresh crops and healthy livestock, directly from approved Tanzanian farmers.</p></div><div className="footer-links"><strong>Explore FarmLink</strong><Link href="/">Home</Link><Link href="/#marketplace">Marketplace</Link><Link href="/logistics">Delivery &amp; logistics</Link><Link href="/register">Join FarmLink</Link></div><div className="footer-links"><strong>Need a hand?</strong><a href="mailto:hello@farmlink.co.tz">hello@farmlink.co.tz</a><Link href="/order-by-phone">Order without a smartphone</Link></div></div><div className="footer-bottom"><p>© 2026 FarmLink <span>Made for Tanzania, with care <b>♥</b></span></p></div></div></footer>
    </main>
  );
}
