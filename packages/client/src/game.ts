import { Application, Container, Graphics, Text } from "pixi.js";
import {
  CLASSES, ENEMIES, CLIENT_STEP_MS, INTERP_DELAY_MS, PLAYER_RADIUS, generateWorld, stepPlayer, bulletPos, volleyExpired,
  blocksBullets, type World, type Volley, type ServerMsg, type SelfState, type EntityRow, type GameEvent,
} from "@emberfall/shared";
import { Net } from "./net.ts";
import { buildChunk, CHUNK, drawEnemy, drawBag } from "./draw.ts";
import { Hud } from "./hud.ts";

interface RemoteEnt {
  id: number; kind: number; type: string;
  view: Container; body: Graphics; bar: Graphics; label?: Text;
  buf: Array<{ t: number; x: number; y: number }>;
  hp: number; maxHp: number; flash: number; seen: number; extra: string;
}
interface ClientVolley { v: Volley; dead: Uint8Array }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: number; size: number }
interface Floater { text: Text; x: number; y: number; age: number }

export class ClientGame {
  private app!: Application;
  private world!: World;
  private net: Net;
  private hud = new Hud();
  private worldLayer = new Container({ isRenderGroup: true });
  private terrain = new Container();
  private entLayer = new Container();
  private fxLayer = new Graphics();
  private labelLayer = new Container();
  private chunks = new Map<number, Graphics>();
  private ents = new Map<number, RemoteEnt>();
  private volleys = new Map<string, ClientVolley>();
  private serverToLocal = new Map<number, string>();
  private particles: Particle[] = [];
  private floaters: Floater[] = [];
  private me!: SelfState;
  private myId = 0;
  private pos = { x: 0, y: 0 };
  private corr = { x: 0, y: 0 };
  private pending: Array<{ seq: number; dt: number; mx: number; my: number }> = [];
  private seq = 0;
  private acc = 0;
  private keys = new Set<string>();
  private mouse = { x: 0, y: 0, down: false };
  private autofire = false;
  private lastShot = -Infinity;
  private cid = 0;
  private tilePx = 32;
  private shake = 0;
  private selfView = new Container();
  private selfBody = new Graphics();
  private selfAim = new Graphics();
  private destroyed = false;

  constructor(net: Net, private onDeath: (m: Extract<ServerMsg, { t: "died" }>) => void) {
    this.net = net;
  }

  async start(welcome: Extract<ServerMsg, { t: "welcome" }>, mount: HTMLElement): Promise<void> {
    this.myId = welcome.id;
    this.world = generateWorld(welcome.seed);
    this.app = new Application();
    await this.app.init({ background: "#0d0b0a", resizeTo: window, antialias: true, autoDensity: true, resolution: Math.min(devicePixelRatio, 2) });
    mount.appendChild(this.app.canvas);

    this.worldLayer.addChild(this.terrain, this.entLayer, this.fxLayer, this.labelLayer);
    this.app.stage.addChild(this.worldLayer);
    this.selfView.addChild(this.selfAim, this.selfBody);
    this.entLayer.addChild(this.selfView);

    this.hud.show();
    this.hud.buildMinimap(this.world);
    this.bindInput();
    this.resize();
    window.addEventListener("resize", this.resize);
    this.app.ticker.add((t) => this.frame(t.deltaMS));
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    window.removeEventListener("resize", this.resize);
    this.unbind?.();
    this.hud.hide();
    this.app?.destroy({ removeView: true }, { children: true });
  }

  // ---------------- input ----------------

  private unbind?: () => void;
  private bindInput(): void {
    const kd = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === "t") { this.autofire = !this.autofire; this.hud.toast(this.autofire ? "Autofire on" : "Autofire off"); }
      this.keys.add(k);
    };
    const ku = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());
    const mm = (e: PointerEvent) => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; };
    const md = (e: PointerEvent) => { if (e.button === 0) this.mouse.down = true; mm(e); };
    const mu = (e: PointerEvent) => { if (e.button === 0) this.mouse.down = false; };
    const blur = () => { this.keys.clear(); this.mouse.down = false; };
    const cm = (e: Event) => e.preventDefault();
    window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);
    window.addEventListener("pointermove", mm); window.addEventListener("pointerdown", md);
    window.addEventListener("pointerup", mu); window.addEventListener("blur", blur);
    window.addEventListener("contextmenu", cm);
    this.unbind = () => {
      window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku);
      window.removeEventListener("pointermove", mm); window.removeEventListener("pointerdown", md);
      window.removeEventListener("pointerup", mu); window.removeEventListener("blur", blur);
      window.removeEventListener("contextmenu", cm);
    };
  }

  private moveInput(): { mx: number; my: number } {
    const k = this.keys;
    const mx = (k.has("d") || k.has("arrowright") ? 1 : 0) - (k.has("a") || k.has("arrowleft") ? 1 : 0);
    const my = (k.has("s") || k.has("arrowdown") ? 1 : 0) - (k.has("w") || k.has("arrowup") ? 1 : 0);
    return { mx, my };
  }

  private resize = (): void => {
    // Keep the visible area inside the server's interest radius.
    this.tilePx = Math.max(20, Math.ceil(Math.max(innerHeight / 24, innerWidth / 34)));
    this.worldLayer.scale.set(this.tilePx);
    for (const e of this.ents.values()) e.label?.scale.set(1 / this.tilePx);
    for (const f of this.floaters) f.text.scale.set(1 / this.tilePx);
  };

  // ---------------- network ----------------

  handle(m: ServerMsg): void {
    if (m.t === "snap") this.onSnap(m);
    else if (m.t === "died") { this.onDeath(m); }
  }

  private onSnap(m: Extract<ServerMsg, { t: "snap" }>): void {
    const first = !this.me;
    this.me = m.self;
    if (first) { this.pos.x = m.self.x; this.pos.y = m.self.y; this.drawSelf(); }

    // Reconcile own position: rewind to the server, replay unacked inputs.
    const before = { x: this.pos.x, y: this.pos.y };
    this.pending = this.pending.filter((p) => p.seq > m.self.ack);
    const p = { x: m.self.x, y: m.self.y };
    const spd = CLASSES[m.self.cls].speed;
    for (const inp of this.pending) stepPlayer(this.world, p, inp.mx, inp.my, spd, inp.dt);
    const ex = before.x - p.x, ey = before.y - p.y;
    if (ex * ex + ey * ey > 4) { this.corr.x = 0; this.corr.y = 0; } // teleport, don't smooth
    else { this.corr.x += ex; this.corr.y += ey; }
    this.pos = p;

    for (const row of m.ents) this.upsertEnt(row, m.time);
    for (const [id, e] of this.ents) {
      if (e.seen !== m.time) { e.view.destroy({ children: true }); e.label?.destroy(); this.ents.delete(id); }
    }
    for (const ev of m.ev) this.onEvent(ev);
    this.hud.update(m.self, m.online);
  }

  private upsertEnt(row: EntityRow, t: number): void {
    const [id, kind, type, x, y, hp, maxHp, extra] = row;
    if (id === this.myId) return;
    let e = this.ents.get(id);
    if (!e) {
      const view = new Container(), body = new Graphics(), bar = new Graphics();
      view.addChild(body, bar);
      e = { id, kind, type, view, body, bar, buf: [], hp, maxHp, flash: 0, seen: t, extra };
      if (kind === 0) {
        body.circle(0, 0, PLAYER_RADIUS + 0.05).fill(CLASSES[type as keyof typeof CLASSES].color).stroke({ color: 0x111111, width: 0.07 });
        e.label = this.makeLabel(extra, 0xf3e9dc);
      } else if (kind === 1) {
        drawEnemy(body, ENEMIES[type]);
        if (ENEMIES[type].boss) e.label = this.makeLabel(ENEMIES[type].name, 0xff8a3d);
      } else drawBag(body, type, extra === "soulbound");
      if (e.label) this.labelLayer.addChild(e.label);
      this.entLayer.addChildAt(view, kind === 2 ? 0 : this.entLayer.children.length);
      this.ents.set(id, e);
    }
    e.seen = t;
    if (hp < e.hp) e.flash = 1;
    e.hp = hp; e.maxHp = maxHp;
    e.buf.push({ t, x, y });
    if (e.buf.length > 20) e.buf.shift();
  }

  private makeLabel(s: string, color: number): Text {
    const t = new Text({ text: s, style: { fontFamily: "system-ui, sans-serif", fontSize: 12, fill: color, fontWeight: "600", stroke: { color: 0x000000, width: 3 } } });
    t.anchor.set(0.5, 1);
    t.scale.set(1 / this.tilePx);
    return t;
  }

  private onEvent(ev: GameEvent): void {
    switch (ev.e) {
      case "volley": {
        if (ev.v.owner === this.myId && ev.v.cid !== undefined) {
          this.serverToLocal.set(ev.v.id, "c" + ev.v.cid);
          return;
        }
        this.volleys.set("s" + ev.v.id, { v: ev.v, dead: new Uint8Array(ev.v.count) });
        break;
      }
      case "bdead": {
        const key = this.serverToLocal.get(ev.vid) ?? "s" + ev.vid;
        const cv = this.volleys.get(key);
        if (cv) cv.dead[ev.i] = 1;
        break;
      }
      case "dmg": {
        const self = ev.id === this.myId;
        this.floater(`-${ev.amount}`, ev.x, ev.y - 0.6, self ? 0xff5050 : 0xffffff);
        if (self) this.shake = Math.min(0.35, this.shake + 0.12);
        break;
      }
      case "kill": {
        const def = ENEMIES[ev.type];
        this.burst(ev.x, ev.y, def?.color ?? 0xffffff, def?.boss ? 90 : 14);
        if (def?.boss) this.shake = 0.6;
        break;
      }
      case "loot": this.hud.toast(`Picked up ${ev.name}`); break;
      case "level": this.hud.toast(`Level ${ev.level}!`); this.burst(this.pos.x, this.pos.y, 0xf0b93a, 30); break;
      case "feed": this.hud.feed(ev.text); break;
    }
  }

  // ---------------- frame ----------------

  private frame(dtMs: number): void {
    if (!this.me) return;
    dtMs = Math.min(dtMs, 100);
    const now = this.net.serverNow();

    // Fixed-step prediction for own movement.
    this.acc += dtMs;
    const spd = CLASSES[this.me.cls].speed;
    while (this.acc >= CLIENT_STEP_MS) {
      this.acc -= CLIENT_STEP_MS;
      const { mx, my } = this.moveInput();
      const inp = { seq: ++this.seq, dt: CLIENT_STEP_MS, mx, my };
      stepPlayer(this.world, this.pos, mx, my, spd, inp.dt);
      this.pending.push(inp);
      this.net.send({ t: "in", ...inp });
    }
    const decay = Math.pow(0.0001, dtMs / 1000 * 4);
    this.corr.x *= decay; this.corr.y *= decay;
    const vx = this.pos.x + this.corr.x, vy = this.pos.y + this.corr.y;

    // Camera: centre on player, slight look-ahead toward the cursor, plus shake.
    const sw = this.app.screen.width, sh = this.app.screen.height;
    const aimX = (this.mouse.x - sw / 2) / this.tilePx, aimY = (this.mouse.y - sh / 2) / this.tilePx;
    const look = 0.12;
    this.shake = Math.max(0, this.shake - dtMs / 1000);
    const sx = (Math.random() - 0.5) * this.shake, sy = (Math.random() - 0.5) * this.shake;
    const camX = vx + aimX * look + sx, camY = vy + aimY * look + sy;
    this.worldLayer.position.set(sw / 2 - camX * this.tilePx, sh / 2 - camY * this.tilePx);

    // Shooting (predicted locally, confirmed by the server).
    const worldMouseX = camX + aimX, worldMouseY = camY + aimY;
    const angle = Math.atan2(worldMouseY - vy, worldMouseX - vx);
    const weapon = CLASSES[this.me.cls].weapons[this.me.weaponTier];
    if ((this.mouse.down || this.autofire) && now - this.lastShot >= weapon.cooldown) {
      this.lastShot = now;
      const cid = ++this.cid;
      const v: Volley = { ...weapon.pattern, id: -cid, owner: this.myId, team: 0, x: this.pos.x, y: this.pos.y, angle, t0: now, cid, color: CLASSES[this.me.cls].color };
      this.volleys.set("c" + cid, { v, dead: new Uint8Array(v.count) });
      this.net.send({ t: "shoot", angle, cid });
    }

    this.selfView.position.set(vx, vy);
    this.selfAim.rotation = angle;
    this.updateChunks(camX, camY);
    this.renderEnts(now - INTERP_DELAY_MS, dtMs);
    this.renderFx(now, dtMs);
    this.hud.minimapDot(this.pos.x, this.pos.y);
  }

  private drawSelf(): void {
    const c = CLASSES[this.me.cls].color;
    this.selfBody.clear().circle(0, 0, PLAYER_RADIUS + 0.05).fill(c).stroke({ color: 0xffffff, width: 0.08 });
    this.selfAim.clear().roundRect(0.15, -0.06, 0.55, 0.12, 0.05).fill(0xf3e9dc);
  }

  private updateChunks(cx: number, cy: number): void {
    const hw = this.app.screen.width / this.tilePx / 2 + 1, hh = this.app.screen.height / this.tilePx / 2 + 1;
    const x0 = Math.max(0, Math.floor((cx - hw) / CHUNK)), x1 = Math.floor((cx + hw) / CHUNK);
    const y0 = Math.max(0, Math.floor((cy - hh) / CHUNK)), y1 = Math.floor((cy + hh) / CHUNK);
    const max = Math.ceil(this.world.size / CHUNK) - 1;
    for (const [k, g] of this.chunks) {
      const kx = k % 1000, ky = Math.floor(k / 1000);
      g.visible = kx >= x0 && kx <= x1 && ky >= y0 && ky <= y1;
    }
    for (let y = y0; y <= Math.min(y1, max); y++) {
      for (let x = x0; x <= Math.min(x1, max); x++) {
        const k = y * 1000 + x;
        if (!this.chunks.has(k)) { const g = buildChunk(this.world, x, y); this.chunks.set(k, g); this.terrain.addChild(g); }
      }
    }
  }

  private renderEnts(rt: number, dtMs: number): void {
    for (const e of this.ents.values()) {
      const b = e.buf;
      let x = b[b.length - 1].x, y = b[b.length - 1].y;
      for (let i = b.length - 1; i > 0; i--) {
        if (b[i - 1].t <= rt) {
          const a = b[i - 1], c = b[i];
          const f = Math.min(1, Math.max(0, (rt - a.t) / (c.t - a.t || 1)));
          x = a.x + (c.x - a.x) * f; y = a.y + (c.y - a.y) * f;
          break;
        }
        if (i === 1) { x = b[0].x; y = b[0].y; }
      }
      e.view.position.set(x, y);
      if (e.kind === 2) { e.view.y += Math.sin(performance.now() / 300 + e.id) * 0.04; continue; }
      e.flash = Math.max(0, e.flash - dtMs / 120);
      e.body.tint = e.flash > 0 ? 0xffaaaa : 0xffffff;
      e.body.scale.set(1 + e.flash * 0.12);
      const r = e.kind === 1 ? ENEMIES[e.type].radius : PLAYER_RADIUS;
      const showBar = e.hp < e.maxHp;
      e.bar.clear();
      if (showBar) {
        const w = Math.max(0.8, r * 2);
        e.bar.rect(-w / 2, r + 0.15, w, 0.12).fill(0x220000).rect(-w / 2, r + 0.15, w * (e.hp / e.maxHp), 0.12).fill(e.kind === 0 ? 0x7bd88f : 0xe04848);
      }
      if (e.label) e.label.position.set(x, y - r - 0.15);
    }
  }

  private renderFx(now: number, dtMs: number): void {
    const g = this.fxLayer;
    g.clear();
    const tmp = { x: 0, y: 0 };
    for (const [k, cv] of this.volleys) {
      const v = cv.v;
      if (volleyExpired(v, now)) { this.volleys.delete(k); continue; }
      if (now < v.t0) continue;
      for (let i = 0; i < v.count; i++) {
        if (cv.dead[i]) continue;
        bulletPos(v, i, now, tmp);
        if (blocksBullets(this.world, tmp.x, tmp.y)) { cv.dead[i] = 1; continue; }
        if (v.team === 1) {
          g.circle(tmp.x, tmp.y, v.radius * 1.15).fill({ color: v.color, alpha: 0.95 }).stroke({ color: 0x1a0505, width: 0.05 });
          g.circle(tmp.x, tmp.y, v.radius * 0.5).fill(0xffffff);
        } else {
          g.circle(tmp.x, tmp.y, v.radius).fill({ color: v.color, alpha: v.owner === this.myId ? 0.95 : 0.5 });
        }
      }
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dtMs;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      p.x += p.vx * dtMs / 1000; p.y += p.vy * dtMs / 1000;
      p.vx *= 0.94; p.vy *= 0.94;
      g.circle(p.x, p.y, p.size * (p.life / p.max)).fill({ color: p.color, alpha: p.life / p.max });
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.age += dtMs;
      if (f.age > 700) { f.text.destroy(); this.floaters.splice(i, 1); continue; }
      f.text.position.set(f.x, f.y - f.age / 700);
      f.text.alpha = 1 - f.age / 700;
    }
  }

  private burst(x: number, y: number, color: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 5;
      const max = 300 + Math.random() * 400;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: max, max, color, size: 0.08 + Math.random() * 0.12 });
    }
  }

  private floater(s: string, x: number, y: number, color: number): void {
    if (this.floaters.length > 60) return;
    const t = new Text({ text: s, style: { fontFamily: "system-ui, sans-serif", fontSize: 14, fontWeight: "700", fill: color, stroke: { color: 0x000000, width: 3 } } });
    t.anchor.set(0.5);
    t.scale.set(1 / this.tilePx);
    this.labelLayer.addChild(t);
    this.floaters.push({ text: t, x, y, age: 0 });
  }
}
