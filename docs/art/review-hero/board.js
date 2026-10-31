// Draws a sand+meadow patch at 32 screen px per tile and places the sprites at true game scale.
const load = (src) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = src; });
function ground(ctx, cols, rows, T) {
  const sand = ["#d8c08a", "#c4a96f", "#ecdcb0"], grass = ["#6aa84f", "#3f7a39"];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const h = ((x * 73856093) ^ (y * 19349663)) >>> 0;
    const g = x > cols * 0.62;
    ctx.fillStyle = g ? grass[h % 2] : sand[h % 3 === 2 && h % 5 === 0 ? 2 : h % 2];
    ctx.fillRect(x * T, y * T, T, T);
  }
}
export async function draw(canvas, ew, tc, artPx) {
  const T = 32, ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ground(ctx, canvas.width / T, canvas.height / T, T);
  const [a, b] = await Promise.all([load(ew), load(tc)]);
  const scale = T / artPx; // integer: 2 for 16 px art, 1 for 32 px art
  ctx.drawImage(a, 2 * T, 1 * T, a.width * scale, a.height * scale);
  ctx.drawImage(b, 5 * T, 1 * T, b.width * scale, b.height * scale);
  // enemy bullets for readability check
  for (const [x, y] of [[4.3, 1.8], [3.6, 1.6]]) { ctx.fillStyle = "#14100e"; ctx.beginPath(); ctx.arc(x * T, y * T, 7, 0, 7); ctx.fill(); ctx.fillStyle = "#ff3d5a"; ctx.beginPath(); ctx.arc(x * T, y * T, 5, 0, 7); ctx.fill(); ctx.fillStyle = "#f3e9dc"; ctx.beginPath(); ctx.arc(x * T, y * T, 2, 0, 7); ctx.fill(); }
}
