import { useMemo } from "react";

interface SandboxedAnimationProps {
  jsUrl: string;
}

/**
 * Renders user-uploaded JS animation inside a heavily sandboxed iframe.
 * The iframe has NO access to:
 * - Parent window / DOM
 * - Cookies / localStorage / sessionStorage
 * - Navigation / popups / forms
 * - Any app data whatsoever
 * 
 * It ONLY has: allow-scripts (to run the animation code)
 * The JS gets a full-screen <canvas> element to draw on.
 */
const SandboxedAnimation = ({ jsUrl }: SandboxedAnimationProps) => {
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
  // Provide a clean canvas API to the user script
  const canvas = document.getElementById('canvas');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');
  
  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  });

  // Block dangerous APIs inside the sandbox
  delete window.fetch;
  delete window.XMLHttpRequest;
  delete window.WebSocket;
  delete window.EventSource;
  window.open = () => null;
  navigator.sendBeacon = () => false;
</script>
<script src="${jsUrl}"><\/script>
</body>
</html>
  `.trim(), [jsUrl]);

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
