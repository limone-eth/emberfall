/** Uniform spatial hash, rebuilt every tick. Cheap and good enough for thousands of entities. */
export class SpatialGrid<T extends { x: number; y: number }> {
  private cells = new Map<number, T[]>();
  constructor(private cell: number) {}

  private key(cx: number, cy: number): number { return (cx + 1024) * 4096 + (cy + 1024); }

  clear(): void { this.cells.clear(); }

  insert(item: T): void {
    const k = this.key(Math.floor(item.x / this.cell), Math.floor(item.y / this.cell));
    let list = this.cells.get(k);
    if (!list) { list = []; this.cells.set(k, list); }
    list.push(item);
  }

  /** Calls fn for every item whose cell overlaps the circle; fn does the exact distance test. */
  query(x: number, y: number, r: number, fn: (item: T) => void): void {
    const x0 = Math.floor((x - r) / this.cell), x1 = Math.floor((x + r) / this.cell);
    const y0 = Math.floor((y - r) / this.cell), y1 = Math.floor((y + r) / this.cell);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const list = this.cells.get(this.key(cx, cy));
        if (list) for (const it of list) fn(it);
      }
    }
  }
}
