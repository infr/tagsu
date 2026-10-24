"use client";

import { CameraControls, CameraControlsImpl, Environment, Lightformer } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { Component, useEffect, useRef, type ReactNode } from "react";
import styles from "./Badge3D.module.css";
import { BadgeModel, EXPLODED, PLATE } from "./BadgeModel";
import type { LcdPicture } from "../lcdDraw";

type Props = {
  picture: LcdPicture;
  /** Face the viewer squarely, e.g. while typing. */
  flat: boolean;
  /** All parts laid out side by side. */
  exploded: boolean;
  /** Fill the parent instead of keeping the badge's aspect ratio. */
  fill?: boolean;
  /** Frames the assembled badge to the canvas with this much room around it, instead of the fixed close-up. */
  fit?: number;
  onLcdClick: (row: 0 | 1, col: number) => void;
  /** Shown if WebGL isn't available. */
  fallback: ReactNode;
};

class WebGlBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

const FOV = 26;
const TARGET: [number, number, number] = [0, 0.2, 0];
const IDLE: [number, number, number] = [-4.8, 3.4, 20.2];
const FRONT: [number, number, number] = [0, 0.2, 21.5];
const { ACTION } = CameraControlsImpl;

/**
 * Assembled: drag turns the badge all the way around (no wheel zoom, so the page still scrolls).
 * Exploded: drag pans, wheel or pinch zooms towards the pointer, right-drag turns.
 */
function Camera({ flat, exploded, fit }: { flat: boolean; exploded: boolean; fit?: number }) {
  const ref = useRef<CameraControlsImpl>(null);
  const aspect = useThree((s) => s.size.width / s.size.height);
  const invalidate = useThree((s) => s.invalidate);
  // The first framing jumps into place; later changes (explode, editing, resizing) glide.
  const framedRef = useRef(false);

  useEffect(() => {
    const c = ref.current;
    if (!c || !(aspect > 0) || !Number.isFinite(aspect)) return;
    const glide = framedRef.current;
    framedRef.current = true;
    if (exploded) {
      const tan = Math.tan(((FOV / 2) * Math.PI) / 180);
      const fit = Math.max(EXPLODED.height / 2 / tan, EXPLODED.width / 2 / (tan * aspect)) * 1.1;
      c.minDistance = 2;
      c.maxDistance = fit * 1.6;
      void c.setLookAt(0, 0, fit, 0, 0, 0, glide);
    } else {
      const from = flat ? FRONT : IDLE;
      const base = Math.hypot(...from.map((v, k) => v - TARGET[k]));
      let scale = 1;
      if (fit) {
        const tan = Math.tan(((FOV / 2) * Math.PI) / 180);
        scale = (Math.max(PLATE.h / 2 / tan, PLATE.w / 2 / (tan * aspect)) * fit) / base;
      }
      const [x, y, z] = from.map((v, k) => TARGET[k] + (v - TARGET[k]) * scale);
      c.minDistance = 12 * scale;
      c.maxDistance = 40 * scale;
      void c.setLookAt(x, y, z, ...TARGET, glide);
    }
    // On-demand rendering: the first frame starts the transition, which then keeps requesting frames.
    invalidate();
  }, [exploded, flat, fit, aspect, invalidate]);

  return (
    <CameraControls
      ref={ref}
      makeDefault
      smoothTime={0.35}
      dollyToCursor
      mouseButtons={{ left: exploded ? ACTION.TRUCK : ACTION.ROTATE, middle: ACTION.DOLLY, right: exploded ? ACTION.ROTATE : ACTION.NONE, wheel: exploded ? ACTION.DOLLY : ACTION.NONE }}
      touches={{ one: exploded ? ACTION.TOUCH_TRUCK : ACTION.TOUCH_ROTATE, two: exploded ? ACTION.TOUCH_DOLLY_TRUCK : ACTION.NONE, three: ACTION.NONE }}
    />
  );
}

/** The badge as a 3D model: acrylic sandwich, PCB and parts, with the LCD drawn live onto the screen. */
export default function Badge3D({ picture, flat, exploded, fill = false, fit, onLcdClick, fallback }: Props) {
  return (
    <WebGlBoundary fallback={fallback}>
      <div className={`${styles.stage} ${fill ? styles.fill : ""} ${exploded ? styles.grab : ""}`}>
        <Canvas
          frameloop="demand"
          dpr={[1, 2]}
          shadows
          camera={{ fov: FOV, position: IDLE, near: 0.5, far: 300 }}
          gl={{ antialias: true, alpha: true }}
          aria-label="Badge preview: drag to turn it"
        >
          <Camera flat={flat} exploded={exploded} fit={fit} />
          <ambientLight intensity={0.5} />
          <directionalLight position={[4, 7, 10]} intensity={2} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12} />
          <directionalLight position={[-5, -3, -10]} intensity={0.8} />
          <Environment resolution={256} frames={1}>
            <color attach="background" args={["#5a606c"]} />
            <Lightformer form="rect" intensity={4} color="#ffffff" position={[0, 7, 5]} scale={[14, 5, 1]} />
            <Lightformer form="rect" intensity={2} color="#dfe8ff" position={[-9, 1, 3]} rotation-y={Math.PI / 2} scale={[10, 4, 1]} />
            <Lightformer form="rect" intensity={1.6} color="#fff1dc" position={[9, -1, 3]} rotation-y={-Math.PI / 2} scale={[10, 4, 1]} />
            <Lightformer form="rect" intensity={1.2} color="#ffffff" position={[0, -7, 4]} rotation-x={-Math.PI / 2} scale={[14, 4, 1]} />
            <Lightformer form="rect" intensity={1.5} color="#ffffff" position={[0, 2, -8]} scale={[14, 6, 1]} />
            <Lightformer form="ring" intensity={3} color="#ffffff" position={[3, 3, 9]} scale={2} />
          </Environment>
          <BadgeModel picture={picture} exploded={exploded} onLcdClick={onLcdClick} />
        </Canvas>
      </div>
    </WebGlBoundary>
  );
}
