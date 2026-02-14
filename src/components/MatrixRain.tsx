import { useEffect, useRef } from "react";

const CHARS = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEFZ";
const FONT_SIZE = 14;
const DROP_SPEED = 0.05;

const MatrixRain = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let columns: number;
    let drops: number[];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      columns = Math.floor(canvas.width / FONT_SIZE);
      drops = Array.from({ length: columns }, () => Math.random() * -100);
    };

    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.font = `${FONT_SIZE}px monospace`;

      for (let i = 0; i < columns; i++) {
        const char = CHARS[Math.floor(Math.random() * CHARS.length)];
        const x = i * FONT_SIZE;
        const y = drops[i] * FONT_SIZE;

        // Bright green for the leading character
        ctx.fillStyle = `hsl(120, 100%, ${60 + Math.random() * 20}%)`;
        ctx.fillText(char, x, y);

        // Dimmer trail
        if (drops[i] > 1) {
          ctx.fillStyle = "hsl(120, 100%, 30%)";
          const trailChar = CHARS[Math.floor(Math.random() * CHARS.length)];
          ctx.fillText(trailChar, x, y - FONT_SIZE);
        }

        drops[i] += DROP_SPEED + Math.random() * 0.08;

        if (y > canvas.height && Math.random() > 0.98) {
          drops[i] = Math.random() * -20;
        }
      }

      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0, opacity: 0.15 }}
    />
  );
};

export default MatrixRain;
