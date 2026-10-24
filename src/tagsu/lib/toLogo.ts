/** Turns an image or a piece of text (emoji, symbol) into 15x16 logo rows. Browser only. */
const W = 15;
const H = 16;
const SCALE = 4;
const DARK = 0.4;

function otsu(values: number[]): number {
  const bins = new Array(64).fill(0);
  values.forEach((v) => bins[Math.min(63, Math.floor(v * 64))]++);
  const total = values.length;
  const sumAll = bins.reduce((a, n, i) => a + n * i, 0);
  let best = 0;
  let threshold = 32;
  let wB = 0;
  let sumB = 0;
  bins.forEach((n, i) => {
    wB += n;
    sumB += n * i;
    const wF = total - wB;
    if (!wB || !wF) return;
    const between = wB * wF * (sumB / wB - (sumAll - sumB) / wF) ** 2;
    if (between > best) {
      best = between;
      threshold = i + 0.5;
    }
  });
  return threshold / 64;
}

function contentBox(data: Uint8ClampedArray, w: number, h: number) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (data[(y * w + x) * 4 + 3] > 24) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
  return x1 < 0 ? { x: 0, y: 0, w, h } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

function rowsFrom(source: CanvasImageSource, sw: number, sh: number, trim: boolean): string[] {
  let box = { x: 0, y: 0, w: sw, h: sh };
  if (trim) {
    const probe = document.createElement("canvas");
    probe.width = sw;
    probe.height = sh;
    const pc = probe.getContext("2d", { willReadFrequently: true })!;
    pc.drawImage(source, 0, 0);
    box = contentBox(pc.getImageData(0, 0, sw, sh).data, sw, sh);
  }
  const canvas = document.createElement("canvas");
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const k = Math.min(canvas.width / box.w, canvas.height / box.h);
  const dw = box.w * k;
  const dh = box.h * k;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, box.x, box.y, box.w, box.h, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

  const lum: number[] = [];
  const alpha: number[] = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let l = 0;
      let a = 0;
      for (let dy = 0; dy < SCALE; dy++)
        for (let dx = 0; dx < SCALE; dx++) {
          const i = ((y * SCALE + dy) * canvas.width + x * SCALE + dx) * 4;
          const al = data[i + 3] / 255;
          l += ((0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255) * al;
          a += al;
        }
      alpha.push(a / SCALE ** 2);
      lum.push(a ? l / a : 1);
    }

  const transparent = alpha.filter((a) => a < 0.5).length > alpha.length * 0.1;
  let on: boolean[];
  if (transparent) {
    // Shapes on a transparent background: the shape lights up, dark details inside it stay off.
    const inside = lum.filter((_, i) => alpha[i] >= 0.5);
    const mean = inside.reduce((a, v) => a + v, 0) / Math.max(1, inside.length);
    const spread = Math.sqrt(inside.reduce((a, v) => a + (v - mean) ** 2, 0) / Math.max(1, inside.length));
    const t = spread > 0.12 ? Math.min(otsu(inside), DARK) : -1;
    on = alpha.map((a, i) => a >= 0.5 && lum[i] > t);
  } else {
    // Photos and drawings: dark ink lights up.
    const t = otsu(lum);
    on = lum.map((l) => l < t);
  }
  return Array.from({ length: H }, (_, y) => on.slice(y * W, y * W + W).map((b) => (b ? "1" : "0")).join(""));
}

export function textToLogo(text: string): string[] {
  const canvas = document.createElement("canvas");
  canvas.width = 480;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.font = '200px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", system-ui, sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#000";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2, canvas.width);
  return rowsFrom(canvas, canvas.width, canvas.height, true);
}

export async function fileToLogo(file: Blob): Promise<string[]> {
  const bitmap = await createImageBitmap(file);
  try {
    return rowsFrom(bitmap, bitmap.width, bitmap.height, true);
  } finally {
    bitmap.close();
  }
}
