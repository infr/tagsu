"use client";

import { Html } from "@react-three/drei";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import * as THREE from "three";
import styles from "./Badge3D.module.css";
import { cellAt, drawLcd, LCD_RATIO, type LcdPicture } from "../lcdDraw";
import { batteryTexture, chipTexture, HEADER, inductorTexture, PCB_U, pcbBackTexture, pcbTexture, SMD } from "./textures";

// Centimetres; board units (0.1 mm from the plate's top-left corner) map to x right, y up.
const X = (u: number) => (u - 430) / 100;
const Y = (v: number) => (370 - v) / 100;

export const PLATE = { w: 8.6, h: 7.4, r: 0.45, t: 0.3 };
const SCREWS: [number, number][] = [[X(62), Y(62)], [X(798), Y(62)], [X(62), Y(678)], [X(798), Y(678)]];
const HOLES: [number, number][] = [[X(178), Y(46)], [X(682), Y(46)]];
/** The PCB's edges rest on 2 mm washers on the back plate. */
const Z = { back: -1.05, pcbTop: -0.39, modulePcb: -0.15, front: 0.56 };
const WASHER = 0.2;
const LCD = { x: X(430), y: Y(210) };
const SCREEN = { w: 6.67, h: 6.67 / LCD_RATIO };

type V3 = [number, number, number];

function roundedRect<T extends THREE.Shape | THREE.Path>(shape: T, x: number, y: number, w: number, h: number, r: number): T {
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r);
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}

const extrude = (shape: THREE.Shape, depth: number, bevel = 0) =>
  new THREE.ExtrudeGeometry(shape, { depth: depth - bevel * 2, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 32 }).translate(0, 0, bevel);

function plateGeometry(front: boolean) {
  const shape = roundedRect(new THREE.Shape(), -PLATE.w / 2, -PLATE.h / 2, PLATE.w, PLATE.h, PLATE.r);
  for (const [x, y] of SCREWS) shape.holes.push(new THREE.Path().absarc(x, y, 0.17, 0, Math.PI * 2, true));
  if (front) {
    // Keyring holes, and a window for the cell, which is thicker than the gap under the plate.
    for (const [x, y] of HOLES) shape.holes.push(new THREE.Path().absarc(x, y, 0.28, 0, Math.PI * 2, true));
    shape.holes.push(roundedRect(new THREE.Path(), X(160), Y(650), (690 - 160) / 100, (650 - 467) / 100, 0.15));
  }
  return extrude(shape, PLATE.t, 0.02);
}

function pcbGeometry() {
  const w = PCB_U.w / 100;
  const h = PCB_U.h / 100;
  return extrude(roundedRect(new THREE.Shape(), -w / 2, -h / 2, w, h, 0.18), 0.16);
}

function bezelGeometry() {
  const shape = roundedRect(new THREE.Shape(), -3.48, -1.03, 6.96, 2.06, 0.05);
  shape.holes.push(roundedRect(new THREE.Path(), -3.36, -0.92, 6.72, 1.84, 0.03));
  return extrude(shape, 0.08, 0.01);
}

/* ---------- Explode: every part flies from its place on the badge to a slot in a laid-out array ---------- */

type PartSpec = { id: string; name: string; size: [number, number] };

const PART_SPECS: PartSpec[] = [
  { id: "front", name: "Front plate · 3 mm acrylic", size: [8.6, 7.4] },
  { id: "pcb", name: "PCB · tagsu_v6_r25", size: [8.18, 5.58] },
  { id: "back", name: "Back plate · 3 mm acrylic", size: [8.6, 7.4] },
  { id: "lcd", name: "16×2 LCD module, blue backlight", size: [7.4, 2.75] },
  { id: "holder", name: "BATT1 · AAA holder", size: [5.15, 1.53] },
  { id: "cell", name: "AAA NiMH cell, 800 mAh", size: [4.6, 1.05] },
  { id: "jack", name: "X1 · 3.5 mm audio jack", size: [1.33, 1.05] },
  { id: "button", name: "Push button", size: [0.6, 0.6] },
  { id: "U1", name: "U1 · ATtiny85 microcontroller", size: [0.5, 0.7] },
  { id: "L1", name: "L1 · inductor", size: [0.62, 0.62] },
  { id: "U2", name: "U2 · boost converter", size: [0.3, 0.3] },
  { id: "D3", name: "D3 · Schottky diode", size: [0.36, 0.2] },
  { id: "C1", name: "C1 · tantalum capacitor", size: [0.3, 0.45] },
  { id: "C5", name: "C5 · tantalum capacitor", size: [0.3, 0.45] },
  { id: "C3", name: "C3 · capacitor", size: [0.23, 0.44] },
  ...SMD.map((p) => ({ id: p.id, name: `${p.id} · ${p.kind === "r" ? "resistor" : p.kind === "c" ? "capacitor" : "diode"}`, size: [0.16, 0.3] as [number, number] })),
  ...[0, 1, 2, 3].map((k) => ({ id: `screw${k}`, name: "Slotted screw", size: [1.0, 1.0] as [number, number] })),
  ...[0, 1, 2, 3].map((k) => ({ id: `post${k}`, name: "Barrel nut", size: [1.85, 1.0] as [number, number] })),
  ...[0, 1, 2, 3].map((k) => ({ id: `washer${k}`, name: "Washer · 2 mm", size: [0.9, 0.9] as [number, number] })),
];

/** Shelf-packs the parts into rows (in the order above), centred on the origin. */
function layoutParts(maxWidth = 19) {
  const slots = new Map<string, { x: number; y: number }>();
  const rows: { items: PartSpec[]; w: number; h: number }[] = [];
  let row: { items: PartSpec[]; w: number; h: number } = { items: [], w: 0, h: 0 };
  const gapFor = (p: PartSpec) => (p.size[0] > 2 ? 0.7 : 0.3);
  for (const p of PART_SPECS) {
    const add = (row.items.length ? gapFor(p) : 0) + p.size[0];
    if (row.items.length && row.w + add > maxWidth) {
      rows.push(row);
      row = { items: [], w: 0, h: 0 };
    }
    row.w += (row.items.length ? gapFor(p) : 0) + p.size[0];
    row.h = Math.max(row.h, p.size[1]);
    row.items.push(p);
  }
  rows.push(row);
  const rowGap = 0.6;
  const height = rows.reduce((a, r) => a + r.h, 0) + rowGap * (rows.length - 1);
  let y = height / 2;
  for (const r of rows) {
    let x = -r.w / 2;
    for (const p of r.items) {
      slots.set(p.id, { x: x + p.size[0] / 2, y: y - r.h / 2 });
      x += p.size[0] + gapFor(p);
    }
    y -= r.h + rowGap;
  }
  const width = Math.max(...rows.map((r) => r.w));
  return { slots, width, height };
}

export const EXPLODED = layoutParts();
const SPEC = new Map(PART_SPECS.map((p, i) => [p.id, { ...p, index: i }]));

type ExplodeCtx = { t: RefObject<number>; hovered: string | null; setHovered: (id: string | null) => void };
const Explode = createContext<ExplodeCtx | null>(null);

const ease = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x));

/** A part of the badge: sits at `at` when assembled and at its array slot (moved by `shift`, for parts whose origin isn't their centre) when exploded. */
function Part({ id, at, rot = [0, 0, 0], explodedRot = [0, 0, 0], shift = 0, children }: { id: string; at: V3; rot?: V3; explodedRot?: V3; shift?: number; children: ReactNode }) {
  const ctx = useContext(Explode)!;
  const ref = useRef<THREE.Group>(null);
  const spec = SPEC.get(id)!;
  const slot = EXPLODED.slots.get(id)!;
  const stagger = (spec.index / PART_SPECS.length) * 0.35;
  const [settled, setSettled] = useState(false);

  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const e = ease((ctx.t.current - stagger) / 0.65);
    g.position.set(at[0] + (slot.x + shift - at[0]) * e, at[1] + (slot.y - at[1]) * e, at[2] * (1 - e) + Math.sin(Math.PI * e) * 2.5);
    g.rotation.set(rot[0] + (explodedRot[0] - rot[0]) * e, rot[1] + (explodedRot[1] - rot[1]) * e, rot[2] + (explodedRot[2] - rot[2]) * e);
    if (settled !== (e === 1)) setSettled(e === 1);
  });

  return (
    <group
      ref={ref}
      position={at}
      rotation={rot}
      onPointerOver={(e) => {
        e.stopPropagation();
        ctx.setHovered(id);
      }}
      onPointerOut={() => ctx.setHovered(null)}
    >
      {children}
      {settled && ctx.hovered === id && (
        <Html center position={[0, -spec.size[1] / 2 - 0.35, 0.3]} className={styles.label} zIndexRange={[5, 0]}>
          {spec.name}
        </Html>
      )}
    </group>
  );
}

/* ---------- The LCD picture as a texture ---------- */

class LcdScreen {
  canvas = document.createElement("canvas");
  tex: THREE.CanvasTexture;

  constructor() {
    this.canvas.width = 1600;
    this.canvas.height = Math.round(1600 / LCD_RATIO);
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 8;
  }

  draw(picture: LcdPicture) {
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    drawLcd(ctx, this.canvas.width, this.canvas.height, picture, { sheen: false });
    this.tex.needsUpdate = true;
  }

  dispose() {
    this.tex.dispose();
  }
}

type Props = {
  picture: LcdPicture;
  exploded: boolean;
  onLcdClick: (row: 0 | 1, col: number) => void;
};

const metalProps = { color: "#d7dbe0", metalness: 1, roughness: 0.2, envMapIntensity: 1.4 } as const;
const blackProps = { color: "#17181b", roughness: 0.5 } as const;
const tinProps = { color: "#cfd3d8", metalness: 1, roughness: 0.3 } as const;

function Smd({ kind }: { kind: "r" | "c" | "d" }) {
  const body = kind === "r" ? "#18191c" : kind === "c" ? "#b08a5a" : "#1c1c1f";
  return (
    <>
      <mesh position={[0, 0, 0.04]} castShadow>
        <boxGeometry args={[0.13, 0.17, 0.08]} />
        <meshStandardMaterial color={body} roughness={0.5} />
      </mesh>
      {kind !== "d" ? (
        [-0.11, 0.11].map((dy) => (
          <mesh key={dy} position={[0, dy, 0.04]} castShadow>
            <boxGeometry args={[0.13, 0.05, 0.085]} />
            <meshStandardMaterial {...tinProps} />
          </mesh>
        ))
      ) : (
        <>
          <mesh position={[0, 0.06, 0.081]}>
            <boxGeometry args={[0.13, 0.03, 0.002]} />
            <meshStandardMaterial color="#c9ccd1" />
          </mesh>
          {[-0.12, 0.12].map((dy) => (
            <mesh key={dy} position={[0, dy, 0.015]}>
              <boxGeometry args={[0.06, 0.06, 0.03]} />
              <meshStandardMaterial {...tinProps} />
            </mesh>
          ))}
        </>
      )}
    </>
  );
}

export function BadgeModel({ picture, exploded, onLcdClick }: Props) {
  const invalidate = useThree((s) => s.invalidate);
  const reduced = useMemo(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  const t = useRef(0);
  const [hovered, setHovered] = useState<string | null>(null);

  const lcd = useMemo(() => new LcdScreen(), []);
  const tex = useMemo(() => ({ pcb: pcbTexture(), pcbBack: pcbBackTexture(), battery: batteryTexture(), inductor: inductorTexture(), chip: chipTexture() }), []);
  const geo = useMemo(() => ({ front: plateGeometry(true), back: plateGeometry(false), pcb: pcbGeometry(), bezel: bezelGeometry() }), []);

  useEffect(() => {
    lcd.draw(picture);
    invalidate();
  }, [picture, lcd, invalidate]);

  useEffect(() => {
    invalidate();
  }, [exploded, hovered, invalidate]);

  useEffect(
    () => () => {
      lcd.dispose();
      Object.values(tex).forEach((x) => x.dispose());
      Object.values(geo).forEach((x) => x.dispose());
    },
    [lcd, tex, geo],
  );

  useFrame((_, dt) => {
    const target = exploded ? 1 : 0;
    const step = reduced ? 1 : dt / 1.4;
    t.current = target > t.current ? Math.min(target, t.current + step) : Math.max(target, t.current - step);
    if (t.current !== target) invalidate();
  });

  const clickLcd = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (!e.uv || e.delta > 6) return;
    const { row, col } = cellAt(e.uv.x, 1 - e.uv.y);
    onLcdClick(row, col);
  };

  const lit = picture.light !== false;
  const ctx = useMemo(() => ({ t, hovered, setHovered }), [hovered]);
  const flatUp: V3 = [Math.PI / 2, 0, 0];

  return (
    <Explode.Provider value={ctx}>
      <group>
        <Part id="back" at={[0, 0, Z.back]}>
          <mesh geometry={geo.back} receiveShadow>
            <meshPhysicalMaterial attach="material-0" color="#eef4ff" transparent opacity={0.3} roughness={0.05} clearcoat={1} envMapIntensity={1.6} depthWrite={false} />
            <meshPhysicalMaterial attach="material-1" color="#e4eefb" transparent opacity={0.55} roughness={0.08} clearcoat={1} envMapIntensity={2} depthWrite={false} />
          </mesh>
        </Part>

        {SCREWS.map(([x, y], i) => (
          <Part key={i} id={`washer${i}`} at={[x, y, Z.back + PLATE.t + WASHER / 2]} rot={flatUp} explodedRot={flatUp}>
            <mesh castShadow receiveShadow>
              <cylinderGeometry args={[0.45, 0.45, WASHER, 40]} />
              <meshStandardMaterial {...blackProps} roughness={0.7} />
            </mesh>
          </Part>
        ))}

        <Part id="pcb" at={[X(PCB_U.x + PCB_U.w / 2), Y(PCB_U.y + PCB_U.h / 2), Z.pcbTop - 0.16]}>
          <mesh geometry={geo.pcb} receiveShadow castShadow>
            <meshStandardMaterial attach="material-0" map={tex.pcb} roughness={0.45} metalness={0.05} />
            <meshStandardMaterial attach="material-1" color="#8a8f62" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0, -0.002]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[PCB_U.w / 100 - 0.02, PCB_U.h / 100 - 0.02]} />
            <meshStandardMaterial map={tex.pcbBack} roughness={0.45} metalness={0.05} />
          </mesh>
        </Part>

        <Part id="lcd" at={[LCD.x, LCD.y, Z.modulePcb]}>
          <mesh position={[0.065, -0.275, 0.08]} castShadow receiveShadow>
            <boxGeometry args={[6.87, 2.75, 0.16]} />
            <meshStandardMaterial color="#1d3328" roughness={0.6} />
          </mesh>
          {/* Pin header strip the module sits on, down to the main board */}
          <mesh position={[X((HEADER[0] + HEADER[HEADER.length - 1]) / 2) - LCD.x, Y(365) - LCD.y, (Z.pcbTop - Z.modulePcb) / 2]} castShadow>
            <boxGeometry args={[(HEADER[HEADER.length - 1] - HEADER[0]) / 100 + 0.2, 0.25, Z.modulePcb - Z.pcbTop]} />
            <meshStandardMaterial {...blackProps} />
          </mesh>
          {HEADER.map((x) => (
            <mesh key={x} position={[X(x) - LCD.x, Y(365) - LCD.y, 0.17]}>
              <boxGeometry args={[0.1, 0.14, 0.02]} />
              <meshStandardMaterial color="#e0bb5e" metalness={1} roughness={0.3} />
            </mesh>
          ))}
          <mesh position={[0, 0, 0.29]} castShadow>
            <boxGeometry args={[6.9, 2.0, 0.26]} />
            <meshStandardMaterial color="#121418" roughness={0.4} />
          </mesh>
          {/* Acrylic board behind the module's PCB, filling the gap to the main board, lit by the backlight LED */}
          <mesh position={[0, 0, (Z.pcbTop - Z.modulePcb) / 2]} castShadow>
            <boxGeometry args={[6.9, 2.0, Z.modulePcb - Z.pcbTop - 0.01]} />
            <meshPhysicalMaterial color="#e9eefc" emissive={lit ? "#8ea6ff" : "#1a2240"} emissiveIntensity={lit ? 0.55 : 0.2} roughness={0.25} clearcoat={0.6} />
          </mesh>
          <mesh geometry={geo.bezel} position={[0, 0, 0.34]} castShadow>
            <meshStandardMaterial {...metalProps} />
          </mesh>
          <mesh position={[-0.03, -0.02, 0.425]}>
            <planeGeometry args={[6.72, 1.84]} />
            <meshBasicMaterial color={lit ? "#2a47e6" : "#0e1850"} toneMapped={false} />
          </mesh>
          <mesh
            position={[-0.03, -0.02, 0.43]}
            onClick={clickLcd}
            onPointerOver={() => (document.body.style.cursor = "text")}
            onPointerOut={() => (document.body.style.cursor = "")}
          >
            <planeGeometry args={[SCREEN.w, SCREEN.h]} />
            <meshBasicMaterial map={lcd.tex} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0, 0.432]}>
            <planeGeometry args={[6.72, 1.84]} />
            <meshPhysicalMaterial color="#ffffff" transparent opacity={0.07} roughness={0.05} clearcoat={1} />
          </mesh>
          {/* Backlight housing and LED */}
          <mesh position={[X(795) - LCD.x, Y(211) - LCD.y, 0.29]} castShadow>
            <boxGeometry args={[0.44, 1.63, 0.26]} />
            <meshStandardMaterial {...metalProps} />
          </mesh>
          <mesh position={[X(795) - LCD.x - 0.05, Y(211) - LCD.y, 0.43]}>
            <boxGeometry args={[0.28, 1.2, 0.02]} />
            <meshStandardMaterial color="#e8eeff" emissive={lit ? "#c9d6ff" : "#1a2240"} emissiveIntensity={lit ? 1.5 : 0.3} />
          </mesh>
        </Part>

        <Part id="button" at={[X(43), Y(150), Z.pcbTop]}>
          <mesh position={[0, 0, 0.17]} castShadow>
            <boxGeometry args={[0.53, 0.53, 0.34]} />
            <meshStandardMaterial {...metalProps} />
          </mesh>
          <mesh position={[0, 0, 0.4]} rotation={flatUp} castShadow>
            <cylinderGeometry args={[0.19, 0.21, 0.16, 32]} />
            <meshStandardMaterial {...blackProps} roughness={0.4} />
          </mesh>
        </Part>

        <Part id="jack" at={[X(76), Y(428), Z.pcbTop]}>
          <mesh position={[0, 0, 0.3]} castShadow>
            <boxGeometry args={[1.33, 1.05, 0.6]} />
            <meshStandardMaterial {...blackProps} />
          </mesh>
          <mesh position={[-0.75, 0.0, 0.3]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.28, 0.28, 0.2, 32]} />
            <meshStandardMaterial {...blackProps} />
          </mesh>
          <mesh position={[-0.86, 0, 0.3]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.13, 0.13, 0.03, 24]} />
            <meshStandardMaterial color="#050506" roughness={0.9} />
          </mesh>
          <mesh position={[X(42) - X(76), Y(415) - Y(428), 0.62]}>
            <boxGeometry args={[0.43, 0.36, 0.03]} />
            <meshStandardMaterial {...tinProps} />
          </mesh>
        </Part>

        {SMD.map((p) => (
          <Part key={p.id} id={p.id} at={[X(p.x), Y(p.y), Z.pcbTop]}>
            <Smd kind={p.kind} />
          </Part>
        ))}

        <Part id="U1" at={[X(578), Y(413), Z.pcbTop]}>
          <mesh position={[0, 0, 0.1]} castShadow>
            <boxGeometry args={[0.49, 0.39, 0.15]} />
            {[0, 1, 2, 3, 5].map((m) => (
              <meshStandardMaterial key={m} attach={`material-${m}`} color="#1c1d21" roughness={0.5} />
            ))}
            <meshStandardMaterial attach="material-4" map={tex.chip} roughness={0.5} />
          </mesh>
          {[0, 1, 2, 3].flatMap((k) =>
            [-1, 1].map((side) => (
              <mesh key={`${k}${side}`} position={[-0.19 + k * 0.127, side * 0.26, 0.04]}>
                <boxGeometry args={[0.05, 0.14, 0.04]} />
                <meshStandardMaterial {...tinProps} />
              </mesh>
            )),
          )}
        </Part>

        <Part id="L1" at={[X(722), Y(490), Z.pcbTop]}>
          <mesh position={[0, 0, 0.16]} castShadow>
            <boxGeometry args={[0.62, 0.61, 0.3]} />
            {[0, 1, 2, 3, 5].map((m) => (
              <meshStandardMaterial key={m} attach={`material-${m}`} color="#26272b" roughness={0.55} />
            ))}
            <meshStandardMaterial attach="material-4" map={tex.inductor} roughness={0.55} />
          </mesh>
        </Part>

        <Part id="U2" at={[X(739), Y(567), Z.pcbTop]}>
          <mesh position={[0, 0, 0.06]} castShadow>
            <boxGeometry args={[0.29, 0.16, 0.1]} />
            <meshStandardMaterial {...blackProps} />
          </mesh>
          {[[-0.095, -1], [0, -1], [0.095, -1], [-0.095, 1], [0.095, 1]].map(([x, side], k) => (
            <mesh key={k} position={[x, side * 0.12, 0.02]}>
              <boxGeometry args={[0.04, 0.08, 0.03]} />
              <meshStandardMaterial {...tinProps} />
            </mesh>
          ))}
        </Part>

        <Part id="D3" at={[X(751), Y(535), Z.pcbTop]}>
          <mesh position={[0, 0, 0.05]} castShadow>
            <boxGeometry args={[0.28, 0.16, 0.09]} />
            <meshStandardMaterial {...blackProps} />
          </mesh>
          <mesh position={[-0.09, 0, 0.096]}>
            <boxGeometry args={[0.04, 0.16, 0.002]} />
            <meshStandardMaterial color="#c9ccd1" />
          </mesh>
        </Part>

        {([["C1", 700], ["C5", 795]] as const).map(([id, u]) => (
          <Part key={id} id={id} at={[X(u), Y(552), Z.pcbTop]}>
            <mesh position={[0, 0, 0.1]} castShadow>
              <boxGeometry args={[0.28, 0.4, 0.19]} />
              <meshStandardMaterial color="#d1a34c" roughness={0.45} />
            </mesh>
            <mesh position={[0, 0.16, 0.196]}>
              <boxGeometry args={[0.28, 0.07, 0.002]} />
              <meshStandardMaterial color="#6b4a1c" />
            </mesh>
            {[-0.2, 0.2].map((dy) => (
              <mesh key={dy} position={[0, dy, 0.025]}>
                <boxGeometry args={[0.2, 0.04, 0.05]} />
                <meshStandardMaterial {...tinProps} />
              </mesh>
            ))}
          </Part>
        ))}

        <Part id="C3" at={[X(829), Y(552), Z.pcbTop]}>
          <mesh position={[0, 0, 0.07]} castShadow>
            <boxGeometry args={[0.22, 0.42, 0.14]} />
            <meshStandardMaterial color="#a39377" roughness={0.5} />
          </mesh>
          {[-0.18, 0.18].map((dy) => (
            <mesh key={dy} position={[0, dy, 0.07]}>
              <boxGeometry args={[0.225, 0.07, 0.145]} />
              <meshStandardMaterial {...tinProps} />
            </mesh>
          ))}
        </Part>

        <Part id="holder" at={[X(423.5), Y(556), Z.pcbTop]}>
          <mesh position={[0, 0, 0.04]} receiveShadow castShadow>
            <boxGeometry args={[5.15, 1.53, 0.08]} />
            <meshStandardMaterial {...blackProps} roughness={0.6} />
          </mesh>
          {[-0.72, 0.72].map((dy) => (
            <mesh key={dy} position={[0, dy, 0.3]} castShadow>
              <boxGeometry args={[5.15, 0.09, 0.6]} />
              <meshStandardMaterial {...blackProps} roughness={0.6} />
            </mesh>
          ))}
          {[-2.53, 2.53].map((dx) => (
            <mesh key={dx} position={[dx, 0, 0.42]} castShadow>
              <boxGeometry args={[0.09, 1.53, 0.84]} />
              <meshStandardMaterial {...blackProps} roughness={0.6} />
            </mesh>
          ))}
          {/* Negative spring and positive plate */}
          {[0, 1, 2, 3, 4].map((k) => (
            <mesh key={k} position={[-2.44 + k * 0.085, 0, 0.6]} rotation={[0, Math.PI / 2, 0]}>
              <torusGeometry args={[0.26 - k * 0.025, 0.02, 8, 24]} />
              <meshStandardMaterial {...tinProps} />
            </mesh>
          ))}
          <mesh position={[2.45, 0, 0.6]}>
            <boxGeometry args={[0.03, 0.5, 0.5]} />
            <meshStandardMaterial {...tinProps} />
          </mesh>
        </Part>

        <Part id="cell" at={[X(438.5), Y(563), Z.pcbTop + 0.08 + 0.525]}>
          <mesh position={[-0.05, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.525, 0.525, 4.4, 48, 1, true]} />
            <meshStandardMaterial map={tex.battery} roughness={0.35} metalness={0.15} side={THREE.DoubleSide} />
          </mesh>
          {[-2.25, 2.15].map((x) => (
            <mesh key={x} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.515, 0.515, 0.02, 48]} />
              <meshStandardMaterial color={x > 0 ? "#d2a94a" : "#b9bec6"} metalness={1} roughness={0.3} />
            </mesh>
          ))}
          <mesh position={[2.22, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.17, 0.17, 0.12, 24]} />
            <meshStandardMaterial color="#d8dde3" metalness={1} roughness={0.25} />
          </mesh>
        </Part>

        <Part id="front" at={[0, 0, Z.front]}>
          <mesh geometry={geo.front} renderOrder={2}>
            <meshPhysicalMaterial attach="material-0" color="#eef4ff" transparent opacity={0.1} roughness={0.04} clearcoat={1} clearcoatRoughness={0.04} envMapIntensity={1.6} depthWrite={false} />
            <meshPhysicalMaterial attach="material-1" color="#e4eefb" transparent opacity={0.55} roughness={0.08} clearcoat={1} envMapIntensity={2} depthWrite={false} />
          </mesh>
        </Part>

        {SCREWS.map(([x, y], i) => (
          <Part key={i} id={`screw${i}`} at={[x, y, Z.front + PLATE.t + 0.05]} rot={flatUp} explodedRot={flatUp}>
            <mesh castShadow>
              <cylinderGeometry args={[0.42, 0.46, 0.1, 48]} />
              <meshStandardMaterial {...metalProps} />
            </mesh>
            <mesh position={[0, 0.045, 0]} rotation={[0, 0.6 + i * 0.9, 0]}>
              <boxGeometry args={[0.84, 0.03, 0.07]} />
              <meshStandardMaterial color="#6d747d" metalness={1} roughness={0.45} />
            </mesh>
          </Part>
        ))}

        {/* Barrel nuts: a domed head under the back plate and a sleeve up to the front plate, which the screws thread into */}
        {SCREWS.map(([x, y], i) => (
          <Part key={i} id={`post${i}`} at={[x, y, Z.back]} rot={[-Math.PI / 2, 0, 0]} explodedRot={[0, 0, Math.PI / 2]} shift={-0.71}>
            <mesh castShadow scale={[1, 0.28, 1]}>
              <sphereGeometry args={[0.5, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial {...metalProps} />
            </mesh>
            <mesh position={[0, -(Z.front - Z.back) / 2, 0]} castShadow>
              <cylinderGeometry args={[0.16, 0.16, Z.front - Z.back, 32]} />
              <meshStandardMaterial {...metalProps} />
            </mesh>
          </Part>
        ))}
      </group>
    </Explode.Provider>
  );
}
