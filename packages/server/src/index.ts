import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { CLASS_IDS, TICK_MS, type ClientMsg, type ClassId } from "@emberfall/shared";
import { Db } from "./db.ts";
import { Game, type Player } from "./game.ts";

const PORT = Number(process.env.PORT ?? 8080);
const SEED = Number(process.env.WORLD_SEED ?? 20261031);
const DB_PATH = process.env.DB_PATH ?? join(fileURLToPath(new URL("../", import.meta.url)), "emberfall.db");
const STATIC_DIR = fileURLToPath(new URL("../../client/dist/", import.meta.url));

const db = new Db(DB_PATH);
const game = new Game(SEED, db);

// ---- static client (production build) ----
const MIME: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml" };
const http = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://x");
  if (url.pathname === "/health") { res.end(JSON.stringify({ ok: true, online: game.online })); return; }
  const rel = normalize(url.pathname === "/" ? "/index.html" : url.pathname).replace(/^(\.\.[/\\])+/, "");
  const file = join(STATIC_DIR, rel);
  if (!file.startsWith(STATIC_DIR)) { res.writeHead(403).end(); return; }
  try {
    if (!(await stat(file)).isFile()) throw new Error();
    res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end("Not found. In dev, open the Vite client on :5173.");
  }
});

// ---- websocket ----
const wss = new WebSocketServer({ server: http, path: "/ws", maxPayload: 4096 });
const NAME_RE = /^[A-Za-z]{2,12}$/;

wss.on("connection", (ws) => {
  let player: Player | null = null;
  let msgCount = 0;
  const rate = setInterval(() => { msgCount = 0; }, 1000);

  ws.on("message", (raw) => {
    if (++msgCount > 240) return; // ~60 inputs/s + shots + pings is far below this
    let msg: ClientMsg;
    try { msg = JSON.parse(String(raw)); } catch { return; }
    if (!msg || typeof msg !== "object") return;

    if (!player) {
      if (msg.t !== "hello") return;
      const name = String(msg.name ?? "");
      const cls = msg.cls as ClassId;
      if (!NAME_RE.test(name)) { ws.send(JSON.stringify({ t: "error", message: "Name: 2-12 letters." })); return; }
      if (!CLASS_IDS.includes(cls)) { ws.send(JSON.stringify({ t: "error", message: "Unknown class." })); return; }
      const auth = db.login(name, typeof msg.token === "string" ? msg.token : undefined);
      if ("error" in auth) { ws.send(JSON.stringify({ t: "error", message: auth.error })); return; }
      player = game.join(ws, auth.id, name, cls, auth.token);
      return;
    }
    game.handle(player, msg);
  });

  ws.on("close", () => { clearInterval(rate); if (player) game.leave(player); });
});

// ---- fixed-rate tick with drift correction ----
let next = performance.now();
function loop() {
  const t0 = performance.now();
  game.tick();
  const cost = performance.now() - t0;
  if (cost > TICK_MS * 0.6) console.warn(`slow tick: ${cost.toFixed(1)}ms`);
  next += TICK_MS;
  const wait = next - performance.now();
  if (wait < -TICK_MS * 5) next = performance.now(); // fell far behind; don't spiral
  setTimeout(loop, Math.max(0, wait));
}
loop();

http.listen(PORT, () => console.log(`Emberfall server on :${PORT} (seed ${SEED})`));
