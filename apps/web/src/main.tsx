import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Session } from "@supabase/supabase-js";
import { AuthScreen } from "./features/auth/AuthScreen";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import "./styles.css";

function App() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!supabase) return;

    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => listener.subscription.unsubscribe();
  }, []);

  if (isSupabaseConfigured && !session) return <AuthScreen />;

  return (
    <main className="shell">
      <p className="eyebrow">Phase 2 · Security foundation</p>
      <h1>ERP CRM Platform</h1>
      <p className="intro">Your multi-tenant workspace foundation is ready for organizations, memberships, roles, and protected business modules.</p>
      <div className="status-card">
        <span className="status-dot" aria-hidden="true" />
        <div>
          <strong>{session ? `Signed in as ${session.user.email ?? "user"}` : "Supabase connection pending"}</strong>
          <p>{session ? "The next step is creating your first organization." : "Configure Supabase credentials to activate authentication."}</p>
        </div>
      </div>
      {session && <button className="secondary-button" type="button" onClick={() => void supabase?.auth.signOut()}>Sign out</button>}
    </main>
  );
}

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element was not found");
}

createRoot(root).render(<StrictMode><App /></StrictMode>);
