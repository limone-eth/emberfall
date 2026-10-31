import type { ClassId } from "./data.ts";
import type { Volley } from "./bullets.ts";

// ----- client -> server -----
export type ClientMsg =
  | { t: "hello"; name: string; token?: string; cls: ClassId }
  | { t: "in"; seq: number; dt: number; mx: number; my: number }
  | { t: "shoot"; angle: number; cid: number }
  | { t: "ping"; c: number };

// ----- server -> client -----

/** Compact entity row: [id, kind, type, x, y, hp, maxHp, extra] */
export type EntityRow = [number, EntKind, string, number, number, number, number, string];
export type EntKind = 0 | 1 | 2;

export interface SelfState {
  id: number;
  x: number;
  y: number;
  ack: number;
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  xpNext: number;
  weaponTier: number;
  cls: ClassId;
  name: string;
  fame: number;
}

export type GameEvent =
  | { e: "volley"; v: Volley }
  | { e: "bdead"; vid: number; i: number }
  | { e: "dmg"; id: number; amount: number; x: number; y: number }
  | { e: "kill"; id: number; x: number; y: number; type: string; by: string }
  | { e: "loot"; name: string }
  | { e: "level"; level: number }
  | { e: "feed"; text: string };

export interface GraveRow {
  name: string;
  cls: ClassId;
  level: number;
  fame: number;
  killedBy: string;
  diedAt: number;
}

export type ServerMsg =
  | { t: "welcome"; id: number; seed: number; token: string; serverTime: number; resumed: boolean }
  | { t: "error"; message: string }
  | { t: "snap"; time: number; self: SelfState; ents: EntityRow[]; ev: GameEvent[]; online: number }
  | { t: "pong"; c: number; s: number }
  | { t: "died"; killedBy: string; level: number; fame: number; graveyard: GraveRow[] };
