import * as THREE from "three";
import { strokeText } from "./strokeFont";

/*
 * Board coordinates are in 0.1 mm "units" on the 86 x 74 mm front plate, origin top-left, measured from a
 * perspective-corrected photo of a real badge and the bare tagsu_v6_r25 PCB.
 */
export const PCB_U = { x: 8, y: 92, w: 842, h: 558 };

/** The LCD module's 12 pins, 2 mm apart (x in units, front view). */
export const HEADER = Array.from({ length: 12 }, (_, k) => 318 + 20 * k);

export type SmdPart = { id: string; x: number; y: number; kind: "r" | "c" | "d"; vertical: boolean };

export const SMD: SmdPart[] = [
  { id: "R1", x: 179, y: 412, kind: "r", vertical: true },
  { id: "D2", x: 198, y: 412, kind: "d", vertical: true },
  { id: "D1", x: 218, y: 412, kind: "d", vertical: true },
  { id: "C2", x: 239, y: 412, kind: "c", vertical: true },
  { id: "C4", x: 260, y: 412, kind: "c", vertical: true },
  { id: "R3", x: 281, y: 412, kind: "r", vertical: true },
  { id: "R2", x: 301, y: 412, kind: "r", vertical: true },
  { id: "C10", x: 355, y: 412, kind: "c", vertical: true },
  { id: "C8", x: 375, y: 412, kind: "c", vertical: true },
  { id: "C9", x: 409, y: 412, kind: "c", vertical: true },
  { id: "C7", x: 440, y: 412, kind: "c", vertical: true },
  { id: "R7", x: 461, y: 412, kind: "r", vertical: true },
  { id: "R6", x: 514, y: 412, kind: "r", vertical: true },
  { id: "R4", x: 612, y: 393, kind: "r", vertical: true },
  { id: "C6", x: 612, y: 433, kind: "c", vertical: true },
  { id: "R5", x: 643, y: 430, kind: "r", vertical: true },
];

/** Label positions of the larger parts (silkscreen), in units. */
const LABELS: [string, number, number][] = [
  ["U1", 540, 416], ["L1", 699, 454], ["D3", 767, 522], ["U2", 765, 571], ["C1", 699, 587], ["C5", 796, 583], ["C3", 827, 585], ["X1", 150, 396], ["LCD1", 112, 126],
];

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext("2d")!);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

const SILK = "rgba(244, 240, 226, 0.95)";
const GOLD = "#e0bb5e";

/** A placeholder where the board's maker logo sits, fitted to `width` and centred in the logo's area. */
function logoPlaceholder(ctx: CanvasRenderingContext2D, cx: number, top: number, width: number) {
  const text = "[RAKETTITIEDE OY LOGO]";
  ctx.save();
  ctx.fillStyle = SILK;
  ctx.font = "600 100px 'Helvetica Neue', Arial, sans-serif";
  const size = (100 * width) / ctx.measureText(text).width;
  ctx.font = `600 ${size}px 'Helvetica Neue', Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, cx, top + width * 0.29);
  ctx.restore();
}

/** Blue solder mask with traces, gold pads and the board's real silkscreen, mapped onto the PCB's top face. */
export function pcbTexture(): THREE.CanvasTexture {
  const W = 2048;
  const H = Math.round((W * PCB_U.h) / PCB_U.w);
  const k = W / PCB_U.w;
  const X = (u: number) => (u - PCB_U.x) * k;
  const Y = (v: number) => (v - PCB_U.y) * k;

  const tex = canvasTexture(W, H, (ctx) => {
    const base = ctx.createLinearGradient(0, 0, W, H);
    base.addColorStop(0, "#2148b8");
    base.addColorStop(1, "#1a3c9e");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, W, H);

    const grain = ctx.getImageData(0, 0, W, H);
    for (let i = 0; i < grain.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 8;
      grain.data[i] += n;
      grain.data[i + 1] += n;
      grain.data[i + 2] += n;
    }
    ctx.putImageData(grain, 0, 0);

    // Traces under the mask
    ctx.strokeStyle = "rgba(80, 140, 255, 0.4)";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const trace = (pts: [number, number][], width = 5) => {
      ctx.lineWidth = width;
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
      ctx.stroke();
    };
    HEADER.forEach((px, i) => trace([[px, 372], [px, 384], [i < 6 ? 300 + i * 6 : 520 + (i - 6) * 6, 384 + (i % 4) * 3]], 3.5));
    SMD.forEach((p, i) => trace([[p.x, p.y + 14], [p.x, 452 + (i % 3) * 4], [p.x + 30, 456 + (i % 3) * 4]], 4));
    trace([[143, 430], [175, 430], [179, 424]], 6);
    trace([[70, 182], [70, 300], [110, 330], [160, 400]], 4);
    trace([[603, 413], [700, 413], [722, 462]], 7);
    trace([[739, 567], [715, 600], [700, 615]], 7);
    trace([[766, 535], [795, 535], [795, 545]], 7);
    trace([[100, 545], [150, 545], [157, 520]], 4);
    trace([[795, 200], [800, 330], [760, 370], [660, 380]], 4);

    // Gold pads (ENIG) where parts are soldered
    ctx.fillStyle = GOLD;
    const pad = (x: number, y: number, w: number, h: number) => ctx.fillRect(X(x - w / 2), Y(y - h / 2), w * k, h * k);
    SMD.forEach((p) => {
      pad(p.x, p.y - 11, 13, 9);
      pad(p.x, p.y + 11, 13, 9);
    });
    HEADER.forEach((x) => pad(x, 365, 11, 15));
    for (let i = 0; i < 4; i++) {
      pad(562 + i * 12.7, 378, 7, 14);
      pad(562 + i * 12.7, 448, 7, 14);
    }
    pad(722, 466, 34, 10);
    pad(722, 514, 34, 10);
    pad(736, 535, 8, 12);
    pad(766, 535, 8, 12);
    [[729.5, 559], [748.5, 559], [729.5, 575], [739, 575], [748.5, 575]].forEach(([x, y]) => pad(x, y, 6, 7));
    for (const [x, w] of [[700, 24], [795, 24], [829, 18]]) {
      pad(x, 533, w, 8);
      pad(x, 572, w, 8);
    }
    // Programming pads, test points and vias
    [[60, 537], [101, 537], [47, 560], [69, 560], [90, 560], [111, 560]].forEach(([x, y]) => pad(x, y, 10, 19));
    for (const [x, y, r] of [[31, 556, 4], [27, 590, 8], [817, 130, 6], [820, 222, 6], [150, 500, 5], [690, 470, 5], [520, 452, 4], [610, 470, 4]]) {
      ctx.beginPath();
      ctx.arc(X(x), Y(y), r * k, 0, Math.PI * 2);
      ctx.fill();
    }
    // Button and jack pads
    for (const [x, y] of [[20, 128], [66, 128], [20, 172], [66, 172]]) pad(x, y, 12, 10);
    for (const [x, y] of [[40, 380], [110, 380], [40, 476], [120, 476]]) pad(x, y, 18, 10);
    // Battery contacts
    pad(180, 556, 14, 60);
    pad(668, 556, 14, 60);

    // Silkscreen
    ctx.strokeStyle = SILK;
    ctx.fillStyle = SILK;
    ctx.lineWidth = 2.5;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    const text = (s: string, x: number, y: number, cap: number) => strokeText(ctx, s, X(x), Y(y), cap * k, { stroke: 0.17 });
    // LCD outline and the texts hidden under the display
    ctx.strokeRect(X(90), Y(108), 690 * k, 268 * k);
    ctx.strokeRect(X(96), Y(114), 640 * k, 196 * k);
    text("tagsu_v6_r25", 430, 152, 13);
    text("We make money by pressing", 430, 200, 12);
    text("plastic buttons against a plastic board.", 430, 228, 12);
    text("- Rakettitiede -", 430, 262, 12);
    ctx.strokeRect(X(312), Y(354), 236 * k, 22 * k);
    // Part labels
    SMD.forEach((p) => text(p.id, p.x, p.id === "R4" ? 378 : p.y + 22, 8));
    LABELS.forEach(([s, x, y]) => text(s, x, y, s === "LCD1" ? 6.5 : 8));
    // Outlines
    ctx.strokeRect(X(550), Y(372), 56 * k, 82 * k);
    ctx.strokeRect(X(10), Y(375), 133 * k, 105 * k);
    ctx.strokeRect(X(12), Y(120), 62 * k, 60 * k);
    ctx.strokeRect(X(166), Y(474), 515 * k, 166 * k);
    text("BATT1", 424, 556, 20);
    text("−", 200, 556, 20);
    text("+", 650, 556, 20);
    // Left edge, read top to bottom with the letters' tops towards the LCD; `x` is the baseline
    const vertical = (s: string, x: number, cap: number, length: number) => {
      ctx.save();
      ctx.translate(X(x), Y(192));
      ctx.rotate(Math.PI / 2);
      strokeText(ctx, s, 0, (-cap / 2) * k, cap * k, { align: "left", stroke: 0.11, width: length * k, fit: "squeeze" });
      ctx.restore();
    };
    vertical("(C)opyright 2015", 71, 9, 135);
    vertical("Rakettitiede Oy", 57.5, 9, 126);
    vertical("Jari Tulilahti", 44, 9, 108);
    vertical("rakettitiede.com", 14, 16, 155);
    strokeText(ctx, "Tagsu.io", X(26), Y(510), 17.5 * k, { align: "left", stroke: 0.09, width: 121 * k });
    text("PRG", 81, 541, 7.5);
    logoPlaceholder(ctx, X(750), Y(374), 142 * k);
  });
  // The PCB's UVs are its outline in centimetres, centred on the board.
  tex.repeat.set(100 / PCB_U.w, 100 / PCB_U.h);
  tex.offset.set(0.5, 0.5);
  return tex;
}

/**
 * The underside, drawn as seen from behind (x mirrored): the big logo, CE and WEEE marks, the solder joints
 * of the through-hole parts and a few traces, measured from a photo of a real badge's back.
 */
export function pcbBackTexture(): THREE.CanvasTexture {
  const W = 2048;
  const H = Math.round((W * PCB_U.h) / PCB_U.w);
  const k = W / PCB_U.w;
  const left = 860 - (PCB_U.x + PCB_U.w);
  const X = (u: number) => (u - left) * k;
  const Y = (v: number) => (v - PCB_U.y) * k;
  const mirror = (frontX: number) => 860 - frontX;
  return canvasTexture(W, H, (ctx) => {
    const base = ctx.createLinearGradient(0, 0, W, H);
    base.addColorStop(0, "#2148b8");
    base.addColorStop(1, "#1a3c9e");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(10, 30, 90, 0.55)";
    ctx.lineWidth = 4;
    ctx.lineJoin = "round";
    const trace = (pts: [number, number][]) => {
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
      ctx.stroke();
    };
    trace([[243, 395], [240, 513], [320, 603], [633, 600]]);
    trace([[280, 512], [347, 580], [358, 580]]);
    trace([[330, 460], [329, 507], [400, 577], [548, 577]]);
    trace([[390, 413], [490, 512], [680, 512], [719, 550]]);
    const ring = (x: number, y: number, r: number, fill: string) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(X(x), Y(y), r * k, 0, Math.PI * 2);
      ctx.fill();
    };
    const joint = (x: number, y: number, rx: number, ry: number) => {
      const g = ctx.createRadialGradient(X(x) - rx * k * 0.3, Y(y) - ry * k * 0.3, 1, X(x), Y(y), Math.max(rx, ry) * k);
      g.addColorStop(0, "#f4f6f8");
      g.addColorStop(0.6, "#c4b88f");
      g.addColorStop(1, "#8f8566");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(X(x), Y(y), rx * k, ry * k, 0, 0, Math.PI * 2);
      ctx.fill();
    };
    HEADER.forEach((x) => joint(mirror(x), 385, 6, 10));
    joint(190, 568, 9, 9);
    joint(675, 563, 9, 9);
    joint(17, 210, 8, 6);
    joint(17, 233, 8, 6);
    for (const [x, y] of [[763, 448], [825, 448], [758, 581]]) {
      ring(x, y, 7, "#c9ccd1");
      ring(x, y, 3.5, "#0d1f55");
    }
    for (const [x, y] of [[193, 475], [380, 435], [658, 532], [760, 600], [820, 600], [700, 470]]) ring(x, y, 2.5, "#0d1f55");
    // Silkscreen
    logoPlaceholder(ctx, X(433), Y(137), 297 * k);
    ctx.strokeStyle = SILK;
    ctx.fillStyle = SILK;
    ctx.lineWidth = 7.5 * k;
    for (const cx of [358, 405]) {
      ctx.beginPath();
      ctx.arc(X(cx), Y(580), 25 * k, Math.PI * 0.5, Math.PI * 1.5);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(X(381), Y(580));
    ctx.lineTo(X(400), Y(580));
    ctx.stroke();
    // Crossed-out bin over a bar
    ctx.lineWidth = 3 * k;
    ctx.strokeRect(X(480), Y(552), 30 * k, 40 * k);
    ctx.beginPath();
    ctx.moveTo(X(475), Y(550));
    ctx.lineTo(X(515), Y(550));
    ctx.moveTo(X(463), Y(533));
    ctx.lineTo(X(527), Y(600));
    ctx.moveTo(X(527), Y(533));
    ctx.lineTo(X(463), Y(600));
    ctx.stroke();
    ctx.fillRect(X(467), Y(612), 56 * k, 13 * k);
  });
}

/** AAA NiMH cell: green wrapper with the gold positive end, as on the badge in the photo. */
export function batteryTexture(): THREE.CanvasTexture {
  const tex = canvasTexture(1024, 512, (ctx) => {
    // Drawn mirrored: the cylinder's UVs run against the canvas once the texture is turned along the cell.
    ctx.translate(1024, 0);
    ctx.scale(-1, 1);
    ctx.fillStyle = "#3e8a66";
    ctx.fillRect(0, 0, 1024, 512);
    const gold = ctx.createLinearGradient(0, 0, 0, 512);
    gold.addColorStop(0, "#f1cf6a");
    gold.addColorStop(0.5, "#d9a93a");
    gold.addColorStop(1, "#b98b25");
    ctx.fillStyle = gold;
    ctx.beginPath();
    ctx.moveTo(1024, 0);
    ctx.lineTo(560, 0);
    ctx.lineTo(820, 512);
    ctx.lineTo(1024, 512);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.textBaseline = "middle";
    // The mirrored canvas leaves letters upside down on the cell, so each one is flipped back where it stands.
    const label = (s: string, x: number, y: number, font: string, turn = 0, align: CanvasTextAlign = "left") => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(turn);
      ctx.scale(1, -1);
      ctx.font = font;
      ctx.textAlign = align;
      ctx.fillText(s, 0, 0);
      ctx.restore();
    };
    label("RECYCLED 800mAh", 140, 70, "700 46px system-ui, sans-serif");
    label("LADEN/CHARGE/CHARGER: 16h · 80mA", 140, 180, "600 30px system-ui, sans-serif");
    label("SCHNELLLADEFÄHIG · QUICK CHARGING", 140, 230, "600 30px system-ui, sans-serif");
    label("+", 880, 150, "800 120px system-ui, sans-serif");
    label("AAA", 70, 256, "800 64px system-ui, sans-serif", -Math.PI / 2, "center");
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.rotation = Math.PI / 2;
  tex.center.set(0.5, 0.5);
  return tex;
}

export function inductorTexture(): THREE.CanvasTexture {
  return canvasTexture(192, 192, (ctx) => {
    ctx.fillStyle = "#2a2b2f";
    ctx.fillRect(0, 0, 192, 192);
    ctx.fillStyle = "#8f9298";
    ctx.beginPath();
    ctx.roundRect(42, 56, 74, 13, 4);
    ctx.fill();
    ctx.save();
    ctx.translate(96, 108);
    ctx.rotate(Math.PI);
    ctx.fillStyle = "#c4c7cc";
    ctx.font = "400 58px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("470", 0, 0);
    ctx.restore();
  });
}

export function chipTexture(): THREE.CanvasTexture {
  return canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = "#1c1d21";
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = "#2c2e33";
    ctx.beginPath();
    ctx.arc(30, 30, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(220,224,230,0.6)";
    ctx.font = "600 34px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText("ATTINY85", 128, 118);
    ctx.font = "500 26px ui-monospace, monospace";
    ctx.fillText("20SU", 128, 156);
  });
}
