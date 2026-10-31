import { Application, Container, Graphics, Text } from "pixi.js";
import {
  CLASSES, ENEMIES, CLIENT_STEP_MS, INTERP_DELAY_MS, PLAYER_RADIUS, generateWorld, stepPlayer, bulletPos, volleyExpired,
  blocksBullets, type World, type Volley, type ServerMsg, type SelfState, type EntityRow, type GameEvent,
} from "@emberfall/shared";
import { Net } from "./net.ts";
import { buildChunk, CHUNK, drawEnemy, drawBag } from "./draw.ts";
import { loadArt, buildChunkSprites, CreatureSprite, bagView, ART_PX, type Art } from "./sprites.ts";
import { Hud } from "./hud.ts";
import { TouchSticks } from "./touch.ts";

interface RemoteEnt {
  id: number; kind: number; type: string;
  view: Container; body: Container; bar: Graphics; label?: Text;
  creature?: CreatureSprite; lastX: number; lastY: number;
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
  private chunks = new Map<number, Container>();
  private art: Art | null = null;
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
  private touch?: TouchSticks;
  private autofire = false;
  private lastShot = -Infinity;
  private cid = 0;
  private tilePx = 32;
  private shake = 0;
  private selfView = new Container();
  private selfBody = new Graphics();
  private selfSprite?: CreatureSprite;
  private selfDrawn = false;
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
    this.art = await loadArt();

    this.worldLayer.addChild(this.terrain, this.entLayer, this.fxLayer, this.labelLayer);
    this.app.stage.addChild(this.worldLayer);
    this.selfView.addChild(this.selfAim, this.selfBody);
    this.entLayer.addChild(this.selfView);

    this.hud.show();
    this.hud.buildMinimap(this.world);
    this.bindInput();
    this.touch = new TouchSticks(mount);
    this.resize();
    window.addEventListener("resize", this.resize);
    this.app.ticker.add((t) => this.frame(t.deltaMS));
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    window.removeEventListener("resize", this.resize);
    this.unbind?.();
    this.touch?.destroy();
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
    // Touch pointers belong to the sticks (touch.ts); these handlers are for the mouse and pen.
    const mm = (e: PointerEvent) => { if (e.pointerType === "touch") return; this.mouse.x = e.clientX; this.mouse.y = e.clientY; if (this.touch) this.touch.used = false; };
    const md = (e: PointerEvent) => { if (e.pointerType === "touch") return; if (e.button === 0) this.mouse.down = true; mm(e); };
    const mu = (e: PointerEvent) => { if (e.pointerType === "touch") return; if (e.button === 0) this.mouse.down = false; };
    const blur = () => { this.keys.clear(); this.mouse.down = false; this.touch?.release(); };
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
    if (mx === 0 && my === 0 && this.touch) return this.touch.moveInput();
    return { mx, my };
  }

  private resize = (): void => {
    // Keep the visible area inside the server's interest radius: at most 34 tiles on the long
    // side and 24 on the short side (portrait phones turn the box, so they see more ground).
    const long = Math.max(innerWidth, innerHeight), short = Math.min(innerWidth, innerHeight);
    const need = Math.max(20, Math.ceil(Math.max(short / 24, long / 34)));
    // Sprites: the smallest whole multiple of 32 px that still fits inside the radius (crisp pixels).
    this.tilePx = this.art ? Math.ceil(need / ART_PX) * ART_PX : need;
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
    if (first) { this.pos.x = m.self.x; this.pos.y = m.self.y; }

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
      const view = new Container(), bar = new Graphics();
      const art = this.art, radius = kind === 1 ? ENEMIES[type].radius : PLAYER_RADIUS;
      let body: Container, creature: CreatureSprite | undefined;
      if (art && kind !== 2 && art.frames(type).length) { creature = new CreatureSprite(art, type, radius); body = creature.view; }
      else if (art && kind === 2 && bagView(art, type, extra === "soulbound")) body = bagView(art, type, extra === "soulbound")!;
      else {
        const g = new Graphics(); body = g;
        if (kind === 0) g.circle(0, 0, PLAYER_RADIUS + 0.05).fill(CLASSES[type as keyof typeof CLASSES].color).stroke({ color: 0x111111, width: 0.07 });
        else if (kind === 1) drawEnemy(g, ENEMIES[type]);
        else drawBag(g, type, extra === "soulbound");
      }
      view.addChild(body, bar);
      e = { id, kind, type, view, body, bar, buf: [], hp, maxHp, flash: 0, seen: t, extra, creature, lastX: x, lastY: y };
      if (kind === 0) e.label = this.makeLabel(extra, 0xf3e9dc);
      else if (kind === 1 && ENEMIES[type].boss) e.label = this.makeLabel(ENEMIES[type].name, 0xff8a3d);
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
    if (!this.selfDrawn) { this.selfDrawn = true; this.drawSelf(); } // after the atlas has loaded
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
    const touchAim = this.touch?.used ? this.touch.aimInput() : undefined;
    // Touch: the right stick gives a direction; look ahead up to 4 tiles that way.
    const aimX = touchAim ? Math.cos(touchAim.angle) * (touchAim.fire ? 4 : 0) : (this.mouse.x - sw / 2) / this.tilePx;
    const aimY = touchAim ? Math.sin(touchAim.angle) * (touchAim.fire ? 4 : 0) : (this.mouse.y - sh / 2) / this.tilePx;
    const look = 0.12;
    this.shake = Math.max(0, this.shake - dtMs / 1000);
    const sx = (Math.random() - 0.5) * this.shake, sy = (Math.random() - 0.5) * this.shake;
    const camX = vx + aimX * look + sx, camY = vy + aimY * look + sy;
    // Whole screen pixels, so tile edges stay sharp with no gaps.
    const res = this.app.renderer.resolution;
    this.worldLayer.position.set(Math.round((sw / 2 - camX * this.tilePx) * res) / res, Math.round((sh / 2 - camY * this.tilePx) * res) / res);

    // Shooting (predicted locally, confirmed by the server).
    const worldMouseX = camX + aimX, worldMouseY = camY + aimY;
    const angle = touchAim ? touchAim.angle : Math.atan2(worldMouseY - vy, worldMouseX - vx);
    const weapon = CLASSES[this.me.cls].weapons[this.me.weaponTier];
    if ((this.mouse.down || this.autofire || touchAim?.fire) && now - this.lastShot >= weapon.cooldown) {
      this.lastShot = now;
      const cid = ++this.cid;
      const v: Volley = { ...weapon.pattern, id: -cid, owner: this.myId, team: 0, x: this.pos.x, y: this.pos.y, angle, t0: now, cid, color: CLASSES[this.me.cls].color };
      this.volleys.set("c" + cid, { v, dead: new Uint8Array(v.count) });
      this.net.send({ t: "shoot", angle, cid });
    }

    this.selfView.position.set(vx, vy);
    this.selfAim.rotation = angle;
    if (this.selfSprite) {
      const { mx, my } = this.moveInput();
      this.selfSprite.update(dtMs, mx, my, mx !== 0 || my !== 0);
    }
    this.updateChunks(camX, camY);
    this.renderEnts(now - INTERP_DELAY_MS, dtMs);
    this.renderFx(now, dtMs);
    this.hud.minimapDot(this.pos.x, this.pos.y);
  }

  private drawSelf(): void {
    const c = CLASSES[this.me.cls].color;
    this.selfAim.clear().roundRect(0.15, -0.06, 0.55, 0.12, 0.05).fill({ color: 0xf3e9dc, alpha: this.art ? 0.6 : 1 });
    if (this.art && this.art.frames(this.me.cls).length) {
      this.selfSprite = new CreatureSprite(this.art, this.me.cls, PLAYER_RADIUS);
      this.selfBody.clear().ellipse(0, 0.46, 0.4, 0.14).stroke({ color: 0xf3e9dc, width: 0.04, alpha: 0.7 }); // "you" ring
      this.selfView.addChild(this.selfSprite.view);
    } else this.selfBody.clear().circle(0, 0, PLAYER_RADIUS + 0.05).fill(c).stroke({ color: 0xffffff, width: 0.08 });
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
        if (!this.chunks.has(k)) { const g = this.art ? buildChunkSprites(this.art, this.world, x, y) : buildChunk(this.world, x, y); this.chunks.set(k, g); this.terrain.addChild(g); }
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
      if (e.creature) {
        const dx = x - e.lastX, dy = y - e.lastY;
        e.creature.update(dtMs, dx, dy, dx * dx + dy * dy > 1e-6 * dtMs * dtMs);
        e.lastX = x; e.lastY = y;
      }
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
          // Style guide section 4: 2 px ink ring, 1 px hue band, white core (sea100 for blue enemies).
          const R = v.radius * 1.15, px = 1 / ART_PX;
          g.circle(tmp.x, tmp.y, R).fill(0x14100e);
          g.circle(tmp.x, tmp.y, R - 2 * px).fill(v.color);
          g.circle(tmp.x, tmp.y, R - 3 * px).fill((v.color & 0xff) > 0xc0 && ((v.color >> 16) & 0xff) < 0x90 ? 0xd9f5ff : 0xf3e9dc);
        } else {
          g.circle(tmp.x, tmp.y, v.radius).fill({ color: v.color, alpha: v.owner === this.myId ? 0.85 : 0.5 });
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
