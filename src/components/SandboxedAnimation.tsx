import { useMemo } from "react";

interface SandboxedAnimationProps {
  jsContent: string;
}

/**
 * Renders user JS animation inside a heavily sandboxed iframe.
 * sandbox="allow-scripts" — NO access to parent, cookies, storage, etc.
 */
const SandboxedAnimation = ({ jsContent }: SandboxedAnimationProps) => {
  const srcdoc = useMemo(() => `
<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; }
  html, body { width: 100%; height: 100%; overflow: hidden; background: transparent; }
  canvas { display: block; width: 100%; height: 100%; }
</style>
</head>
<body>
<canvas id="canvas"></canvas>
<script>
  const canvas = document.getElementById('canvas');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');
  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  });
  delete window.fetch;
  delete window.XMLHttpRequest;
  delete window.WebSocket;
  delete window.EventSource;
  window.open = () => null;
  navigator.sendBeacon = () => false;
</script>
<script>${jsContent.replace(/<\/script>/gi, '<\\/script>')}<\/script>
</body>
</html>
  `.trim(), [jsContent]);

  return (
    <iframe
      srcDoc={srcdoc}
      sandbox="allow-scripts"
      title="Theme animation"
      className="fixed inset-0 pointer-events-none border-0"
      style={{ zIndex: 0, opacity: 0.15, width: "100vw", height: "100vh" }}
    />
  );
};

export default SandboxedAnimation;
