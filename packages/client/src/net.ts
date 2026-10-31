import type { ClientMsg, ServerMsg } from "@emberfall/shared";

/** WebSocket wrapper with server-clock estimation (NTP-style ping/pong, median filtered). */
export class Net {
  private ws: WebSocket;
  private samples: number[] = [];
  offset = 0; // serverTime ≈ performance.now() + offset
  rtt = 0;
  onMessage: (m: ServerMsg) => void = () => {};
  onClose: () => void = () => {};
  private pingTimer = 0;

  constructor(url: string) {
    this.ws = new WebSocket(url);
    this.ws.addEventListener("message", (e) => {
      const m = JSON.parse(e.data as string) as ServerMsg;
      if (m.t === "pong") return this.onPong(m.c, m.s);
      if (m.t === "welcome") {
        this.offset = m.serverTime - performance.now();
        this.pingTimer = window.setInterval(() => this.send({ t: "ping", c: performance.now() }), 1500);
        this.send({ t: "ping", c: performance.now() });
      }
      this.onMessage(m);
    });
    this.ws.addEventListener("close", () => { clearInterval(this.pingTimer); this.onClose(); });
  }

  ready(): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN) return Promise.resolve();
    return new Promise((res, rej) => {
      this.ws.addEventListener("open", () => res(), { once: true });
      this.ws.addEventListener("error", () => rej(new Error("Could not reach the server.")), { once: true });
    });
  }

  private onPong(c: number, s: number): void {
    const now = performance.now();
    this.rtt = now - c;
    this.samples.push(s + this.rtt / 2 - now);
    if (this.samples.length > 9) this.samples.shift();
    const sorted = [...this.samples].sort((a, b) => a - b);
    const target = sorted[Math.floor(sorted.length / 2)];
    // Slew instead of jumping so bullets don't teleport.
    this.offset += (target - this.offset) * 0.5;
  }

  serverNow(): number { return performance.now() + this.offset; }

  send(m: ClientMsg): void {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }

  close(): void { this.ws.close(); }
}
