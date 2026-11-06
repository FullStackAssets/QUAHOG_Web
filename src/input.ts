// Minimal input: held-key state + one-shot "tap" consumption, with a virtual
// (touch) layer so on-screen controls feed the same movement/tap pipeline.
const pressed = new Set<string>();
const taps = new Set<string>();
const vheld = new Set<string>();    // virtual (touch) held keys, e.g. sprint/handbrake
const virtual = { x: 0, y: 0 };     // touch joystick, each axis -1..1
const gamepadMove = { x: 0, y: 0 }; // gamepad left stick

let installed = false;
export function installInput() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("keydown", (e) => {
    if (!e.repeat) taps.add(e.code);
    pressed.add(e.code);
  });
  window.addEventListener("keyup", (e) => pressed.delete(e.code));
  window.addEventListener("blur", () => { pressed.clear(); vheld.clear(); });
  // left mouse → a "Mouse0" tap (used to fire the gun); ignore clicks on UI
  window.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    const el = e.target as HTMLElement | null;
    if (el && el.closest("button")) return; // don't fire when clicking a button
    taps.add("Mouse0");
  });

  // gamepad: left stick → movement, face/shoulder buttons → taps (§25/§47)
  const prevBtn: boolean[] = [];
  const BTN_TAP: Record<number, string> = {
    0: "KeyE",   // A — enter/exit
    1: "Space",  // B — handbrake / fire
    2: "KeyF",   // X — punch
    3: "KeyV",   // Y — view
    4: "KeyG",   // LB — gun
    5: "Mouse0", // RB — fire
    9: "KeyP",   // start — pause
  };
  const dz = (n: number) => (Math.abs(n) < 0.18 ? 0 : n);
  const poll = () => {
    const pads = navigator.getGamepads?.() ?? [];
    const gp = pads.find((p) => p);
    if (gp) {
      gamepadMove.x = dz(gp.axes[0] ?? 0);
      gamepadMove.y = -dz(gp.axes[1] ?? 0); // stick up = forward
      gp.buttons.forEach((b, i) => {
        const code = BTN_TAP[i];
        if (code && b.pressed && !prevBtn[i]) taps.add(code);
        prevBtn[i] = b.pressed;
      });
    } else {
      gamepadMove.x = 0; gamepadMove.y = 0;
    }
    requestAnimationFrame(poll);
  };
  requestAnimationFrame(poll);
}

export const isDown = (code: string) => pressed.has(code) || vheld.has(code);

/** Hold/release a virtual key from an on-screen (touch) button (sprint, brake). */
export const setVirtualHold = (code: string, down: boolean) => { if (down) vheld.add(code); else vheld.delete(code); };

/** Returns true exactly once per physical key press. */
export const consumeTap = (code: string) => taps.delete(code);

/** Inject a one-shot tap from an on-screen (touch) button. */
export const virtualTap = (code: string) => taps.add(code);

/** Set the touch joystick vector (x = right, y = forward), each -1..1. */
export const setVirtualMove = (x: number, y: number) => { virtual.x = x; virtual.y = y; };

const clamp1 = (n: number) => Math.max(-1, Math.min(1, n));

/** Read a WASD/arrow + touch movement vector. x = right, y = forward. */
export function moveAxis(): { x: number; y: number } {
  let x = 0;
  let y = 0;
  if (isDown("KeyW") || isDown("ArrowUp")) y += 1;
  if (isDown("KeyS") || isDown("ArrowDown")) y -= 1;
  if (isDown("KeyD") || isDown("ArrowRight")) x += 1;
  if (isDown("KeyA") || isDown("ArrowLeft")) x -= 1;
  return { x: clamp1(x + virtual.x + gamepadMove.x), y: clamp1(y + virtual.y + gamepadMove.y) };
}
