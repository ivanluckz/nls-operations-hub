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

  useEffect(() => {
    const isTouch =
      window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (isTouch || reduceMotion) return;

    const orb = orbRef.current!;
    const aura = auraRef.current!;
    const trail = trailRef.current!;
    const splashLayer = splashLayerRef.current!;

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

    const onMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
      setHover(isInteractive(e.target as Element));
      if (hovered) {
        const r = hovered.getBoundingClientRect();
        // pour toward target — weighted toward the cursor for responsiveness
        tx = mx * 0.55 + (r.left + r.width / 2) * 0.45;
        ty = my * 0.55 + (r.top + r.height / 2) * 0.45;
        const lx = ((mx - r.left) / r.width) * 100;
        const ly = ((my - r.top) / r.height) * 100;
        hovered.style.setProperty("--lq-x", `${lx}%`);
        hovered.style.setProperty("--lq-y", `${ly}%`);
      } else {
        tx = mx;
        ty = my;
      }
    };

    const onLeave = () => setHover(null);

    const onClick = (e: MouseEvent) => {
      const splash = document.createElement("span");
      splash.className = "liquid-splash";
      splash.style.left = `${e.clientX}px`;
      splash.style.top = `${e.clientY}px`;
      splashLayer.appendChild(splash);
      window.setTimeout(() => splash.remove(), 700);
    };

    const tick = () => {
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
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseleave", onLeave);
    window.addEventListener("click", onClick, { passive: true });
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("click", onClick);
      if (hovered) hovered.classList.remove("liquid-fill-active");
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
