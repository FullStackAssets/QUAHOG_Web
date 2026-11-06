import { useEffect } from "react";
import { reportAssetNotice, useAssetNotices } from "./assetNotices";
import { retryMainGameAssets } from "./mainGameGltf";
import { checkModelManifest, parseModelManifest } from "./modelManifest";
import { MAIN_GAME_MODELS } from "./modelRegistry";

// Visible asset failures for the main game. A bad GLB used to reject inside
// the shared scene boundary and leave a blank canvas with a console line.
export function AssetLoadNotice() {
  const notices = useAssetNotices();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/models/manifest.json");
        if (!response.ok) {
          if (!cancelled) {
            reportAssetNotice({
              key: "models-manifest",
              level: "warn",
              message: `Model manifest request failed (HTTP ${response.status})`,
            });
          }
          return;
        }
        const parsed = parseModelManifest(await response.json());
        const issues = [
          ...parsed.issues,
          ...(parsed.manifest
            ? checkModelManifest({ manifest: parsed.manifest, files: null, registry: MAIN_GAME_MODELS })
            : []),
        ];
        if (cancelled || issues.length === 0) return;
        reportAssetNotice({
          key: "models-manifest",
          level: "warn",
          message: `Model manifest: ${issues.map((issue) => issue.detail).join("; ")}`,
        });
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "unknown error";
        reportAssetNotice({
          key: "models-manifest",
          level: "warn",
          message: `Model manifest could not be read (${message})`,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (notices.length === 0) return null;
  const severe = notices.some((notice) => notice.level === "error");
  return (
    <div
      style={{
        position: "fixed",
        top: 108,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 14,
        width: "min(440px, calc(100% - 24px))",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        pointerEvents: "none",
      }}
    >
      {notices.slice(0, 3).map((notice) => (
        <div
          key={notice.key}
          style={{
            background: "rgba(12,15,26,.92)",
            border: `1px solid ${notice.level === "error" ? "#ff7a7a" : "#ffcf4a"}`,
            color: notice.level === "error" ? "#ffb4b4" : "#ffcf4a",
            borderRadius: 8,
            padding: "8px 12px",
            fontFamily: "'Courier New', monospace",
            fontSize: 12,
            lineHeight: 1.4,
          }}
        >
          {notice.message}
        </div>
      ))}
      {severe && (
        <button
          type="button"
          onClick={() => {
            void retryMainGameAssets();
          }}
          style={{
            pointerEvents: "auto",
            cursor: "pointer",
            alignSelf: "center",
            border: "1px solid #2c3a5e",
            background: "#7ad9ff",
            color: "#04121a",
            fontWeight: 700,
            padding: "6px 14px",
            borderRadius: 6,
            fontFamily: "'Courier New', monospace",
          }}
        >
          RETRY ASSETS
        </button>
      )}
    </div>
  );
}
