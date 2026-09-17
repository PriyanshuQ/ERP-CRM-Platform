import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Session } from "@supabase/supabase-js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthScreen } from "./features/auth/AuthScreen";
import { CustomerPage } from "./features/customers/CustomerPage";
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
  if (session) return <CustomerPage />;

  return (
    <main className="shell">
      <p className="eyebrow">Phase 2 · Security foundation</p>
      <h1>ERP CRM Platform</h1>
      <p className="intro">Your multi-tenant workspace foundation is ready for organizations, memberships, roles, and protected business modules.</p>
      <div className="status-card">
        <span className="status-dot" aria-hidden="true" />
        <div>
          <strong>Supabase connection pending</strong>
          <p>Configure Supabase credentials to activate authentication.</p>
        </div>
      </div>
    </main>
  );
}

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element was not found");
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } }
});

createRoot(root).render(<StrictMode><QueryClientProvider client={queryClient}><App /></QueryClientProvider></StrictMode>);
