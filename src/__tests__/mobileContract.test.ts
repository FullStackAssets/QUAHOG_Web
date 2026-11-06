import { describe, expect, it } from "vitest";
import appSrc from "../App.tsx?raw";
import sfxSrc from "../audio/sfx.ts?raw";
import touchSrc from "../ui/TouchControls.tsx?raw";
import htmlSrc from "../../index.html?raw";
import docSrc from "../../docs/testing/IPHONE-SAFARI-VERIFICATION.md?raw";

// Phone-playable controls that must keep feeding the shared input pipeline.
// Hold controls stay down for the whole press. The rest are one-shot taps.
const REQUIRED_BUTTONS: { k: string; label: string; action: string; hold: boolean }[] = [
  { k: "fire", label: "FIRE", action: "Mouse0", hold: false },
  { k: "e", label: "CAR", action: "KeyE", hold: false },
  { k: "g", label: "GUN", action: "KeyG", hold: false },
  { k: "f", label: "HIT", action: "KeyF", hold: false },
  { k: "brake", label: "BRAKE", action: "Space", hold: true },
  { k: "sprint", label: "RUN", action: "ShiftLeft", hold: true },
  { k: "v", label: "VIEW", action: "KeyV", hold: false },
  { k: "horn", label: "HORN", action: "KeyH", hold: false },
  { k: "map", label: "MAP", action: "KeyM", hold: false },
];

describe("main-game touch and mobile regression contract", () => {
  it("keeps the on-screen controls, coarse-pointer gate, and layout persistence", () => {
    const touch = touchSrc;
    expect(touch).toContain('const KEY = "mounthope.touchlayout.v3"');
    expect(touch).toContain('(pointer: coarse)');
    expect(touch).toContain('"ontouchstart" in window');
    expect(touch).toContain("onPointerCancel={onUp}");
    expect(touch).toContain('touchAction: "none"');
    expect(touch).toContain("MIN = { stick: 90, btn: 40 }");
    expect(touch).toContain("MAX = { stick: 230, btn: 120 }");
    expect(touch).toContain("if (m > 1) { dx /= m; dy /= m; }");
    expect(touch).toContain("setVirtualMove(dx, -dy)");

    for (const button of REQUIRED_BUTTONS) {
      const fragment = button.hold
        ? new RegExp(
            `k: "${button.k}"[\\s\\S]*?label: "${button.label}"[\\s\\S]*?action: "${button.action}"[\\s\\S]*?hold: true`,
          )
        : new RegExp(
            `k: "${button.k}", label: "${button.label}", action: "${button.action}"`,
          );
      expect(touch).toMatch(fragment);
    }
  });

  it("mounts touch controls and caps DPR by the Low / Medium / High preset", () => {
    const app = appSrc;
    expect(app).toContain("<TouchControls />");
    expect(app).toContain("installInput()");
    expect(app).toMatch(
      /DPR_BY_QUALITY[^=]*=\s*\[\s*1\s*,\s*\[\s*1\s*,\s*1\.25\s*\]\s*,\s*\[\s*1\s*,\s*1\.5\s*\]\s*\]/,
    );
    expect(app).toContain("dpr={DPR_BY_QUALITY[quality]}");
  });

  it("locks the viewport and disables page scroll behind the canvas", () => {
    const html = htmlSrc;
    expect(html).toContain(
      'name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"',
    );
    expect(html).toContain("overflow: hidden");
    expect(html).toContain('src="/src/main.tsx"');
    expect(html).not.toContain("earth.html");
  });

  it("resumes audio on a pointer gesture, which is the phone unlock path", () => {
    const sfx = sfxSrc;
    expect(sfx).toContain('window.addEventListener("pointerdown", resume)');
    expect(sfx).toContain("this.ctx?.resume()");
    expect(sfx).toContain("webkitAudioContext");
  });

  it("keeps the checklist from stating a device pass, a frame rate, or a temperature", () => {
    const doc = docSrc;
    expect(doc).toMatch(/human gate/i);
    expect(doc).toContain("10 minutes");
    expect(doc).toContain("Low");
    expect(doc).toContain("Medium");
    expect(doc).toContain("High");
    expect(doc).toMatch(/SwiftShader/);
    expect(doc).toMatch(/WebKit/);
    expect(doc).toMatch(/was not attached/i);
    expect(doc).toMatch(/not inspected/i);
    expect(doc).not.toMatch(/\b\d+\s*fps\b/i);
    expect(doc).not.toMatch(/\b\d+(?:\.\d+)?\s*°C\b/);
    expect(doc).not.toMatch(/verified on (?:an )?iPhone/i);
    expect(doc).not.toMatch(/Safari pass/i);
  });
});
