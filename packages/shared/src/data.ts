import type { Pattern } from "./bullets.ts";

const deg = (d: number) => (d * Math.PI) / 180;

// ---------- Classes & weapons ----------

export type ClassId = "emberwright" | "wayfinder" | "bulwark";

export interface WeaponDef {
  name: string;
  tier: number;
  cooldown: number; // ms between volleys
  pattern: Pattern;
}

export interface ClassDef {
  id: ClassId;
  name: string;
  blurb: string;
  color: number;
  baseHp: number;
  hpPerLevel: number;
  speed: number;
  defense: number;
  weapons: WeaponDef[]; // index = tier
}

const tiers = <T>(n: number, f: (t: number) => T): T[] => Array.from({ length: n }, (_, t) => f(t));

export const CLASSES: Record<ClassId, ClassDef> = {
  emberwright: {
    id: "emberwright",
    name: "Emberwright",
    blurb: "Fragile caster. Twin waving embers, long reach.",
    color: 0xff8a3d,
    baseHp: 90, hpPerLevel: 9, speed: 5.0, defense: 0,
    weapons: tiers(5, (t) => ({
      name: ["Kindling Rod", "Cinder Rod", "Flare Rod", "Pyre Rod", "Rod of the Last Light"][t],
      tier: t,
      cooldown: 300 - t * 15,
      pattern: { count: 2, spread: 0, speed: 14, lifetime: 650, radius: 0.22, damage: [16 + t * 9, 28 + t * 12], wave: 0.35, waveFreq: 5, pierce: true },
    })),
  },
  wayfinder: {
    id: "wayfinder",
    name: "Wayfinder",
    blurb: "Mobile archer. Three-arrow fan, quick feet.",
    color: 0x7bd88f,
    baseHp: 110, hpPerLevel: 11, speed: 5.6, defense: 2,
    weapons: tiers(5, (t) => ({
      name: ["Driftwood Bow", "Reed Bow", "Gale Bow", "Thornheart Bow", "Bow of the North Wind"][t],
      tier: t,
      cooldown: 380 - t * 15,
      pattern: { count: 3, spread: deg(7), speed: 15, lifetime: 520, radius: 0.2, damage: [12 + t * 6, 20 + t * 9] },
    })),
  },
  bulwark: {
    id: "bulwark",
    name: "Bulwark",
    blurb: "Armoured brawler. Short, heavy blade arcs.",
    color: 0x6fb7ff,
    baseHp: 150, hpPerLevel: 15, speed: 4.6, defense: 8,
    weapons: tiers(5, (t) => ({
      name: ["Rusted Cleaver", "Iron Cleaver", "Tidesteel Cleaver", "Basalt Cleaver", "Cleaver of the Sunken King"][t],
      tier: t,
      cooldown: 340 - t * 12,
      pattern: { count: 3, spread: deg(16), speed: 11, lifetime: 260, radius: 0.32, damage: [34 + t * 14, 48 + t * 18], pierce: true },
    })),
  },
};

export const CLASS_IDS = Object.keys(CLASSES) as ClassId[];

export function maxHpFor(cls: ClassDef, level: number): number {
  return cls.baseHp + cls.hpPerLevel * (level - 1);
}
export function damageMultFor(level: number): number {
  return 1 + (level - 1) * 0.045;
}

// ---------- Enemies ----------

export type Behavior = "wander" | "chase" | "orbit" | "still" | "skirmish";

export interface AttackDef {
  pattern: Pattern;
  cooldown: number;
  aim: "target" | "spin" | "random";
  /** for spin: radians added per shot */
  spinStep?: number;
  /** only fire within this range of a target */
  range: number;
}

export interface EnemyDef {
  id: string;
  name: string;
  tier: number;
  hp: number;
  defense: number;
  speed: number;
  radius: number;
  xp: number;
  color: number;
  shape: "crab" | "wisp" | "thorn" | "brute" | "stag" | "witch" | "sentinel" | "reaver" | "colossus";
  behavior: Behavior;
  aggro: number;
  attacks: AttackDef[];
  /** chance a kill drops a loot bag */
  dropChance: number;
  boss?: boolean;
}

const enemyBullet = (p: Partial<Pattern> & { damage: [number, number] }): Pattern => ({
  count: 1, spread: 0, speed: 6, lifetime: 1600, radius: 0.22, ...p,
});

export const ENEMIES: Record<string, EnemyDef> = {
  tidecrab: {
    id: "tidecrab", name: "Tidecrab", tier: 0, hp: 40, defense: 0, speed: 1.6, radius: 0.4, xp: 6,
    color: 0xe0795b, shape: "crab", behavior: "wander", aggro: 7, dropChance: 0.08,
    attacks: [{ pattern: enemyBullet({ damage: [6, 9], speed: 5 }), cooldown: 1600, aim: "target", range: 7 }],
  },
  dunewisp: {
    id: "dunewisp", name: "Dune Wisp", tier: 0, hp: 28, defense: 0, speed: 2.8, radius: 0.32, xp: 7,
    color: 0x7fd6ff, shape: "wisp", behavior: "orbit", aggro: 8, dropChance: 0.08,
    attacks: [{ pattern: enemyBullet({ count: 3, spread: deg(18), damage: [4, 7], speed: 4.5 }), cooldown: 1900, aim: "target", range: 8 }],
  },
  thornling: {
    id: "thornling", name: "Thornling", tier: 1, hp: 90, defense: 2, speed: 2.6, radius: 0.38, xp: 18,
    color: 0x9bc53d, shape: "thorn", behavior: "chase", aggro: 9, dropChance: 0.12,
    attacks: [{ pattern: enemyBullet({ count: 6, spread: deg(60), damage: [12, 18], speed: 5.5, lifetime: 1200 }), cooldown: 1700, aim: "spin", spinStep: deg(20), range: 6 }],
  },
  mossback: {
    id: "mossback", name: "Mossback Brute", tier: 1, hp: 220, defense: 6, speed: 1.4, radius: 0.6, xp: 34,
    color: 0x5f7f3a, shape: "brute", behavior: "chase", aggro: 8, dropChance: 0.22,
    attacks: [{ pattern: enemyBullet({ count: 5, spread: deg(14), damage: [16, 24], speed: 6, radius: 0.28 }), cooldown: 1900, aim: "target", range: 8 }],
  },
  hollowstag: {
    id: "hollowstag", name: "Hollow Stag", tier: 2, hp: 300, defense: 8, speed: 3.4, radius: 0.55, xp: 60,
    color: 0xc9b38f, shape: "stag", behavior: "skirmish", aggro: 11, dropChance: 0.2,
    attacks: [
      { pattern: enemyBullet({ count: 8, spread: deg(45), damage: [20, 28], speed: 6.5 }), cooldown: 2100, aim: "spin", spinStep: deg(22), range: 9 },
      { pattern: enemyBullet({ count: 1, damage: [26, 34], speed: 10, radius: 0.18 }), cooldown: 900, aim: "target", range: 10 },
    ],
  },
  bramblewitch: {
    id: "bramblewitch", name: "Bramble Witch", tier: 2, hp: 240, defense: 4, speed: 2.2, radius: 0.45, xp: 64,
    color: 0xb07fd6, shape: "witch", behavior: "orbit", aggro: 11, dropChance: 0.25,
    attacks: [{ pattern: enemyBullet({ count: 4, spread: deg(12), damage: [22, 30], speed: 5, wave: 0.6, waveFreq: 2.5, lifetime: 2000 }), cooldown: 1400, aim: "target", range: 10 }],
  },
  cragsentinel: {
    id: "cragsentinel", name: "Crag Sentinel", tier: 3, hp: 700, defense: 14, speed: 0, radius: 0.7, xp: 130,
    color: 0x8d99ae, shape: "sentinel", behavior: "still", aggro: 12, dropChance: 0.35,
    attacks: [
      { pattern: enemyBullet({ count: 12, spread: deg(30), damage: [28, 38], speed: 5, lifetime: 2200, radius: 0.26 }), cooldown: 700, aim: "spin", spinStep: deg(9), range: 12 },
    ],
  },
  ashenreaver: {
    id: "ashenreaver", name: "Ashen Reaver", tier: 4, hp: 900, defense: 16, speed: 3.8, radius: 0.5, xp: 210,
    color: 0xd64545, shape: "reaver", behavior: "chase", aggro: 12, dropChance: 0.35,
    attacks: [
      { pattern: enemyBullet({ count: 3, spread: deg(10), damage: [40, 52], speed: 9, lifetime: 1100 }), cooldown: 800, aim: "target", range: 9 },
    ],
  },
  colossus: {
    id: "colossus", name: "The Cinder Colossus", tier: 4, hp: 14000, defense: 22, speed: 1.0, radius: 1.3, xp: 2400,
    color: 0xff4d1f, shape: "colossus", behavior: "wander", aggro: 16, dropChance: 1, boss: true,
    attacks: [
      { pattern: enemyBullet({ count: 20, spread: deg(18), damage: [36, 48], speed: 4.5, lifetime: 3200, radius: 0.32 }), cooldown: 1100, aim: "spin", spinStep: deg(7), range: 16 },
      { pattern: enemyBullet({ count: 5, spread: deg(8), damage: [50, 70], speed: 8.5, lifetime: 1800, accel: 2 }), cooldown: 1500, aim: "target", range: 14 },
      { pattern: enemyBullet({ count: 2, spread: deg(180), damage: [30, 40], speed: 6, wave: 1.2, waveFreq: 1.5, lifetime: 2600 }), cooldown: 260, aim: "spin", spinStep: deg(23), range: 16 },
    ],
  },
};

export const ENEMIES_BY_TIER: string[][] = [
  ["tidecrab", "dunewisp"],
  ["thornling", "mossback"],
  ["hollowstag", "bramblewitch"],
  ["cragsentinel", "hollowstag"],
  ["ashenreaver", "cragsentinel"],
];

// ---------- Items ----------

export type Item =
  | { kind: "weapon"; cls: ClassId; tier: number }
  | { kind: "potion"; heal: number };

export function itemName(item: Item): string {
  return item.kind === "potion" ? "Healing Draught" : CLASSES[item.cls].weapons[item.tier].name;
}
