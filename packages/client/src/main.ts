import { CLASSES, CLASS_IDS, type ClassId, type ServerMsg } from "@emberfall/shared";
import { Net } from "./net.ts";
import { ClientGame } from "./game.ts";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const store = {
  get(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string): void { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

let chosen: ClassId = (store.get("ef.class") as ClassId) || "emberwright";
if (!CLASS_IDS.includes(chosen)) chosen = "emberwright";

function renderClasses(): void {
  const box = $("classes");
  box.innerHTML = "";
  for (const id of CLASS_IDS) {
    const c = CLASSES[id];
    const b = document.createElement("button");
    b.className = "cls";
    b.type = "button";
    b.setAttribute("aria-pressed", String(id === chosen));
    b.innerHTML = `<b><i style="background:#${c.color.toString(16).padStart(6, "0")}"></i>${c.name}</b><span>${c.blurb}</span><span>HP ${c.baseHp} · Speed ${c.speed} · Def ${c.defense}</span>`;
    b.onclick = () => { chosen = id; store.set("ef.class", id); renderClasses(); };
    box.appendChild(b);
  }
}

const nameInput = $<HTMLInputElement>("name");
nameInput.value = store.get("ef.name") ?? "";
renderClasses();

let game: ClientGame | null = null;
let net: Net | null = null;

async function play(): Promise<void> {
  const name = nameInput.value.trim();
  const err = $("login-error");
  err.textContent = "";
  if (!/^[A-Za-z]{2,12}$/.test(name)) { err.textContent = "Name: 2-12 letters, no spaces."; return; }
  store.set("ef.name", name);
  const btn = $<HTMLButtonElement>("play");
  btn.disabled = true;

  const url = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;
  net = new Net(url);
  try { await net.ready(); } catch (e) { err.textContent = (e as Error).message; btn.disabled = false; return; }

  const thisNet = net;
  net.onMessage = async (m: ServerMsg) => {
    if (m.t === "error") { err.textContent = m.message; btn.disabled = false; thisNet.close(); return; }
    if (m.t === "welcome") {
      store.set(`ef.token.${name.toLowerCase()}`, m.token);
      $("login").hidden = true;
      btn.disabled = false;
      game = new ClientGame(thisNet, showDeath);
      await game.start(m, $("stage"));
      return;
    }
    game?.handle(m);
  };
  net.onClose = () => {
    if (game && !$("death").hidden) return;
    if (game) { game.destroy(); game = null; $("login").hidden = false; $("login-error").textContent = "Disconnected from the server."; }
  };
  net.send({ t: "hello", name, cls: chosen, token: store.get(`ef.token.${name.toLowerCase()}`) ?? undefined });
}

function showDeath(m: Extract<ServerMsg, { t: "died" }>): void {
  $("death").hidden = false;
  $("death-line").textContent = `Your level ${m.level} hero was slain by ${m.killedBy}. +${m.fame} fame to your account.`;
  const tb = $("grave").querySelector("tbody")!;
  tb.innerHTML = "";
  for (const g of m.graveyard) {
    const tr = document.createElement("tr");
    for (const v of [CLASSES[g.cls]?.name ?? g.cls, g.level, g.fame, g.killedBy]) {
      const td = document.createElement("td"); td.textContent = String(v); tr.appendChild(td);
    }
    tb.appendChild(tr);
  }
  setTimeout(() => { game?.destroy(); game = null; net?.close(); net = null; }, 50);
}

$("play").onclick = () => void play();
nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") void play(); });
$("again").onclick = () => { $("death").hidden = true; $("login").hidden = false; };
