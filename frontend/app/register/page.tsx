"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, normalizeTanzanianPhone, saveAuth, type AuthResponse } from "../lib/api";
import PasswordField from "../components/PasswordField";

type AccountType = "farmer" | "customer";

export default function RegisterPage() {
  const router = useRouter();
  const [type, setType] = useState<AccountType | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [continueToCheckout, setContinueToCheckout] = useState(false);

  useEffect(() => {
    const requestedType = new URLSearchParams(window.location.search).get("type");
    setContinueToCheckout(new URLSearchParams(window.location.search).get("next") === "/checkout");
    if (requestedType === "farmer" || requestedType === "customer") setType(requestedType);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!type) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    if (String(form.get("password") || "") !== String(form.get("confirmPassword") || "")) {
      setError("Passwords do not match. Please check both fields.");
      return;
    }
    setLoading(true);
    setNotice("");
    setError("");
    const firstName = String(form.get("firstName") || "").trim();
    const lastName = String(form.get("lastName") || "").trim();
    const phone = normalizeTanzanianPhone(String(form.get("phone") || ""));

    try {
      const response = await apiRequest<AuthResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
          firstName,
          lastName,
          phone,
          role: type === "farmer" ? "seller" : "buyer",
        }),
      });
      saveAuth(response);

      if (type === "farmer") {
        try {
          await apiRequest("/sellers", {
            method: "POST",
            body: JSON.stringify({
              farmName: form.get("farmName"),
              contactPerson: `${firstName} ${lastName}`,
              phone,
              email: form.get("email"),
              address: form.get("address"),
              city: form.get("city"),
              region: form.get("region"),
              description: form.get("about"),
            }),
          }, response.accessToken);
        } catch (profileError) {
          const reason = profileError instanceof Error ? ` ${profileError.message}` : "";
          setNotice(`Your login account was created, but the farm application was not submitted.${reason} Log in and contact the FarmLink team to finish farmer setup.`);
          formElement.reset(); setPassword(""); setConfirmPassword("");
          return;
        }
        setNotice("Your account and farm application have been submitted. The team will review your farm before listings go live.");
      } else {
        if (new URLSearchParams(window.location.search).get("next") === "/checkout") {
          router.replace("/checkout");
          return;
        }
        setNotice("Your customer account is ready. You can now log in and place orders.");
      }
      formElement.reset(); setPassword(""); setConfirmPassword("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not create your account. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="account-page">
      <header className="site-header"><div className="nav-shell"><Link href="/" className="brand"><span className="brand-mark">F</span><span>FarmLink</span></Link><nav className="main-nav"><Link href="/">Home</Link><Link href="/#marketplace">Marketplace</Link><Link href="/#farmers">Farmers</Link><Link href="/#how-it-works">How It Works</Link><Link href="/#contact">Contact</Link></nav><div className="nav-actions"><Link className="login-link" href="/login">Log in</Link><Link className="button button-green nav-register" href="/register">Register</Link></div></div></header>

      {!type ? <section className="account-choice"><div className="account-intro"><span className="eyebrow">JOIN FARMLINK</span><h1>Create your<br />FarmLink account</h1><p>Choose how you want to join. Farmers and customers get the right tools for the way they use FarmLink.</p></div><div className="account-cards"><button className="account-option farmer-option" onClick={() => setType("farmer")}><span className="account-option-icon">🌾</span><span className="role-pill">FOR FARMERS</span><strong>Register as a Farmer</strong><span className="account-description">List your crops, livestock, eggs and dairy, and sell directly to buyers across Tanzania.</span><span className="account-benefit">✓ &nbsp;Free to join — admin approval keeps the marketplace trusted.</span><span className="account-option-link">Create farmer account <b>→</b></span></button><button className="account-option customer-option" onClick={() => setType("customer")}><span className="account-option-icon">🧺</span><span className="role-pill">FOR BUYERS</span><strong>Register as a Customer</strong><span className="account-description">Browse fresh produce from verified farms, build an order and pay when it arrives.</span><span className="account-benefit">✓ &nbsp;Browse and compare listings for free.</span><span className="account-option-link">Create customer account <b>→</b></span></button></div><p className="account-switch">Already have an account? <Link href="/login">Log in</Link></p></section> : <section className="register-form-section">
        <div className="register-story"><span className="eyebrow">{type === "farmer" ? "FARMER REGISTRATION" : "CUSTOMER REGISTRATION"}</span><h1>{type === "farmer" ? "Register your farm" : "Shop from farms you trust"}</h1><p>{type === "farmer" ? "Tell us about your farm. Our team reviews and approves every farmer before listings go live — then buyers across Tanzania can find you." : "Create your buyer account to save your favourite farms, build an order and pay when it arrives."}</p><div className={`register-photo ${type}`} /><div className="register-promises"><span>✓ &nbsp;{type === "farmer" ? "Manage listings and orders from your dashboard" : "Browse crops and livestock from approved farmers"}</span><span>✓ &nbsp;Pay cash on delivery</span></div><button className="text-back" type="button" onClick={() => { setType(null); setNotice(""); setError(""); }}>← &nbsp;Choose a different account type</button></div>
        <form className="account-form" onSubmit={handleSubmit}>
          <div className="form-heading"><span className="form-step">{type === "farmer" ? "01" : "✳"}</span><h2>{type === "farmer" ? "Tell us about your farm" : "Your buyer details"}</h2><p>{type === "farmer" ? "Our team will review your application." : "You can update your details any time."}</p></div>
          {type === "farmer" && <label>Farmer / Farm Name<input required name="farmName" minLength={2} maxLength={120} placeholder="e.g. Mama Amina Farms" /></label>}
          <div className="name-fields"><label>First name<input required name="firstName" autoComplete="given-name" placeholder="e.g. Amina" /></label><label>Last name<input required name="lastName" autoComplete="family-name" placeholder="e.g. Juma" /></label></div>
          <label>Email<input required type="email" name="email" autoComplete="email" placeholder="you@example.com" /></label>
          <label>Phone Number<input required type="tel" name="phone" autoComplete="tel" placeholder="+255 7XX XXX XXX" /></label>
          <PasswordField name="password" label="Create a password" autoComplete="new-password" minLength={8} showStrength onValueChange={setPassword} />
          <label>Confirm password<input required type="password" name="confirmPassword" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} aria-invalid={confirmPassword.length > 0 && password !== confirmPassword} aria-describedby="password-match-status" placeholder="Re-enter your password" /></label>
          <small id="password-match-status" className={`password-match-status${confirmPassword.length > 0 ? (password === confirmPassword ? " password-matches" : " password-mismatch") : ""}`} aria-live="polite">{confirmPassword.length > 0 ? (password === confirmPassword ? "Passwords match." : "Passwords do not match.") : "Re-enter your password to confirm it."}</small>
          {type === "farmer" && <><label>Address<input required name="address" minLength={3} maxLength={255} placeholder="Street or village" /></label><div className="name-fields"><label>City / district<input required name="city" minLength={2} maxLength={100} placeholder="e.g. Morogoro" /></label><label>Region<input required name="region" minLength={2} maxLength={100} placeholder="e.g. Morogoro" /></label></div><label>About your farm<textarea name="about" rows={3} maxLength={1000} placeholder="What do you grow or raise?" /></label></>}
          {type === "customer" && <><label>Region<input name="region" placeholder="e.g. Dar es Salaam" /></label><label className="check-line"><input required type="checkbox" name="terms" /> <span>I agree to the FarmLink terms and privacy policy.</span></label></>}
          {error && <p className="form-notice" role="alert">{error}</p>}{notice && <p className="form-notice" role="status">{notice}</p>}
          <button className="button button-green form-submit" type="submit" disabled={loading}>{loading ? "Creating account..." : type === "farmer" ? "Submit farm for review" : "Create customer account"} <span>→</span></button>
          <p className="form-footnote">{type === "farmer" ? "Free to join. Listings appear after admin approval." : <>Already registered? <Link href={continueToCheckout ? "/login?next=%2Fcheckout" : "/login"}>Log in to your account</Link></>}</p>
        </form>
      </section>}

      <footer className="account-footer"><div className="page-width account-footer-inner"><span>FarmLink · Fresh from Tanzanian farms</span><span>Dar es Salaam, Tanzania · © 2026</span></div></footer>
    </main>
  );
}
