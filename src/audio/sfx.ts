// Procedural sound effects + ambience (§20/§13). Pure Web Audio synthesis — no
// files, no copyright. One AudioContext, resumed on the first user gesture.
// One-shots (gun, punch, crash, horn, cash) and continuous beds (engine, siren,
// harbor ambience) are all driven from the game loop.

class Sfx {
  private ctx?: AudioContext;
  private master?: GainNode;
  private noise?: AudioBuffer;
  private engineOsc?: OscillatorNode;
  private engineGain?: GainNode;
  private engineFilter?: BiquadFilterNode;
  private sirenOsc?: OscillatorNode;
  private sirenGain?: GainNode;
  private sirenLfo?: OscillatorNode;
  private ambGain?: GainNode;
  private started = false;

  /** Lazily create the context + persistent nodes; attach gesture resume. */
  private ensure() {
    if (this.ctx) return;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(ctx.destination);

    // shared white-noise buffer
    const buf = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;

    // persistent engine voice (silent until driving)
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = "sawtooth";
    this.engineOsc.frequency.value = 45;
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = "lowpass";
    this.engineFilter.frequency.value = 400;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(this.engineFilter).connect(this.engineGain).connect(this.master);
    this.engineOsc.start();

    // persistent siren voice (silent until pursued)
    this.sirenOsc = ctx.createOscillator();
    this.sirenOsc.type = "sine";
    this.sirenOsc.frequency.value = 700;
    this.sirenLfo = ctx.createOscillator();
    this.sirenLfo.frequency.value = 1.6;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 180;
    this.sirenLfo.connect(lfoGain).connect(this.sirenOsc.frequency);
    this.sirenGain = ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain).connect(this.master);
    this.sirenOsc.start();
    this.sirenLfo.start();

    // ambience bed (low harbor wind) — gain rises when started
    this.ambGain = ctx.createGain();
    this.ambGain.gain.value = 0;
    this.ambGain.connect(this.master);

    const resume = () => { this.ctx?.resume(); };
    window.addEventListener("pointerdown", resume);
    window.addEventListener("keydown", resume);
  }

  private burst(freq: number, q: number, dur: number, vol: number, type: BiquadFilterType = "bandpass") {
    const ctx = this.ctx!, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise!;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t); src.stop(t + dur + 0.02);
  }

  private tone(freq: number, dur: number, vol: number, type: OscillatorType = "sine", slideTo?: number) {
    const ctx = this.ctx!, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g).connect(this.master!);
    o.start(t); o.stop(t + dur + 0.02);
  }

  // ---- one-shots ----
  gun() { this.ensure(); this.burst(1400, 1.2, 0.16, 0.7); this.tone(120, 0.12, 0.3, "square", 50); }
  shotgun() { this.ensure(); this.burst(700, 0.6, 0.3, 0.85, "lowpass"); this.tone(80, 0.22, 0.45, "square", 40); }
  punch() { this.ensure(); this.tone(150, 0.12, 0.35, "sine", 60); this.burst(500, 0.7, 0.06, 0.15); }
  crash() { this.ensure(); this.burst(800, 0.5, 0.35, 0.5, "lowpass"); this.tone(90, 0.25, 0.3, "square", 40); }
  horn() { this.ensure(); this.tone(360, 0.45, 0.25, "square"); this.tone(440, 0.45, 0.18, "square"); }
  cash() { this.ensure(); this.tone(880, 0.08, 0.25, "square"); setTimeout(() => this.tone(1320, 0.12, 0.25, "square"), 70); }
  ui() { this.ensure(); this.tone(600, 0.05, 0.15, "square"); }
  bust() { this.ensure(); this.tone(300, 0.5, 0.3, "sawtooth", 120); }
  step() { this.ensure(); this.burst(240, 0.5, 0.07, 0.05, "lowpass"); }
  screech() { this.ensure(); this.burst(1100, 7, 0.45, 0.14, "bandpass"); this.tone(900, 0.4, 0.05, "sawtooth", 1300); }

  // ---- continuous beds (call each frame) ----
  engine(speed01: number, on: boolean) {
    if (!this.ctx) { if (on) this.ensure(); else return; }
    const t = this.ctx!.currentTime;
    this.engineOsc!.frequency.setTargetAtTime(45 + speed01 * 150, t, 0.08);
    this.engineFilter!.frequency.setTargetAtTime(350 + speed01 * 1400, t, 0.1);
    this.engineGain!.gain.setTargetAtTime(on ? 0.06 + speed01 * 0.06 : 0, t, 0.1);
  }
  siren(on: boolean) {
    if (!this.ctx) { if (on) this.ensure(); else return; }
    this.sirenGain!.gain.setTargetAtTime(on ? 0.05 : 0, this.ctx!.currentTime, 0.2);
  }
  setVolume(v: number) { this.ensure(); this.master!.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), this.ctx!.currentTime, 0.05); }

  /** Start the harbor ambience bed (soft low wind only — no chirps). */
  startAmbience() {
    this.ensure();
    if (this.started) return;
    this.started = true;
    const ctx = this.ctx!;
    // wind: looping low-pass-filtered noise, kept low and dark
    const src = ctx.createBufferSource();
    src.buffer = this.noise!; src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass"; f.frequency.value = 320;
    src.connect(f).connect(this.ambGain!);
    src.start();
    this.ambGain!.gain.setTargetAtTime(0.04, ctx.currentTime, 2);

    // ocean wave wash: band-passed noise with a slow LFO swell (always present)
    const wsrc = ctx.createBufferSource();
    wsrc.buffer = this.noise!; wsrc.loop = true;
    const wf = ctx.createBiquadFilter();
    wf.type = "bandpass"; wf.frequency.value = 520; wf.Q.value = 0.5;
    const wg = ctx.createGain(); wg.gain.value = 0.05;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.16; // ~6s swell
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.035;
    lfo.connect(lfoG).connect(wg.gain);
    wsrc.connect(wf).connect(wg).connect(this.ambGain!);
    wsrc.start(); lfo.start();
  }
}

export const sfx = new Sfx();
