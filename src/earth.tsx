import React from "react";
import ReactDOM from "react-dom/client";
import { EarthApp } from "./earth/EarthApp";

// Catch render-time crashes so the page shows a message instead of a white screen.
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error("[earth] crashed:", error); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#05070d", color: "#e7e0ff", font: "14px/1.6 'Courier New', monospace", padding: 24, textAlign: "center" }}>
          <div style={{ maxWidth: 520 }}>
            <h2 style={{ color: "#ff7a7a" }}>Something tripped up</h2>
            <p>The photoreal view hit an error. This is usually a bad/over-quota Google key or the GPU running low.</p>
            <p style={{ opacity: 0.8 }}>Try reloading. If it persists, check the API key (Map Tiles API enabled, billing on) or lower detail.</p>
            <pre style={{ textAlign: "left", background: "#0c0f1a", padding: 12, borderRadius: 8, overflow: "auto", fontSize: 11 }}>
              {String(this.state.error?.message || this.state.error)}
            </pre>
            <button onClick={() => location.reload()} style={{ cursor: "pointer", border: "1px solid #2c3a5e", background: "#7ad9ff", color: "#04121a", fontWeight: 700, padding: "8px 16px", borderRadius: 6 }}>
              RELOAD
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// NOTE: no React.StrictMode here. StrictMode double-mounts every component
// (mount → unmount → mount), which tears down the imperative 3D-tiles plugins
// before they finish init — GoogleCloudAuthPlugin.dispose() then hits a null
// this.tiles. Rendering once avoids that.
ReactDOM.createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <EarthApp />
  </ErrorBoundary>,
);
