import { CLASSES, type SelfState, type World } from "@emberfall/shared";
import { TILE_COLORS } from "./draw.ts";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

/** HTML HUD. Updated from snapshots (20 Hz), not every frame. */
export class Hud {
  private root = $("hud");
  private mm = $<HTMLCanvasElement>("minimap");
  private base?: ImageData;
  private worldSize = 1;
  private toastTimer = 0;
  private lastDot = 0;
  private last = "";

  show(): void { this.root.hidden = false; }
  hide(): void { this.root.hidden = true; $("feed").innerHTML = ""; this.last = ""; }

  update(s: SelfState, online: number): void {
    const key = `${s.hp}|${s.maxHp}|${s.level}|${s.xp}|${s.weaponTier}|${s.fame}|${online}`;
    if (key === this.last) return;
    this.last = key;
    const c = CLASSES[s.cls];
    $("h-name").textContent = s.name;
    $("h-class").textContent = c.name;
    $("h-level").textContent = String(s.level);
    $("h-fame").textContent = String(s.fame);
    $("h-online").textContent = String(online);
    $("h-hp").textContent = `${s.hp} / ${s.maxHp}`;
    $("h-hpfill").style.width = `${(100 * s.hp) / s.maxHp}%`;
    const maxed = s.level >= 20;
    $("h-xp").textContent = maxed ? "Max level" : `${s.xp} / ${s.xpNext} XP`;
    $("h-xpfill").style.width = maxed ? "100%" : `${(100 * s.xp) / s.xpNext}%`;
    $("h-weapon").textContent = `T${s.weaponTier} · ${c.weapons[s.weaponTier].name}`;
  }

  feed(text: string): void {
    const ul = $("feed");
    const li = document.createElement("li");
    li.textContent = text;
    ul.appendChild(li);
    while (ul.children.length > 6) ul.firstChild!.remove();
  }

  toast(text: string): void {
    const t = $("toast");
    t.textContent = text;
    t.classList.add("show");
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => t.classList.remove("show"), 1600);
  }

  buildMinimap(w: World): void {
    this.worldSize = w.size;
    const N = this.mm.width;
    const ctx = this.mm.getContext("2d")!;
    const img = ctx.createImageData(N, N);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const tx = Math.floor((x / N) * w.size), ty = Math.floor((y / N) * w.size);
        const c = TILE_COLORS[w.tiles[ty * w.size + tx]];
        const i = (y * N + x) * 4;
        img.data[i] = (c >> 16) & 255; img.data[i + 1] = (c >> 8) & 255; img.data[i + 2] = c & 255; img.data[i + 3] = 255;
      }
    }
    this.base = img;
    ctx.putImageData(img, 0, 0);
  }

  minimapDot(x: number, y: number): void {
    const now = performance.now();
    if (!this.base || now - this.lastDot < 150) return;
    this.lastDot = now;
    const N = this.mm.width, ctx = this.mm.getContext("2d")!;
    ctx.putImageData(this.base, 0, 0);
    const k = N / this.worldSize;
    ctx.fillStyle = "#ff3d1f";
    ctx.beginPath(); ctx.arc(N / 2, N / 2, 3, 0, Math.PI * 2); ctx.fill(); // the core
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#000";
    ctx.beginPath(); ctx.arc(x * k, y * k, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
}
