import { FormEvent, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";

type AuthMode = "sign-in" | "sign-up";

export function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setIsSubmitting(true);

    if (!supabase) {
      setMessage("Supabase is not configured yet. Copy .env.example to .env and add your project values.");
      setIsSubmitting(false);
      return;
    }

    const result = mode === "sign-in"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });

    setMessage(result.error?.message ?? (mode === "sign-up"
      ? "Account created. Check your email if confirmation is enabled."
      : "Signed in successfully."));
    setIsSubmitting(false);
  };

  return (
    <section className="auth-card" aria-labelledby="auth-title">
      <p className="eyebrow">Secure workspace access</p>
      <h2 id="auth-title">{mode === "sign-in" ? "Welcome back" : "Create your account"}</h2>
      <p className="auth-copy">Authentication is handled by Supabase Auth. Organization permissions will be enforced by PostgreSQL RLS.</p>
      {!isSupabaseConfigured && <p className="setup-note">Development setup required: add Supabase values to your local environment.</p>}
      <form onSubmit={submit}>
        <label>
          Email
          <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label>
          Password
          <input type="password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required />
        </label>
        <button type="submit" disabled={isSubmitting}>{isSubmitting ? "Working…" : mode === "sign-in" ? "Sign in" : "Sign up"}</button>
      </form>
      {message && <p className="form-message" role="status">{message}</p>}
      <button className="link-button" type="button" onClick={() => { setMode(mode === "sign-in" ? "sign-up" : "sign-in"); setMessage(""); }}>
        {mode === "sign-in" ? "Need an account? Sign up" : "Already have an account? Sign in"}
      </button>
    </section>
  );
}
