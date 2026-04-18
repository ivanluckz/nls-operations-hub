import { useEffect, useRef } from "react";

/**
 * Global liquid-glass cursor.
 * - Desktop: a soft glassy orb follows the cursor. When hovering a clickable
 *   element, the orb "pours" toward it and the element fills with a primary-tinted
 *   liquid sweep coming from the cursor's direction.
 * - Mobile / touch / reduced-motion: disabled (iOS already provides its own
 *   tactile feel; static glass surfaces in CSS handle the look there).
 */
export default function LiquidGlassCursor() {
  const orbRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const isTouch =
      typeof window !== "undefined" &&
      (window.matchMedia("(pointer: coarse)").matches ||
        "ontouchstart" in window);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (isTouch || reduceMotion) return;

    const orb = orbRef.current!;
    const trail = trailRef.current!;
    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let ox = mx;
    let oy = my;
    let tx = mx;
    let ty = my;
    let raf = 0;
    let hovered: HTMLElement | null = null;

    const isInteractive = (el: Element | null): HTMLElement | null => {
      if (!el) return null;
      const node = (el as HTMLElement).closest(
        'button, a, [role="button"], [role="link"], [role="menuitem"], [role="tab"], summary, label[for], input[type="submit"], input[type="button"], .ios-tappable, .ios-tap-card',
      );
      return node as HTMLElement | null;
    };

    const onMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
      const next = isInteractive(e.target as Element);
      if (next !== hovered) {
        if (hovered) hovered.classList.remove("liquid-fill-active");
        hovered = next;
        if (hovered) hovered.classList.add("liquid-fill-active");
      }
      if (hovered) {
        const r = hovered.getBoundingClientRect();
        // pull orb toward the hovered button center for the "pour" effect
        tx = mx * 0.35 + (r.left + r.width / 2) * 0.65;
        ty = my * 0.35 + (r.top + r.height / 2) * 0.65;
        // expose cursor-relative origin to the button for the liquid sweep
        const px = ((mx - r.left) / r.width) * 100;
        const py = ((my - r.top) / r.height) * 100;
        hovered.style.setProperty("--lq-x", `${px}%`);
        hovered.style.setProperty("--lq-y", `${py}%`);
      } else {
        tx = mx;
        ty = my;
      }
    };

    const onLeave = () => {
      if (hovered) hovered.classList.remove("liquid-fill-active");
      hovered = null;
    };

    const tick = () => {
      // smoothing
      ox += (tx - ox) * 0.22;
      oy += (ty - oy) * 0.22;
      orb.style.transform = `translate3d(${ox - 18}px, ${oy - 18}px, 0) scale(${
        hovered ? 1.5 : 1
      })`;
      trail.style.transform = `translate3d(${ox - 36}px, ${oy - 36}px, 0)`;
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseleave", onLeave);
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      if (hovered) hovered.classList.remove("liquid-fill-active");
    };
  }, []);

  return (
    <>
      <div ref={trailRef} className="liquid-cursor-trail" aria-hidden />
      <div ref={orbRef} className="liquid-cursor-orb" aria-hidden />
    </>
  );
}
