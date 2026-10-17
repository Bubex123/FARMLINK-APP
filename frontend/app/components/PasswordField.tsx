"use client";

import { useState, type ChangeEvent } from "react";

type PasswordFieldProps = {
  name: string;
  label: string;
  autoComplete: string;
  minLength?: number;
  showStrength?: boolean;
  onValueChange?: (value: string) => void;
};

export default function PasswordField({ name, label, autoComplete, minLength, showStrength = false, onValueChange }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const [password, setPassword] = useState("");
  const checks = [
    password.length >= 8,
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const score = checks.filter(Boolean).length;
  const strength = score <= 2 ? "Weak" : score === 3 ? "Fair" : score === 4 ? "Strong" : "Very strong";
  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    setPassword(event.target.value);
    onValueChange?.(event.target.value);
  };

  return (
    <div className={`password-field-wrap${showStrength ? " with-strength" : ""}`}>
      <label className="password-field-label" htmlFor={name}>{label}</label>
      <div className="password-input-row">
        <input id={name} required type={visible ? "text" : "password"} name={name} autoComplete={autoComplete} minLength={minLength} placeholder={minLength ? `At least ${minLength} characters` : "Your password"} onChange={onChange} />
        <button className="password-visibility" type="button" aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} onClick={() => setVisible((current) => !current)}>
          {visible ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8"/><path d="M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.5 4.5 9.5 7-.4 1-1.2 2.1-2.3 3.2M6.2 6.2C4.3 7.5 3 9.3 2.5 12c1 2.5 4.5 7 9.5 7 1.2 0 2.3-.2 3.3-.6"/></svg> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z"/><circle cx="12" cy="12" r="2.5"/></svg>}
        </button>
      </div>
      {showStrength && password.length > 0 && <div className="password-strength" aria-live="polite">
        <div className="password-strength-top"><span>Password strength</span><strong className={`strength-${strength.toLowerCase().replace(" ", "-")}`}>{strength}</strong></div>
        <div className="strength-bars" aria-hidden="true">{checks.slice(0, 4).map((_, index) => <i key={index} className={score >= index + 1 ? `filled strength-${strength.toLowerCase().replace(" ", "-")}` : ""} />)}</div>
        <small>Use 8+ characters with uppercase, lowercase, a number, and a symbol.</small>
      </div>}
    </div>
  );
}
