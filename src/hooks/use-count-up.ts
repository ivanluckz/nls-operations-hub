import { useEffect, useState } from "react";

export function useCountUp(end: number, duration = 1000) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (end === 0) { setCount(0); return; }
    const start = 0;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(start + (end - start) * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }, [end, duration]);

  return count;
}
