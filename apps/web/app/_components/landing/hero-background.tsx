"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Hero background — a calm perspective field of dots that breathes in slow
 * waves and reacts to the pointer: dots near the cursor lift and warm toward
 * the brand amber, then settle back. Monochrome otherwise, no gradients.
 */

const GRID_X = 120;
const GRID_Z = 60;
const SPACING = 0.42;
// far edge of the field — rows are packed non-uniformly so the plane visually
// runs all the way to the horizon at the top of the hero
const FAR = 42;

type Palette = { dot: THREE.Color; hot: THREE.Color; bg: THREE.Color };

function palette(): Palette {
  const dark = document.documentElement.classList.contains("dark");
  return dark
    ? {
        dot: new THREE.Color(0x50556a),
        hot: new THREE.Color(0xf2a33c),
        bg: new THREE.Color(0x14161c),
      }
    : {
        // light mode needs far darker dots — mid grays wash out on the pale bg
        dot: new THREE.Color(0x525a6e),
        hot: new THREE.Color(0xc26a05),
        bg: new THREE.Color(0xdfe2ea),
      };
}

export default function HeroBackground({ className = "" }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.display = "block";
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    // pitch ≈ half the FOV so the horizon sits at the very top edge of the hero
    const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 120);
    camera.position.set(0, 8.2, 8.6);
    camera.lookAt(0, 0, -6.2);

    let pal = palette();

    // ---- dot field ----
    const COUNT = GRID_X * GRID_Z;
    const basePos = new Float32Array(COUNT * 3);
    const positions = new Float32Array(COUNT * 3);
    const colors = new Float32Array(COUNT * 3);
    // per-dot distance fade toward the horizon (0 far … 1 near)
    const vis = new Float32Array(COUNT);

    let n = 0;
    for (let ix = 0; ix < GRID_X; ix++) {
      for (let iz = 0; iz < GRID_Z; iz++) {
        // t: 0 near → 1 far; rows bunch toward the camera, stretch to the horizon
        const t = iz / (GRID_Z - 1);
        const z = 8 - Math.pow(t, 1.55) * FAR;
        // fan the columns out with depth so the far field still covers the frame edges
        const x = (ix - GRID_X / 2) * SPACING * (1 + t * 0.9);
        basePos[n * 3] = x;
        basePos[n * 3 + 1] = 0;
        basePos[n * 3 + 2] = z;
        vis[n] = 0.14 + (1 - t) * 0.86;
        n++;
      }
    }
    positions.set(basePos);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.055,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      sizeAttenuation: true,
    });
    scene.add(new THREE.Points(geo, mat));

    // ---- pointer → world position on the dot plane ----
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2(10, 10); // offscreen until first move
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    const mouse = new THREE.Vector3(999, 0, 999); // smoothed
    const mouseTarget = new THREE.Vector3(999, 0, 999);

    const onPointer = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      // track even when the pointer is over hero content above the canvas
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
      raycaster.setFromCamera(ndc, camera);
      if (raycaster.ray.intersectPlane(plane, hit)) mouseTarget.copy(hit);
    };
    if (!reduceMotion) window.addEventListener("pointermove", onPointer, { passive: true });

    // ---- sizing / theme / visibility ----
    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    const mo = new MutationObserver(() => {
      pal = palette();
      if (reduceMotion) paint(0);
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    let visible = true;
    const io = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
    });
    io.observe(host);

    // ---- paint one frame of the field ----
    const c = new THREE.Color();
    function paint(t: number) {
      mouse.lerp(mouseTarget, 0.08);
      for (let i = 0; i < COUNT; i++) {
        const bx = basePos[i * 3]!;
        const bz = basePos[i * 3 + 2]!;

        // slow ambient swell
        let y = 0.18 * Math.sin(bx * 0.5 + t * 0.7) * Math.cos(bz * 0.45 + t * 0.5);

        // pointer lift + warmth
        const dx = bx - mouse.x;
        const dz = bz - mouse.z;
        const influence = Math.exp(-(dx * dx + dz * dz) / 1.9);
        y += influence * 0.85;

        positions[i * 3 + 1] = y;

        const warmth = Math.min(influence * 1.7, 1);
        c.copy(pal.dot).lerp(pal.hot, warmth);
        // fade to the page background toward the horizon
        c.lerpColors(pal.bg, c, vis[i]!);
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      }
      geo.attributes.position!.needsUpdate = true;
      geo.attributes.color!.needsUpdate = true;
      renderer.render(scene, camera);
    }

    let raf = 0;
    let t = 0;
    let last = performance.now();
    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (!visible) return;
      t += dt;
      paint(t);
    }

    if (reduceMotion) paint(0);
    else raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointer);
      ro.disconnect();
      mo.disconnect();
      io.disconnect();
      geo.dispose();
      mat.dispose();
      renderer.dispose();
      host.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={hostRef} className={className} aria-hidden />;
}
