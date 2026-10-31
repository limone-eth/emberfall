// Two-stick touch controls (record: docs/decisions/2026-10-31-touch-controls.md).
// Left half of the screen: move stick. Right half: aim stick; the hero fires while it is held.
// Each stick appears where the thumb touches down. Only touch pointers are used, so mouse and
// keyboard input do not change.

const RADIUS = 56; // px: stick travel
const DEAD = 0.25; // fraction of RADIUS with no input

interface Stick { id: number; ox: number; oy: number; dx: number; dy: number; el: HTMLDivElement; knob: HTMLDivElement }

export const isTouchDevice = (): boolean => matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;

export class TouchSticks {
  private root = document.createElement("div");
  private move?: Stick;
  private aim?: Stick;
  private lastAngle = 0;
  /** True after the first touch: the game then uses the touch aim, not the mouse. */
  used = false;

  constructor(private target: HTMLElement) {
    this.root.id = "touch";
    document.body.appendChild(this.root);
    target.addEventListener("pointerdown", this.down);
    window.addEventListener("pointermove", this.moveEv);
    window.addEventListener("pointerup", this.up);
    window.addEventListener("pointercancel", this.up);
  }

  destroy(): void {
    this.target.removeEventListener("pointerdown", this.down);
    window.removeEventListener("pointermove", this.moveEv);
    window.removeEventListener("pointerup", this.up);
    window.removeEventListener("pointercancel", this.up);
    this.root.remove();
  }

  /** Movement as key-style input: -1, 0 or 1 per axis (8 directions, the same speed as the keys). */
  moveInput(): { mx: number; my: number } {
    const s = this.move;
    if (!s) return { mx: 0, my: 0 };
    const len = Math.hypot(s.dx, s.dy);
    if (len < DEAD * RADIUS) return { mx: 0, my: 0 };
    const oct = Math.round(Math.atan2(s.dy, s.dx) / (Math.PI / 4));
    const a = (oct * Math.PI) / 4;
    return { mx: Math.round(Math.cos(a)), my: Math.round(Math.sin(a)) };
  }

  /** Aim angle (radians) and whether the hero fires. The angle stays at its last value after release. */
  aimInput(): { angle: number; fire: boolean; x: number; y: number } {
    const s = this.aim;
    let fire = false, x = 0, y = 0;
    if (s && Math.hypot(s.dx, s.dy) >= DEAD * RADIUS) {
      this.lastAngle = Math.atan2(s.dy, s.dx);
      fire = true;
      x = s.dx / RADIUS; y = s.dy / RADIUS;
    }
    return { angle: this.lastAngle, fire, x, y };
  }

  release(): void {
    for (const s of [this.move, this.aim]) s?.el.remove();
    this.move = this.aim = undefined;
  }

  private make(e: PointerEvent): Stick {
    const el = document.createElement("div"), knob = document.createElement("div");
    el.className = "stick"; knob.className = "knob";
    el.style.left = `${e.clientX}px`; el.style.top = `${e.clientY}px`;
    el.appendChild(knob); this.root.appendChild(el);
    return { id: e.pointerId, ox: e.clientX, oy: e.clientY, dx: 0, dy: 0, el, knob };
  }

  private down = (e: PointerEvent): void => {
    if (e.pointerType !== "touch") return;
    e.preventDefault();
    this.used = true;
    const left = e.clientX < innerWidth / 2;
    if (left && !this.move) this.move = this.make(e);
    else if (!left && !this.aim) this.aim = this.make(e);
  };

  private moveEv = (e: PointerEvent): void => {
    const s = this.move?.id === e.pointerId ? this.move : this.aim?.id === e.pointerId ? this.aim : undefined;
    if (!s) return;
    let dx = e.clientX - s.ox, dy = e.clientY - s.oy;
    const len = Math.hypot(dx, dy);
    if (len > RADIUS) { dx *= RADIUS / len; dy *= RADIUS / len; }
    s.dx = dx; s.dy = dy;
    s.knob.style.transform = `translate(${dx}px, ${dy}px)`;
  };

  private up = (e: PointerEvent): void => {
    if (this.move?.id === e.pointerId) { this.move.el.remove(); this.move = undefined; }
    if (this.aim?.id === e.pointerId) { this.aim.el.remove(); this.aim = undefined; }
  };
}
