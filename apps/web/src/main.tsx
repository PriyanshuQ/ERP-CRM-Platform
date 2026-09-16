import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element was not found");
}

createRoot(root).render(
  <StrictMode>
    <main className="shell">
      <p className="eyebrow">Phase 1 · Foundation</p>
      <h1>ERP CRM Platform</h1>
      <p className="intro">
        A scalable workspace for customer relationships, inventory, invoicing, and business insight.
      </p>
      <div className="status-card">
        <span className="status-dot" aria-hidden="true" />
        <div>
          <strong>Foundation is ready</strong>
          <p>React frontend and Express API are connected by the project structure.</p>
        </div>
      </div>
    </main>
  </StrictMode>
);
