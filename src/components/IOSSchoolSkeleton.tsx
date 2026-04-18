/**
 * IOSSchoolSkeleton
 * ------------------
 * iOS-style shimmer placeholder shaped like a school object.
 * A different object is used on each mount via a tiny module-level
 * counter, so navigating between pages cycles through them.
 *
 * Variants: book, laptop, pencil, backpack, ruler, calendar,
 *           notebook, beaker, graduation-cap, calculator, globe, palette
 *
 * Usage:
 *   <IOSSchoolSkeleton />                  // auto-rotating
 *   <IOSSchoolSkeleton variant="book" />   // pinned
 *   <IOSSchoolSkeleton label="Loading…" /> // with caption
 */

import { useMemo } from "react";

type Variant =
  | "book" | "laptop" | "pencil" | "backpack" | "ruler" | "calendar"
  | "notebook" | "beaker" | "cap" | "calculator" | "globe" | "palette";

const VARIANTS: Variant[] = [
  "book", "laptop", "pencil", "backpack", "ruler", "calendar",
  "notebook", "beaker", "cap", "calculator", "globe", "palette",
];

// Module-level rotation cursor — increments each mount.
let cursor = Math.floor(Math.random() * VARIANTS.length);
const nextVariant = (): Variant => {
  const v = VARIANTS[cursor % VARIANTS.length];
  cursor += 1;
  return v;
};

interface Props {
  variant?: Variant;
  label?: string;
  className?: string;
  fullScreen?: boolean;
}

const Skel = ({ className = "" }: { className?: string }) => (
  <div className={`ios-skeleton rounded-md ${className}`} />
);

const Book = () => (
  <div className="relative w-28 h-36">
    {/* Back cover */}
    <Skel className="absolute inset-0 rounded-r-lg rounded-l-sm" />
    {/* Pages */}
    <div className="absolute inset-y-2 left-1.5 right-1.5 bg-card rounded-sm" />
    {/* Spine highlight */}
    <Skel className="absolute inset-y-0 left-0 w-2 rounded-l-lg" />
    {/* Page lines */}
    <Skel className="absolute top-6 left-4 right-4 h-1.5 rounded-full" />
    <Skel className="absolute top-10 left-4 right-6 h-1.5 rounded-full" />
    <Skel className="absolute top-14 left-4 right-5 h-1.5 rounded-full" />
    <Skel className="absolute top-[72px] left-4 right-8 h-1.5 rounded-full" />
  </div>
);

const Laptop = () => (
  <div className="relative w-36 h-28">
    {/* Screen */}
    <Skel className="absolute top-0 left-2 right-2 h-20 rounded-lg" />
    <div className="absolute top-1.5 left-3.5 right-3.5 h-[68px] bg-card rounded-md" />
    {/* Camera dot */}
    <div className="absolute top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-muted-foreground/50" />
    {/* Base */}
    <Skel className="absolute bottom-0 left-0 right-0 h-3 rounded-b-xl rounded-t-sm" />
    {/* Trackpad notch */}
    <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-muted-foreground/20" />
  </div>
);

const Pencil = () => (
  <div className="relative w-32 h-32 flex items-center justify-center">
    <div className="relative w-32 h-7 -rotate-45">
      {/* Eraser */}
      <Skel className="absolute left-0 top-0 w-5 h-7 rounded-l-md" />
      {/* Ferrule */}
      <Skel className="absolute left-5 top-0 w-2.5 h-7" />
      {/* Body */}
      <Skel className="absolute left-[30px] top-0 right-5 h-7" />
      {/* Tip wood */}
      <div
        className="absolute right-2 top-0 h-7 w-3 ios-skeleton"
        style={{ clipPath: "polygon(0 0, 100% 50%, 0 100%)" }}
      />
      {/* Lead */}
      <div
        className="absolute right-0 top-0 h-7 w-2 ios-skeleton"
        style={{ clipPath: "polygon(0 35%, 100% 50%, 0 65%)" }}
      />
    </div>
  </div>
);

const Backpack = () => (
  <div className="relative w-28 h-36">
    {/* Handle */}
    <Skel className="absolute -top-1 left-1/2 -translate-x-1/2 w-10 h-3 rounded-t-full" />
    {/* Body */}
    <Skel className="absolute top-2 inset-x-0 h-32 rounded-2xl" />
    {/* Front pocket */}
    <Skel className="absolute bottom-3 left-3 right-3 h-10 rounded-xl" />
    {/* Strap top */}
    <div className="absolute top-6 left-2 w-2 h-12 ios-skeleton rounded-full" />
    <div className="absolute top-6 right-2 w-2 h-12 ios-skeleton rounded-full" />
    {/* Zipper */}
    <div className="absolute top-3 left-1/2 -translate-x-1/2 w-px h-9 bg-card" />
  </div>
);

const Ruler = () => (
  <div className="relative w-36 h-32 flex items-center justify-center">
    <div className="relative w-36 h-8 rotate-12">
      <Skel className="absolute inset-0 rounded-md" />
      {/* Tick marks */}
      {[10, 22, 34, 46, 58, 70, 82, 94, 106, 118, 130].map((x, i) => (
        <div
          key={i}
          className="absolute top-0 w-px bg-card"
          style={{ left: x, height: i % 2 === 0 ? 12 : 7 }}
        />
      ))}
    </div>
  </div>
);

const Calendar = () => (
  <div className="relative w-32 h-32">
    {/* Rings */}
    <div className="absolute -top-1 left-5 w-1.5 h-3 ios-skeleton rounded-full" />
    <div className="absolute -top-1 right-5 w-1.5 h-3 ios-skeleton rounded-full" />
    {/* Body */}
    <Skel className="absolute inset-0 top-1 rounded-xl" />
    {/* Header band */}
    <div className="absolute top-1 left-0 right-0 h-7 bg-card/40 rounded-t-xl" />
    {/* Date number area */}
    <div className="absolute inset-x-3 top-10 bottom-3 bg-card rounded-md flex items-center justify-center">
      <Skel className="w-10 h-10 rounded-md" />
    </div>
  </div>
);

const Notebook = () => (
  <div className="relative w-28 h-36">
    <Skel className="absolute inset-0 rounded-lg" />
    {/* Spiral binding */}
    {[6, 14, 22, 30, 38, 46, 54, 62, 70, 78, 86, 94, 102, 110, 118, 126].map((y) => (
      <div
        key={y}
        className="absolute -left-1 w-3 h-1 bg-card rounded-full border border-muted"
        style={{ top: y }}
      />
    ))}
    {/* Lines */}
    <div className="absolute left-5 right-3 top-6 space-y-3">
      <div className="h-1.5 bg-card/70 rounded-full" />
      <div className="h-1.5 bg-card/70 rounded-full" />
      <div className="h-1.5 bg-card/70 rounded-full w-3/4" />
      <div className="h-1.5 bg-card/70 rounded-full" />
      <div className="h-1.5 bg-card/70 rounded-full w-2/3" />
      <div className="h-1.5 bg-card/70 rounded-full" />
    </div>
  </div>
);

const Beaker = () => (
  <div className="relative w-28 h-36">
    {/* Neck */}
    <Skel className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-6 rounded-t-sm" />
    {/* Body */}
    <div
      className="absolute bottom-0 left-0 right-0 h-28 ios-skeleton"
      style={{ clipPath: "polygon(28% 0, 72% 0, 100% 100%, 0 100%)" }}
    />
    {/* Liquid line */}
    <div
      className="absolute bottom-3 left-1.5 right-1.5 h-2 bg-card/70"
      style={{ clipPath: "polygon(8% 0, 92% 0, 100% 100%, 0 100%)" }}
    />
    {/* Bubble */}
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-card/60" />
  </div>
);

const GradCap = () => (
  <div className="relative w-36 h-28">
    {/* Mortarboard */}
    <div
      className="absolute top-2 left-0 right-0 h-8 ios-skeleton"
      style={{ clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)" }}
    />
    {/* Cap base */}
    <Skel className="absolute top-9 left-7 right-7 h-6 rounded-b-lg" />
    {/* Tassel */}
    <div className="absolute top-6 right-3 w-px h-10 bg-muted-foreground/40" />
    <Skel className="absolute top-[60px] right-1 w-4 h-4 rounded-full" />
  </div>
);

const Calculator = () => (
  <div className="relative w-28 h-36">
    <Skel className="absolute inset-0 rounded-xl" />
    {/* Screen */}
    <div className="absolute top-2 left-2 right-2 h-7 bg-card rounded-md" />
    {/* Buttons grid */}
    <div className="absolute top-12 left-2 right-2 bottom-2 grid grid-cols-4 gap-1.5">
      {Array.from({ length: 16 }).map((_, i) => (
        <div key={i} className="bg-card rounded-sm" />
      ))}
    </div>
  </div>
);

const Globe = () => (
  <div className="relative w-32 h-36 flex items-center justify-center">
    {/* Stand */}
    <Skel className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-2 rounded-md" />
    <Skel className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1 h-4" />
    {/* Sphere */}
    <Skel className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-24 rounded-full" />
    {/* Equator + meridian (lighter) */}
    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-24 rounded-full border-t-2 border-card/50 rotate-12" />
    <div className="absolute top-[14px] left-1/2 -translate-x-1/2 w-6 h-24 rounded-full border-x-2 border-card/50" />
  </div>
);

const Palette = () => (
  <div className="relative w-36 h-28">
    {/* Palette base — kidney shape via border-radius */}
    <Skel className="absolute inset-0 rounded-[60%_40%_55%_45%/60%_55%_45%_40%]" />
    {/* Thumb hole */}
    <div className="absolute right-5 top-9 w-5 h-5 rounded-full bg-card" />
    {/* Paint dabs */}
    <div className="absolute top-3 left-4 w-3.5 h-3.5 rounded-full bg-card/70" />
    <div className="absolute top-2.5 left-12 w-3.5 h-3.5 rounded-full bg-card/70" />
    <div className="absolute top-6 left-20 w-3.5 h-3.5 rounded-full bg-card/70" />
    <div className="absolute bottom-4 left-5 w-3.5 h-3.5 rounded-full bg-card/70" />
    <div className="absolute bottom-6 left-14 w-3.5 h-3.5 rounded-full bg-card/70" />
  </div>
);

const RENDERERS: Record<Variant, () => JSX.Element> = {
  book: Book,
  laptop: Laptop,
  pencil: Pencil,
  backpack: Backpack,
  ruler: Ruler,
  calendar: Calendar,
  notebook: Notebook,
  beaker: Beaker,
  cap: GradCap,
  calculator: Calculator,
  globe: Globe,
  palette: Palette,
};

const LABELS: Record<Variant, string> = {
  book: "Cracking open the books…",
  laptop: "Booting up…",
  pencil: "Sharpening pencils…",
  backpack: "Packing your bag…",
  ruler: "Measuring twice…",
  calendar: "Checking the schedule…",
  notebook: "Flipping through notes…",
  beaker: "Mixing things up…",
  cap: "Almost graduated…",
  calculator: "Crunching numbers…",
  globe: "Spinning the globe…",
  palette: "Painting the canvas…",
};

const IOSSchoolSkeleton = ({
  variant,
  label,
  className = "",
  fullScreen = true,
}: Props) => {
  // Pick once per mount.
  const chosen = useMemo<Variant>(() => variant ?? nextVariant(), [variant]);
  const Render = RENDERERS[chosen];
  const caption = label ?? LABELS[chosen];

  const wrapper = fullScreen
    ? "min-h-screen flex items-center justify-center bg-background"
    : "flex items-center justify-center py-16";

  return (
    <div className={`${wrapper} ${className}`}>
      <div className="flex flex-col items-center gap-5 animate-ios-fade">
        <div className="animate-ios-pulse">
          <Render />
        </div>
        <p className="text-[15px] font-medium text-muted-foreground tracking-tight">
          {caption}
        </p>
      </div>
    </div>
  );
};

export default IOSSchoolSkeleton;
