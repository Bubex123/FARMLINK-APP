"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, ApiError, saveAuth, type AuthResponse } from "../lib/api";
import PasswordField from "../components/PasswordField";

type Role = "Customer" | "Farmer" | "Admin";

const apiRole: Record<Role, AuthResponse["user"]["role"]> = {
  Customer: "buyer",
  Farmer: "seller",
  Admin: "admin",
};

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("Customer");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [signedOut, setSignedOut] = useState(false);
  const [continueToCheckout, setContinueToCheckout] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSignedOut(params.get("loggedOut") === "1");
    setContinueToCheckout(params.get("next") === "/checkout");
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const data = new FormData(event.currentTarget);

    try {
      const response = await apiRequest<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: data.get("email"), password: data.get("password") }),
      });

      if (response.user.role !== apiRole[role]) {
        throw new ApiError(`That account is registered as a ${response.user.role}. Choose the matching account type and try again.`);
      }

      saveAuth(response);
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(response.user.role === "buyer" ? next === "/checkout" ? "/checkout" : "/orders" : response.user.role === "seller" ? "/farmer/dashboard" : response.user.role === "admin" ? "/admin/dashboard" : "/");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not log in. Please try again.");
      setLoading(false);
    }
  }

  return (
    <main className="account-page">
      <header className="site-header"><div className="nav-shell"><Link href="/" className="brand"><span className="brand-mark">F</span><span>FarmLink</span></Link><nav className="main-nav"><Link href="/">Home</Link><Link href="/#marketplace">Marketplace</Link><Link href="/#farmers">Farmers</Link><Link href="/#how-it-works">How It Works</Link><Link href="/#contact">Contact</Link></nav><div className="nav-actions"><Link className="login-link" href="/login">Log in</Link><Link className="button button-green nav-register" href="/register">Register</Link></div></div></header>
      <section className="login-section"><form className="login-card" onSubmit={handleSubmit}>
        <div className="login-lock"><svg viewBox="0 0 24 24"><rect x="4.5" y="10" width="15" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg></div><span className="eyebrow">WELCOME BACK</span><h1>Log in to FarmLink</h1><p>Choose your account type and continue.</p>
        <fieldset className="role-picker"><legend>I am a...</legend><div>{(["Customer", "Farmer", "Admin"] as Role[]).map((item) => <button key={item} type="button" className={role === item ? "selected" : ""} onClick={() => { setRole(item); setError(""); }}>{item}</button>)}</div></fieldset>
        {signedOut && <p className="form-notice" role="status">You have been logged out successfully.</p>}
        <label>Email<input required type="email" name="email" autoComplete="email" placeholder="you@example.com" /></label>
        <PasswordField name="password" label="Password" autoComplete="current-password" />
        <div className="login-extras"><label className="check-line"><input type="checkbox" name="remember" /> <span>Remember me</span></label><a href="mailto:support@farmlink.co.tz?subject=Reset%20my%20FarmLink%20password">Forgot password?</a></div>
        {error && <p className="form-notice" role="alert">{error}</p>}
        <button className="button button-green form-submit" type="submit" disabled={loading}>{loading ? "Logging in..." : `Log in as ${role}`} <span>→</span></button>
        <p className="form-footnote">New to FarmLink? <Link href={continueToCheckout ? "/register?type=customer&next=%2Fcheckout" : "/register"}>Create an account</Link></p>
      </form></section>
      <footer className="account-footer"><div className="page-width account-footer-inner"><span>FarmLink · Fresh from Tanzanian farms</span><span>Dar es Salaam, Tanzania · © 2026</span></div></footer>
    </main>
  );
}
