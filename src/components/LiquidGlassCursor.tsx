import { useEffect, useRef } from "react";

/**
 * Global Liquid Glass cursor (v2).
 *  - Velocity-aware orb that stretches in the direction of motion (squash & stretch)
 *  - Chromatic-aberration aura (red/blue split) for true "glass refraction"
 *  - Specular highlight that lives inside the orb and tracks motion
 *  - Click ripple "splash" using a pooled SVG burst
 *  - Hovered targets receive cursor coords + velocity for shader-like sweeps
 *  - Touch / reduced-motion: disabled (mobile uses CSS-only iOS glass)
 */
export default function LiquidGlassCursor() {
  const orbRef = useRef<HTMLDivElement>(null);
  const auraRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<HTMLDivElement>(null);
  const splashLayerRef = useRef<HTMLDivElement>(null);
  const dropLayerRef = useRef<SVGSVGElement>(null);
  const dropGroupRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const isTouch =
      window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (isTouch || reduceMotion) return;

    const orb = orbRef.current!;
    const aura = auraRef.current!;
    const trail = trailRef.current!;
    const splashLayer = splashLayerRef.current!;
    const dropGroup = dropGroupRef.current!;

    const MAGNET_RADIUS = 60; // px around a button where magnetic pull engages
    const MAGNET_PULL = 0.35; // how strongly the orb is pulled toward the nearest edge
    const WOBBLE_MAX = 6; // max px the button itself shifts toward the cursor

    // Metaball droplets — spawned while dragging, return to the orb on release
    type Drop = {
      el: SVGCircleElement;
      x: number;
      y: number;
      vx: number;
      vy: number;
      r: number;
      born: number;
      returning: boolean;
    };
    const drops: Drop[] = [];
    const MAX_DROPS = 22;
    let dragging = false;
    let lastSpawn = 0;

    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let ox = mx,
      oy = my,
      tx = mx,
      ty = my,
      px = mx,
      py = my;
    let raf = 0;
    let hovered: HTMLElement | null = null;
    let magnetTarget: HTMLElement | null = null;
    const wobbled = new Set<HTMLElement>();

    const isInteractive = (el: Element | null): HTMLElement | null => {
      if (!el) return null;
      return (el as HTMLElement).closest(
        'button, a, [role="button"], [role="link"], [role="menuitem"], [role="tab"], summary, label[for], input[type="submit"], input[type="button"], .ios-tappable, .ios-tap-card',
      ) as HTMLElement | null;
    };

    const setHover = (next: HTMLElement | null) => {
      if (next === hovered) return;
      if (hovered) hovered.classList.remove("liquid-fill-active");
      hovered = next;
      if (hovered) hovered.classList.add("liquid-fill-active");
    };

    const clearWobble = (el: HTMLElement) => {
      el.style.removeProperty("--gel-x");
      el.style.removeProperty("--gel-y");
      el.classList.remove("liquid-gel-wobble");
      wobbled.delete(el);
    };

    const findNearestButton = (x: number, y: number): { el: HTMLElement; dist: number; cx: number; cy: number } | null => {
      // Cheap: only consider buttons near the cursor via elementsFromPoint at a few offsets
      const candidates = new Set<HTMLElement>();
      const offsets = [0, MAGNET_RADIUS, -MAGNET_RADIUS];
      for (const dx of offsets) {
        for (const dy of offsets) {
          const el = document.elementFromPoint(x + dx, y + dy);
          const btn = isInteractive(el);
          if (btn) candidates.add(btn);
        }
      }
      let best: { el: HTMLElement; dist: number; cx: number; cy: number } | null = null;
      candidates.forEach((el) => {
        const r = el.getBoundingClientRect();
        // distance to nearest edge point of the rect
        const cx = Math.max(r.left, Math.min(x, r.right));
        const cy = Math.max(r.top, Math.min(y, r.bottom));
        const d = Math.hypot(x - cx, y - cy);
        if (!best || d < best.dist) best = { el, dist: d, cx, cy };
      });
      return best;
    };

    const onMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
      setHover(isInteractive(e.target as Element));

      // Magnetic snap: if cursor is near (not yet over) a button, pull toward it + wobble it
      if (!hovered) {
        const near = findNearestButton(mx, my);
        if (near && near.dist > 0 && near.dist <= MAGNET_RADIUS) {
          if (magnetTarget && magnetTarget !== near.el) clearWobble(magnetTarget);
          magnetTarget = near.el;
          const strength = 1 - near.dist / MAGNET_RADIUS; // 0..1
          // pull orb target toward nearest edge point
          tx = mx + (near.cx - mx) * MAGNET_PULL * strength;
          ty = my + (near.cy - my) * MAGNET_PULL * strength;
          // wobble the button toward the cursor (gel)
          const r = near.el.getBoundingClientRect();
          const bcx = r.left + r.width / 2;
          const bcy = r.top + r.height / 2;
          const wx = Math.max(-WOBBLE_MAX, Math.min(WOBBLE_MAX, (mx - bcx) * 0.12 * strength));
          const wy = Math.max(-WOBBLE_MAX, Math.min(WOBBLE_MAX, (my - bcy) * 0.12 * strength));
          near.el.style.setProperty("--gel-x", `${wx}px`);
          near.el.style.setProperty("--gel-y", `${wy}px`);
          near.el.classList.add("liquid-gel-wobble");
          wobbled.add(near.el);
          // also expose entry coords for the liquid sweep
          const lx = ((mx - r.left) / r.width) * 100;
          const ly = ((my - r.top) / r.height) * 100;
          near.el.style.setProperty("--lq-x", `${lx}%`);
          near.el.style.setProperty("--lq-y", `${ly}%`);
        } else {
          if (magnetTarget) {
            clearWobble(magnetTarget);
            magnetTarget = null;
          }
          tx = mx;
          ty = my;
        }
      } else {
        if (magnetTarget && magnetTarget !== hovered) {
          clearWobble(magnetTarget);
          magnetTarget = null;
        }
        const r = hovered.getBoundingClientRect();
        // pour toward target — weighted toward the cursor for responsiveness
        tx = mx * 0.55 + (r.left + r.width / 2) * 0.45;
        ty = my * 0.55 + (r.top + r.height / 2) * 0.45;
        const lx = ((mx - r.left) / r.width) * 100;
        const ly = ((my - r.top) / r.height) * 100;
        hovered.style.setProperty("--lq-x", `${lx}%`);
        hovered.style.setProperty("--lq-y", `${ly}%`);
        // gentle gel pull on hovered button toward cursor
        const bcx = r.left + r.width / 2;
        const bcy = r.top + r.height / 2;
        const wx = Math.max(-WOBBLE_MAX, Math.min(WOBBLE_MAX, (mx - bcx) * 0.08));
        const wy = Math.max(-WOBBLE_MAX, Math.min(WOBBLE_MAX, (my - bcy) * 0.08));
        hovered.style.setProperty("--gel-x", `${wx}px`);
        hovered.style.setProperty("--gel-y", `${wy}px`);
        hovered.classList.add("liquid-gel-wobble");
        wobbled.add(hovered);
      }
    };

    const onLeave = () => {
      setHover(null);
      if (magnetTarget) {
        clearWobble(magnetTarget);
        magnetTarget = null;
      }
    };

    const spawnDrop = (now: number, vx: number, vy: number) => {
      if (drops.length >= MAX_DROPS) return;
      const speed = Math.hypot(vx, vy);
      if (speed < 0.5) return;
      const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      const r = 4 + Math.random() * 4;
      c.setAttribute("r", String(r));
      c.setAttribute("fill", "hsl(var(--primary))");
      // jitter perpendicular to motion so droplets fan slightly
      const perp = Math.random() * 6 - 3;
      const nx = -vy / (speed || 1);
      const ny = vx / (speed || 1);
      const sx = ox + nx * perp;
      const sy = oy + ny * perp;
      c.setAttribute("cx", String(sx));
      c.setAttribute("cy", String(sy));
      dropGroup.appendChild(c);
      drops.push({
        el: c,
        x: sx,
        y: sy,
        // small inherited momentum opposite of cursor motion
        vx: -vx * 0.25 + (Math.random() - 0.5) * 0.6,
        vy: -vy * 0.25 + (Math.random() - 0.5) * 0.6,
        r,
        born: now,
        returning: false,
      });
    };

    const onPointerDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      dragging = true;
    };
    const onPointerUp = () => {
      if (!dragging) return;
      dragging = false;
      // tell every droplet to come home
      for (const d of drops) d.returning = true;
    };

    const onClick = (e: MouseEvent) => {
      const splash = document.createElement("span");
      splash.className = "liquid-splash";
      splash.style.left = `${e.clientX}px`;
      splash.style.top = `${e.clientY}px`;
      splashLayer.appendChild(splash);
      window.setTimeout(() => splash.remove(), 700);
    };

    const tick = () => {
      const now = performance.now();
      // smoothing — softer when hovering for the "magnetic glide" feel
      const k = hovered ? 0.28 : 0.2;
      ox += (tx - ox) * k;
      oy += (ty - oy) * k;
      const vx = ox - px;
      const vy = oy - py;
      px = ox;
      py = oy;
      const speed = Math.min(Math.hypot(vx, vy), 40);
      const angle = Math.atan2(vy, vx) * (180 / Math.PI);
      // squash & stretch — elongate along motion vector
      const stretch = 1 + speed * 0.022;
      const squash = 1 - speed * 0.012;
      const baseScale = hovered ? 1.45 : 1;
      orb.style.transform = `translate3d(${ox - 18}px, ${oy - 18}px, 0) rotate(${angle}deg) scale(${
        baseScale * stretch
      }, ${baseScale * squash})`;
      // chromatic aura splits opposite the motion direction
      const split = Math.min(speed * 0.35, 6);
      aura.style.transform = `translate3d(${ox - 28}px, ${oy - 28}px, 0) rotate(${angle}deg)`;
      aura.style.setProperty("--lq-split", `${split}px`);
      trail.style.transform = `translate3d(${ox - 44}px, ${oy - 44}px, 0)`;
      trail.style.opacity = String(0.55 + Math.min(speed / 80, 0.4));
      // expose global pointer coords for any element that wants them
      document.documentElement.style.setProperty("--cursor-x", `${ox}px`);
      document.documentElement.style.setProperty("--cursor-y", `${oy}px`);

      // Drag droplets — spawn while dragging, simulate, then merge into orb on release
      if (dragging && now - lastSpawn > 35) {
        spawnDrop(now, vx, vy);
        lastSpawn = now;
      }
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        if (d.returning) {
          // pull strongly toward orb center, with friction
          const dx = ox - d.x;
          const dy = oy - d.y;
          d.vx = d.vx * 0.78 + dx * 0.18;
          d.vy = d.vy * 0.78 + dy * 0.18;
          d.x += d.vx;
          d.y += d.vy;
          d.r *= 0.94;
          // close enough → merge
          if (Math.hypot(dx, dy) < 6 || d.r < 1.2) {
            d.el.remove();
            drops.splice(i, 1);
            continue;
          }
        } else {
          // freefall while dragging — gentle gravity + drag
          d.vy += 0.18;
          d.vx *= 0.96;
          d.vy *= 0.98;
          d.x += d.vx;
          d.y += d.vy;
          // age-based shrink so the trail naturally tapers
          const age = now - d.born;
          if (age > 600) d.r *= 0.97;
          if (d.r < 1.5) {
            d.el.remove();
            drops.splice(i, 1);
            continue;
          }
        }
        d.el.setAttribute("cx", String(d.x));
        d.el.setAttribute("cy", String(d.y));
        d.el.setAttribute("r", String(d.r));
      }

      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseleave", onLeave);
    window.addEventListener("mousedown", onPointerDown, { passive: true });
    window.addEventListener("mouseup", onPointerUp, { passive: true });
    window.addEventListener("click", onClick, { passive: true });
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("mouseup", onPointerUp);
      window.removeEventListener("click", onClick);
      if (hovered) hovered.classList.remove("liquid-fill-active");
      wobbled.forEach((el) => clearWobble(el));
      drops.forEach((d) => d.el.remove());
      drops.length = 0;
    };
  }, []);

  return (
    <>
      <div ref={splashLayerRef} className="liquid-splash-layer" aria-hidden />
      <div ref={trailRef} className="liquid-cursor-trail" aria-hidden />
      <div ref={auraRef} className="liquid-cursor-aura" aria-hidden />
      <div ref={orbRef} className="liquid-cursor-orb" aria-hidden>
        <span className="liquid-cursor-spec" />
      </div>
    </>
  );
}
