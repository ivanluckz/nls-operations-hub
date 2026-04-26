// Midnight Athlete - Neon Pulse Animation
// Canvas-based animation with electrifying neon effect

const colors = ['#00ffff', '#ff00ff', '#00ff88'];
let particles = [];

class Particle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 3;
    this.vy = (Math.random() - 0.5) * 3;
    this.life = 1;
    this.decay = Math.random() * 0.02 + 0.01;
    this.color = colors[Math.floor(Math.random() * colors.length)];
    this.size = Math.random() * 3 + 1;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life -= this.decay;
    this.vy += 0.1;
  }

  draw(ctx) {
    const alpha = Math.max(0, this.life);
    ctx.globalAlpha = alpha * 0.8;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  isAlive() {
    return this.life > 0;
  }
}

function drawBackground(ctx) {
  ctx.fillStyle = 'rgba(20, 20, 40, 0.1)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Grid lines
  ctx.strokeStyle = 'rgba(0, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  const gridSize = 40;
  for (let i = 0; i < canvas.width; i += gridSize) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, canvas.height);
    ctx.stroke();
  }
  for (let i = 0; i < canvas.height; i += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(canvas.width, i);
    ctx.stroke();
  }
}

let time = 0;

function draw() {
  time++;
  drawBackground(ctx);

  // Create particles randomly
  if (Math.random() > 0.7) {
    particles.push(new Particle(
      Math.random() * canvas.width,
      Math.random() * canvas.height
    ));
  }

  // Update and draw particles
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    particles[i].draw(ctx);
    if (!particles[i].isAlive()) {
      particles.splice(i, 1);
    }
  }

  // Draw pulsing border
  const pulse = Math.sin(time * 0.02) * 0.5 + 0.5;
  ctx.strokeStyle = `rgba(0, 255, 255, ${pulse * 0.3})`;
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

  requestAnimationFrame(draw);
}

draw();
