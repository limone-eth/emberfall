import { DatabaseSync } from "node:sqlite";
import { randomBytes, timingSafeEqual } from "node:crypto";
import type { ClassId, GraveRow } from "@emberfall/shared";

export interface CharRow {
  id: number;
  account_id: number;
  cls: ClassId;
  level: number;
  xp: number;
  weapon_tier: number;
}

export class Db {
  private db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE COLLATE NOCASE, token TEXT NOT NULL,
        fame INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS characters (
        id INTEGER PRIMARY KEY, account_id INTEGER NOT NULL REFERENCES accounts(id),
        cls TEXT NOT NULL, level INTEGER NOT NULL DEFAULT 1, xp INTEGER NOT NULL DEFAULT 0,
        weapon_tier INTEGER NOT NULL DEFAULT 0, alive INTEGER NOT NULL DEFAULT 1,
        fame INTEGER NOT NULL DEFAULT 0, killed_by TEXT, created_at INTEGER NOT NULL, died_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS chars_alive ON characters(account_id, alive);
    `);
  }

  /** Returns the account id, or an error string. */
  login(name: string, token: string | undefined): { id: number; token: string } | { error: string } {
    const row = this.db.prepare("SELECT id, token FROM accounts WHERE name = ?").get(name) as
      | { id: number; token: string } | undefined;
    if (!row) {
      const t = randomBytes(24).toString("hex");
      const r = this.db.prepare("INSERT INTO accounts (name, token, created_at) VALUES (?, ?, ?)").run(name, t, Date.now());
      return { id: Number(r.lastInsertRowid), token: t };
    }
    if (!token || token.length !== row.token.length || !timingSafeEqual(Buffer.from(token), Buffer.from(row.token))) {
      return { error: "That name belongs to another hero. Pick a different one." };
    }
    return { id: row.id, token: row.token };
  }

  aliveCharacter(accountId: number): CharRow | undefined {
    return this.db.prepare("SELECT id, account_id, cls, level, xp, weapon_tier FROM characters WHERE account_id = ? AND alive = 1 LIMIT 1")
      .get(accountId) as CharRow | undefined;
  }

  createCharacter(accountId: number, cls: ClassId): CharRow {
    const r = this.db.prepare("INSERT INTO characters (account_id, cls, created_at) VALUES (?, ?, ?)").run(accountId, cls, Date.now());
    return { id: Number(r.lastInsertRowid), account_id: accountId, cls, level: 1, xp: 0, weapon_tier: 0 };
  }

  saveCharacter(c: { id: number; level: number; xp: number; weaponTier: number }): void {
    this.db.prepare("UPDATE characters SET level = ?, xp = ?, weapon_tier = ? WHERE id = ? AND alive = 1")
      .run(c.level, c.xp, c.weaponTier, c.id);
  }

  /** Permadeath: the character is gone for good. Fame goes to the account. */
  killCharacter(c: { id: number; accountId: number; level: number; xp: number; weaponTier: number }, fame: number, killedBy: string): void {
    this.db.prepare("UPDATE characters SET alive = 0, level = ?, xp = ?, weapon_tier = ?, fame = ?, killed_by = ?, died_at = ? WHERE id = ?")
      .run(c.level, c.xp, c.weaponTier, fame, killedBy, Date.now(), c.id);
    this.db.prepare("UPDATE accounts SET fame = fame + ? WHERE id = ?").run(fame, c.accountId);
  }

  accountFame(accountId: number): number {
    const r = this.db.prepare("SELECT fame FROM accounts WHERE id = ?").get(accountId) as { fame: number } | undefined;
    return r?.fame ?? 0;
  }

  graveyard(accountId: number, limit = 10): GraveRow[] {
    return (this.db.prepare(`
      SELECT a.name AS name, c.cls AS cls, c.level AS level, c.fame AS fame, c.killed_by AS killedBy, c.died_at AS diedAt
      FROM characters c JOIN accounts a ON a.id = c.account_id
      WHERE c.account_id = ? AND c.alive = 0 ORDER BY c.died_at DESC LIMIT ?`).all(accountId, limit)) as unknown as GraveRow[];
  }
}
