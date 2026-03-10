import { StrictMode } from "react";
import { hydrateRoot, createRoot } from "react-dom/client";
import App from "./app/App";
import "./styles/index.css";

// Use hydrateRoot when prerendered HTML already exists in the DOM (static snapshots),
// otherwise fall back to createRoot for normal client-side rendering.
const rootElement = document.getElementById("root")!;

if (rootElement.hasChildNodes()) {
  hydrateRoot(
    rootElement,
    <StrictMode>
      <App />
    </StrictMode>
  );
} else {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
