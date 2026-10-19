import React from "react";

// Catch render-time crashes in the main game so a single bad component shows a
// recoverable overlay instead of a white screen. Includes the build stamp so a
// crash report can be tied to an exact deploy.
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[quahog] crashed:", error, info.componentStack);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#05070d", color: "#e7e0ff", font: "14px/1.6 'Courier New', monospace", padding: 24, textAlign: "center" }}>
        <div style={{ maxWidth: 540 }}>
          <h2 style={{ color: "#ff7a7a" }}>The Narrows hit a snag</h2>
          <p>The game crashed while rendering. Reloading usually clears it.</p>
          <pre style={{ textAlign: "left", background: "#0c0f1a", padding: 12, borderRadius: 8, overflow: "auto", fontSize: 11, maxHeight: 180 }}>
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <button onClick={() => location.reload()} style={{ cursor: "pointer", border: "1px solid #2c3a5e", background: "#7ad9ff", color: "#04121a", fontWeight: 700, padding: "8px 18px", borderRadius: 6 }}>
            RELOAD
          </button>
          <div style={{ marginTop: 14, opacity: 0.5, fontSize: 10 }}>build {__BUILD_SHA__} · {__BUILD_DATE__}</div>
        </div>
      </div>
    );
  }
}
