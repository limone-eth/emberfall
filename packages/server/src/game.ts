import type { WebSocket } from "ws";
import {
  CLASSES, ENEMIES, ENEMIES_BY_TIER, TICK_MS, VIEW_RADIUS, VOLLEY_VIEW_RADIUS, PICKUP_RADIUS, XP_SHARE_RADIUS,
  MAX_LEVEL, PLAYER_RADIUS, xpToNext, maxHpFor, damageMultFor, generateWorld, shoreSpawns, stepPlayer, moveEntity,
  bulletPos, volleyExpired, blocksBullets, isSolid, tierAt, itemName,
  type World, type Volley, type EnemyDef, type ClassId, type Item, type EntityRow, type GameEvent, type ServerMsg, type ClientMsg,
} from "@emberfall/shared";
import { SpatialGrid } from "./grid.ts";
import type { Db } from "./db.ts";

interface Player {
  id: number;
  ws: WebSocket;
  accountId: number;
  charId: number;
  name: string;
  cls: ClassId;
  x: number; y: number;
  hp: number; maxHp: number;
  level: number; xp: number;
  weaponTier: number;
  inputs: Array<{ seq: number; dt: number; mx: number; my: number }>;
  ack: number;
  moveBudget: number;
  lastShot: number;
  lastHitBy: string;
  lastDamagedAt: number;
  events: GameEvent[];
  dead: boolean;
}

interface Enemy {
  id: number;
  def: EnemyDef;
  x: number; y: number;
  hp: number;
  homeTier: number;
  dirX: number; dirY: number;
  wanderUntil: number;
  attackAt: number[];
  spin: number[];
  orbitSign: number;
  lastNearPlayer: number;
}

interface LiveVolley extends Volley {
  dead: Uint8Array;
  pierced?: Array<Set<number>>;
  owner: number;
  ownerName: string;
  dmgMult: number;
}

interface Bag {
  id: number;
  x: number; y: number;
  item: Item;
  owner: number | null;
  expires: number;
}

type Located = { x: number; y: number; ev: GameEvent; only?: number };

const MAX_ENEMIES = 420;
const BOSS_RESPAWN_MS = 3 * 60_000;

export class Game {
  readonly world: World;
  private spawns: Array<{ x: number; y: number }>;
  private players = new Map<number, Player>();
  private enemies = new Map<number, Enemy>();
  private volleys = new Map<number, LiveVolley>();
  private bags = new Map<number, Bag>();
  private enemyGrid = new SpatialGrid<Enemy>(4);
  private playerGrid = new SpatialGrid<Player>(8);
  private worldEvents: Located[] = [];
  private nextId = 1;
  private start = performance.now();
  private bossDeadAt = -Infinity;
  private bossId = 0;
  private lastSave = 0;

  constructor(readonly seed: number, private db: Db) {
    this.world = generateWorld(seed);
    this.spawns = shoreSpawns(this.world);
    // Dev only: DEV_SPAWN_TIER=0..4 spawns new players inside that biome tier (for art and balance checks).
    const devTier = process.env.DEV_SPAWN_TIER;
    if (devTier !== undefined) {
      const w = this.world, want = Number(devTier), list: Array<{ x: number; y: number }> = [];
      for (let y = 0; y < w.size; y += 3) for (let x = 0; x < w.size; x += 3)
        if (tierAt(w, x + 0.5, y + 0.5) === want && !isSolid(w, x + 0.5, y + 0.5)) list.push({ x: x + 0.5, y: y + 0.5 });
      if (list.length) { this.spawns = list; console.log(`[dev] spawning in tier ${want} (${list.length} spots)`); }
    }
  }

  now(): number { return performance.now() - this.start; }
  get online(): number { return this.players.size; }

  // ---------------- connection lifecycle ----------------

  join(ws: WebSocket, accountId: number, name: string, cls: ClassId, token: string): Player {
    let ch = this.db.aliveCharacter(accountId);
    const resumed = !!ch;
    if (!ch) ch = this.db.createCharacter(accountId, cls);
    const c = CLASSES[ch.cls];
    const sp = this.spawns[Math.floor(Math.random() * this.spawns.length)];
    const p: Player = {
      id: this.nextId++, ws, accountId, charId: ch.id, name, cls: ch.cls,
      x: sp.x, y: sp.y, hp: maxHpFor(c, ch.level), maxHp: maxHpFor(c, ch.level),
      level: ch.level, xp: ch.xp, weaponTier: ch.weapon_tier,
      inputs: [], ack: 0, moveBudget: 0, lastShot: -Infinity, lastHitBy: "the void", lastDamagedAt: -Infinity,
      events: [], dead: false,
    };
    this.players.set(p.id, p);
    this.send(p, { t: "welcome", id: p.id, seed: this.seed, token, serverTime: this.now(), resumed });
    this.broadcastFeed(`${name} the ${c.name} washes ashore.`);
    return p;
  }

  leave(p: Player): void {
    if (!this.players.has(p.id)) return;
    if (!p.dead) this.db.saveCharacter({ id: p.charId, level: p.level, xp: p.xp, weaponTier: p.weaponTier });
    this.players.delete(p.id);
  }

  handle(p: Player, msg: ClientMsg): void {
    if (p.dead) return;
    switch (msg.t) {
      case "in": {
        if (p.inputs.length > 120) return; // flood guard
        const mx = clamp(+msg.mx || 0, -1, 1), my = clamp(+msg.my || 0, -1, 1);
        p.inputs.push({ seq: msg.seq | 0, dt: clamp(+msg.dt || 0, 0, 50), mx, my });
        break;
      }
      case "shoot": this.playerShoot(p, +msg.angle || 0, msg.cid | 0); break;
      case "ping": this.send(p, { t: "pong", c: +msg.c || 0, s: this.now() }); break;
    }
  }

  // ---------------- simulation ----------------

  tick(): void {
    const now = this.now();
    this.rebuildGrids();
    for (const p of this.players.values()) this.updatePlayer(p, now);
    this.rebuildGrids();
    for (const e of this.enemies.values()) this.updateEnemy(e, now);
    this.updateVolleys(now);
    this.updateBags(now);
    this.spawnEnemies(now);
    this.sendSnapshots(now);
    if (now - this.lastSave > 15_000) {
      this.lastSave = now;
      for (const p of this.players.values()) this.db.saveCharacter({ id: p.charId, level: p.level, xp: p.xp, weaponTier: p.weaponTier });
    }
  }

  private rebuildGrids(): void {
    this.enemyGrid.clear();
    for (const e of this.enemies.values()) this.enemyGrid.insert(e);
    this.playerGrid.clear();
    for (const p of this.players.values()) if (!p.dead) this.playerGrid.insert(p);
  }

  private updatePlayer(p: Player, now: number): void {
    // Movement budget: a client can't move more than real time allows (anti speed-hack).
    p.moveBudget = Math.min(p.moveBudget + TICK_MS, 300);
    const speed = CLASSES[p.cls].speed;
    while (p.inputs.length && p.inputs[0].dt <= p.moveBudget) {
      const inp = p.inputs.shift()!;
      p.moveBudget -= inp.dt;
      stepPlayer(this.world, p, inp.mx, inp.my, speed, inp.dt);
      p.ack = inp.seq;
    }
    // Regen: slow, faster out of combat.
    const regen = now - p.lastDamagedAt > 5000 ? 0.06 : 0.008;
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * regen * (TICK_MS / 1000));
  }

  private playerShoot(p: Player, angle: number, cid: number): void {
    const now = this.now();
    const w = CLASSES[p.cls].weapons[p.weaponTier];
    if (now - p.lastShot < w.cooldown * 0.85) return;
    p.lastShot = now;
    const v: LiveVolley = {
      ...w.pattern, id: this.nextId++, owner: p.id, ownerName: p.name, team: 0,
      x: p.x, y: p.y, angle, t0: now, cid, color: CLASSES[p.cls].color,
      dead: new Uint8Array(w.pattern.count), dmgMult: damageMultFor(p.level),
      pierced: w.pattern.pierce ? Array.from({ length: w.pattern.count }, () => new Set<number>()) : undefined,
    };
    this.addVolley(v);
  }

  private addVolley(v: LiveVolley): void {
    this.volleys.set(v.id, v);
    const { dead: _d, pierced: _p, ownerName: _n, dmgMult: _m, ...wire } = v;
    this.worldEvents.push({ x: v.x, y: v.y, ev: { e: "volley", v: wire } });
  }

  private nearestPlayer(x: number, y: number, range: number): Player | null {
    let best: Player | null = null, bd = range * range;
    this.playerGrid.query(x, y, range, (p) => {
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bd) { bd = d; best = p; }
    });
    return best;
  }

  private updateEnemy(e: Enemy, now: number): void {
    const def = e.def;
    const dt = TICK_MS / 1000;
    const target = this.nearestPlayer(e.x, e.y, def.aggro);
    if (target || this.nearestPlayer(e.x, e.y, 40)) e.lastNearPlayer = now;

    // ----- movement -----
    let mx = 0, my = 0;
    const tx = target ? target.x - e.x : 0, ty = target ? target.y - e.y : 0;
    const td = Math.hypot(tx, ty) || 1;
    switch (def.behavior) {
      case "chase":
        if (target && td > 2.2) { mx = tx / td; my = ty / td; }
        else if (!target) ({ mx, my } = this.wander(e, now, 0.4));
        break;
      case "orbit":
        if (target) {
          const radial = td > 5.5 ? 1 : td < 4 ? -1 : 0;
          mx = (tx / td) * radial + (-ty / td) * e.orbitSign;
          my = (ty / td) * radial + (tx / td) * e.orbitSign;
        } else ({ mx, my } = this.wander(e, now, 0.5));
        break;
      case "skirmish":
        if (target) {
          const radial = td > 7 ? 1 : td < 4.5 ? -0.8 : 0;
          mx = (tx / td) * radial + (-ty / td) * e.orbitSign * 0.7;
          my = (ty / td) * radial + (tx / td) * e.orbitSign * 0.7;
          if (now > e.wanderUntil) { e.orbitSign *= -1; e.wanderUntil = now + 1500 + Math.random() * 1500; }
        } else ({ mx, my } = this.wander(e, now, 0.5));
        break;
      case "wander":
        ({ mx, my } = this.wander(e, now, target ? 0.8 : 0.5));
        break;
      case "still": break;
    }
    if (mx || my) {
      const len = Math.hypot(mx, my) || 1;
      const step = def.speed * dt;
      const dx = (mx / len) * step, dy = (my / len) * step;
      // Enemies stay in their own biome ring so tier-4 monsters don't wander onto the beach.
      const nt = tierAt(this.world, e.x + dx * 4, e.y + dy * 4);
      if (nt === e.homeTier) {
        if (!moveEntity(this.world, e, dx, dy, Math.min(def.radius, 0.45))) e.wanderUntil = 0;
      } else e.wanderUntil = 0;
    }

    // ----- attacks -----
    def.attacks.forEach((atk, i) => {
      if (now < e.attackAt[i]) return;
      if (!target || td > atk.range) return;
      e.attackAt[i] = now + atk.cooldown * (0.9 + Math.random() * 0.2);
      let angle: number;
      if (atk.aim === "target") angle = Math.atan2(ty, tx);
      else if (atk.aim === "spin") { e.spin[i] += atk.spinStep ?? 0.3; angle = e.spin[i]; }
      else angle = Math.random() * Math.PI * 2;
      this.addVolley({
        ...atk.pattern, id: this.nextId++, owner: e.id, ownerName: def.name, team: 1,
        x: e.x, y: e.y, angle, t0: now, color: def.color, dead: new Uint8Array(atk.pattern.count), dmgMult: 1,
      });
    });
  }

  private wander(e: Enemy, now: number, speedFrac: number): { mx: number; my: number } {
    if (now > e.wanderUntil) {
      const a = Math.random() * Math.PI * 2;
      const moving = Math.random() < 0.7;
      e.dirX = moving ? Math.cos(a) : 0;
      e.dirY = moving ? Math.sin(a) : 0;
      e.wanderUntil = now + 1000 + Math.random() * 2500;
    }
    return { mx: e.dirX * speedFrac, my: e.dirY * speedFrac };
  }

  private updateVolleys(now: number): void {
    const tmp = { x: 0, y: 0 };
    for (const v of this.volleys.values()) {
      // Two sub-steps per tick so fast bullets don't tunnel through targets.
      for (const t of [now - TICK_MS / 2, now]) {
        if (t < v.t0) continue;
        for (let i = 0; i < v.count; i++) {
          if (v.dead[i]) continue;
          bulletPos(v, i, Math.min(t, v.t0 + v.lifetime), tmp);
          if (blocksBullets(this.world, tmp.x, tmp.y)) { v.dead[i] = 1; continue; }
          if (v.team === 0) this.hitEnemies(v, i, tmp.x, tmp.y, now);
          else this.hitPlayers(v, i, tmp.x, tmp.y, now);
        }
      }
      if (volleyExpired(v, now) || v.dead.every((d) => d)) this.volleys.delete(v.id);
    }
  }

  private hitEnemies(v: LiveVolley, i: number, x: number, y: number, now: number): void {
    this.enemyGrid.query(x, y, v.radius + 1.5, (e) => {
      if (v.dead[i] || e.hp <= 0) return;
      if (v.pierced?.[i].has(e.id)) return;
      const r = v.radius + e.def.radius;
      if ((e.x - x) ** 2 + (e.y - y) ** 2 > r * r) return;
      const raw = randInt(v.damage[0], v.damage[1]) * v.dmgMult;
      const dmg = Math.round(Math.max(raw * 0.15, raw - e.def.defense));
      e.hp -= dmg;
      this.worldEvents.push({ x, y, ev: { e: "dmg", id: e.id, amount: dmg, x: e.x, y: e.y } });
      if (v.pierced) v.pierced[i].add(e.id);
      else { v.dead[i] = 1; this.worldEvents.push({ x, y, ev: { e: "bdead", vid: v.id, i } }); }
      if (e.hp <= 0) this.killEnemy(e, v.ownerName, now);
    });
  }

  private hitPlayers(v: LiveVolley, i: number, x: number, y: number, now: number): void {
    this.playerGrid.query(x, y, v.radius + 1, (p) => {
      if (v.dead[i] || p.dead) return;
      const r = v.radius + PLAYER_RADIUS;
      if ((p.x - x) ** 2 + (p.y - y) ** 2 > r * r) return;
      v.dead[i] = 1;
      const raw = randInt(v.damage[0], v.damage[1]);
      const dmg = Math.round(Math.max(raw * 0.15, raw - CLASSES[p.cls].defense));
      p.hp -= dmg;
      p.lastHitBy = v.ownerName;
      p.lastDamagedAt = now;
      this.worldEvents.push({ x, y, ev: { e: "bdead", vid: v.id, i } });
      this.worldEvents.push({ x, y, ev: { e: "dmg", id: p.id, amount: dmg, x: p.x, y: p.y } });
      if (p.hp <= 0) this.killPlayer(p);
    });
  }

  private killEnemy(e: Enemy, by: string, now: number): void {
    this.enemies.delete(e.id);
    this.worldEvents.push({ x: e.x, y: e.y, ev: { e: "kill", id: e.id, x: e.x, y: e.y, type: e.def.id, by } });
    const near: Player[] = [];
    this.playerGrid.query(e.x, e.y, XP_SHARE_RADIUS, (p) => {
      if (!p.dead && (p.x - e.x) ** 2 + (p.y - e.y) ** 2 < XP_SHARE_RADIUS ** 2) near.push(p);
    });
    for (const p of near) this.giveXp(p, e.def.xp);

    if (e.def.boss) {
      this.bossDeadAt = now;
      this.broadcastFeed(`${e.def.name} has fallen to ${by} and ${Math.max(0, near.length - 1)} others!`);
      // Soulbound top-tier drop for everyone who was there.
      for (const p of near) {
        this.dropBag(e.x + rand(-1, 1), e.y + rand(-1, 1), { kind: "weapon", cls: p.cls, tier: 4 }, p.id, now);
        this.dropBag(e.x + rand(-1, 1), e.y + rand(-1, 1), { kind: "potion", heal: 120 }, p.id, now);
      }
      return;
    }
    if (Math.random() < e.def.dropChance && near.length) {
      const lucky = near[Math.floor(Math.random() * near.length)];
      const item: Item = Math.random() < 0.35
        ? { kind: "potion", heal: 40 + e.def.tier * 20 }
        : { kind: "weapon", cls: lucky.cls, tier: Math.min(4, e.def.tier + (Math.random() < 0.2 ? 1 : 0)) };
      this.dropBag(e.x, e.y, item, null, now);
    }
  }

  private giveXp(p: Player, amount: number): void {
    if (p.level >= MAX_LEVEL) return;
    p.xp += amount;
    while (p.level < MAX_LEVEL && p.xp >= xpToNext(p.level)) {
      p.xp -= xpToNext(p.level);
      p.level++;
      p.maxHp = maxHpFor(CLASSES[p.cls], p.level);
      p.hp = p.maxHp;
      p.events.push({ e: "level", level: p.level });
      if (p.level === MAX_LEVEL) this.broadcastFeed(`${p.name} reached level ${MAX_LEVEL}.`);
    }
    if (p.level >= MAX_LEVEL) p.xp = 0;
  }

  private killPlayer(p: Player): void {
    p.dead = true;
    let total = p.xp;
    for (let l = 1; l < p.level; l++) total += xpToNext(l);
    const fame = Math.floor(total / 10) + (p.level >= MAX_LEVEL ? 100 : 0);
    this.db.killCharacter({ id: p.charId, accountId: p.accountId, level: p.level, xp: p.xp, weaponTier: p.weaponTier }, fame, p.lastHitBy);
    this.broadcastFeed(`${p.name} the level ${p.level} ${CLASSES[p.cls].name} was slain by ${p.lastHitBy}.`);
    this.send(p, { t: "died", killedBy: p.lastHitBy, level: p.level, fame, graveyard: this.db.graveyard(p.accountId) });
    this.players.delete(p.id);
  }

  private dropBag(x: number, y: number, item: Item, owner: number | null, now: number): void {
    if (isSolid(this.world, x, y)) { x = Math.floor(x) + 0.5; y = Math.floor(y) + 0.5; }
    const b: Bag = { id: this.nextId++, x, y, item, owner, expires: now + (owner ? 120_000 : 45_000) };
    this.bags.set(b.id, b);
  }

  private updateBags(now: number): void {
    for (const b of this.bags.values()) {
      if (now > b.expires) { this.bags.delete(b.id); continue; }
      this.playerGrid.query(b.x, b.y, PICKUP_RADIUS + 0.5, (p) => {
        if (!this.bags.has(b.id) || p.dead) return;
        if (b.owner !== null && b.owner !== p.id) return;
        if ((p.x - b.x) ** 2 + (p.y - b.y) ** 2 > PICKUP_RADIUS ** 2) return;
        const it = b.item;
        if (it.kind === "potion") {
          if (p.hp >= p.maxHp - 1) return;
          p.hp = Math.min(p.maxHp, p.hp + it.heal);
        } else {
          if (it.cls !== p.cls || it.tier <= p.weaponTier) return;
          p.weaponTier = it.tier;
        }
        p.events.push({ e: "loot", name: itemName(it) });
        this.bags.delete(b.id);
      });
    }
  }

  private spawnEnemies(now: number): void {
    // Despawn idle enemies far from everyone.
    for (const e of this.enemies.values()) {
      if (!e.def.boss && now - e.lastNearPlayer > 30_000) this.enemies.delete(e.id);
    }
    // Keep the boss alive in the ashen core.
    if (!this.enemies.has(this.bossId) && now - this.bossDeadAt > BOSS_RESPAWN_MS) {
      const c = this.world.size / 2;
      const boss = this.spawnEnemy(ENEMIES.colossus, c + 0.5, c + 0.5, now);
      if (boss) { this.bossId = boss.id; if (this.bossDeadAt > 0) this.broadcastFeed("The ground shakes. The Cinder Colossus wakes in the ashen core."); }
    }
    if (this.enemies.size >= MAX_ENEMIES) return;
    // Keep a healthy density around each player.
    for (const p of this.players.values()) {
      let count = 0;
      this.enemyGrid.query(p.x, p.y, 20, (e) => { if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 < 400) count++; });
      const t = tierAt(this.world, p.x, p.y);
      if (count >= (t > 4 ? 6 : 7 + t * 2)) continue;
      for (let attempt = 0; attempt < 4; attempt++) {
        const a = Math.random() * Math.PI * 2, d = rand(VIEW_RADIUS - 4, VIEW_RADIUS + 4);
        const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
        const tier = tierAt(this.world, x, y);
        if (tier > 4 || isSolid(this.world, x, y)) continue;
        const pool = ENEMIES_BY_TIER[tier];
        const def = ENEMIES[pool[Math.floor(Math.random() * pool.length)]];
        this.spawnEnemy(def, x, y, now);
        break;
      }
    }
  }

  private spawnEnemy(def: EnemyDef, x: number, y: number, now: number): Enemy | null {
    const homeTier = tierAt(this.world, x, y);
    if (homeTier > 4) return null;
    const e: Enemy = {
      id: this.nextId++, def, x, y, hp: def.hp, homeTier, dirX: 0, dirY: 0, wanderUntil: 0,
      attackAt: def.attacks.map(() => now + 600 + Math.random() * 800),
      spin: def.attacks.map(() => Math.random() * Math.PI * 2),
      orbitSign: Math.random() < 0.5 ? 1 : -1, lastNearPlayer: now,
    };
    this.enemies.set(e.id, e);
    return e;
  }

  // ---------------- networking ----------------

  private broadcastFeed(text: string): void {
    for (const p of this.players.values()) p.events.push({ e: "feed", text });
  }

  private sendSnapshots(now: number): void {
    const vr2 = VIEW_RADIUS * VIEW_RADIUS, vvr2 = VOLLEY_VIEW_RADIUS ** 2;
    for (const p of this.players.values()) {
      const ents: EntityRow[] = [];
      for (const o of this.players.values()) {
        if ((o.x - p.x) ** 2 + (o.y - p.y) ** 2 > vr2) continue;
        ents.push([o.id, 0, o.cls, r2(o.x), r2(o.y), Math.round(o.hp), o.maxHp, o.name]);
      }
      this.enemyGrid.query(p.x, p.y, VIEW_RADIUS, (e) => {
        if (e.hp <= 0 || (e.x - p.x) ** 2 + (e.y - p.y) ** 2 > vr2) return;
        ents.push([e.id, 1, e.def.id, r2(e.x), r2(e.y), Math.max(0, Math.round(e.hp)), e.def.hp, ""]);
      });
      for (const b of this.bags.values()) {
        if (b.owner !== null && b.owner !== p.id) continue;
        if ((b.x - p.x) ** 2 + (b.y - p.y) ** 2 > vr2) continue;
        const desc = b.item.kind === "potion" ? "potion" : `w${b.item.tier}:${b.item.cls}`;
        ents.push([b.id, 2, desc, r2(b.x), r2(b.y), 0, 0, b.owner ? "soulbound" : ""]);
      }
      const ev: GameEvent[] = p.events;
      p.events = [];
      for (const w of this.worldEvents) {
        if (w.ev.e === "volley" && w.ev.v.owner === p.id) {
          // The shooter predicted this volley; send it so the client can map cid -> server id.
          ev.push(w.ev);
          continue;
        }
        const lim = w.ev.e === "volley" ? vvr2 : vr2;
        if ((w.x - p.x) ** 2 + (w.y - p.y) ** 2 <= lim) ev.push(w.ev);
      }
      this.send(p, {
        t: "snap", time: now, online: this.players.size, ents, ev,
        self: {
          id: p.id, x: p.x, y: p.y, ack: p.ack, hp: Math.round(p.hp), maxHp: p.maxHp, level: p.level, xp: p.xp,
          xpNext: xpToNext(p.level), weaponTier: p.weaponTier, cls: p.cls, name: p.name, fame: this.db.accountFame(p.accountId),
        },
      });
    }
    this.worldEvents = [];
  }

  send(p: Player, msg: ServerMsg): void {
    if (p.ws.readyState === p.ws.OPEN) p.ws.send(JSON.stringify(msg));
  }
}

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const randInt = (a: number, b: number) => Math.floor(rand(a, b + 1));
const r2 = (v: number) => Math.round(v * 100) / 100;

export type { Player };
