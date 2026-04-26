// Fresh Energy - Wellness Animation
// Flowing wellness-focused animation with organic feel

const bubbles = [];
let time = 0;

class WellnessBubble {
  constructor(x, y, size) {
    this.x = x;
    this.y = y;
    this.baseY = y;
    this.size = size;
    this.life = 1;
    this.speed = Math.random() * 1 + 0.5;
  }

  update() {
    this.y -= this.speed;
    this.life -= 0.005;
    this.x += Math.sin(this.y * 0.02) * 0.5;
  }

  draw(ctx) {
    if (this.life <= 0) return;

    ctx.globalAlpha = Math.max(0, this.life) * 0.6;

    // Gradient bubble
    const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
    gradient.addColorStop(0, 'rgba(142, 184, 92, 0.4)');
    gradient.addColorStop(1, 'rgba(0, 184, 212, 0.1)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;
  }

  isAlive() {
    return this.life > 0;
  }
}

function draw() {
  time++;

  // Soft background fade
  ctx.fillStyle = 'rgba(245, 250, 245, 0.02)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Create bubbles
  if (time % 8 === 0) {
    bubbles.push(new WellnessBubble(
      Math.random() * canvas.width,
      canvas.height + 20,
      Math.random() * 20 + 10
    ));
  }

  // Update and draw bubbles
  for (let i = bubbles.length - 1; i >= 0; i--) {
    bubbles[i].update();
    bubbles[i].draw(ctx);
    if (!bubbles[i].isAlive()) {
      bubbles.splice(i, 1);
    }
  }

  // Draw organic flowing lines
  ctx.strokeStyle = `rgba(142, 184, 92, ${0.1 + Math.sin(time * 0.005) * 0.05})`;
  ctx.lineWidth = 2;
  ctx.beginPath();

  for (let x = 0; x < canvas.width; x += 20) {
    const y = canvas.height / 2 + Math.sin(x * 0.01 + time * 0.02) * 30;
    if (x === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();

  // Draw secondary wave
  ctx.strokeStyle = `rgba(0, 184, 212, ${0.05 + Math.cos(time * 0.005) * 0.03})`;
  ctx.beginPath();

  for (let x = 0; x < canvas.width; x += 20) {
    const y = canvas.height / 2 + Math.sin(x * 0.01 - time * 0.015) * 20;
    if (x === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();

  // Corner accents
  ctx.fillStyle = `rgba(142, 184, 92, ${(Math.sin(time * 0.01) * 0.5 + 0.5) * 0.15})`;
  ctx.fillRect(0, 0, 60, 60);
  ctx.fillRect(canvas.width - 60, canvas.height - 60, 60, 60);

  requestAnimationFrame(draw);
}

draw();
