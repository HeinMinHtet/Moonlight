import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import { ErrorBoundary } from "./components/ErrorBoundary.jsx";
import "./index.css";

const rootElement = document.getElementById("root");

try {
  if (!rootElement) throw new Error("The app root element was not found.");
  createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
} catch (error) {
  document.body.innerHTML = `
    <main class="shell">
      <section class="sheet-main access-denied">
        <h1>Payout Ledger</h1>
        <h2>Interface failed to start</h2>
        <p class="panel-note">${String(error.message || error)}</p>
      </section>
    </main>
  `;
}
