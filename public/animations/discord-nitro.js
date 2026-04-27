/**
 * 🎆 Discord Nitro Style Premium Animations
 * Collection of interactive animations for developers
 */

class NitroAnimations {
  /**
   * Create glowing particles that float upward
   * Usage: NitroAnimations.createParticles(element, count)
   */
  static createParticles(element, count = 20) {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'];

    for (let i = 0; i < count; i++) {
      const particle = document.createElement('div');
      particle.style.position = 'fixed';
      particle.style.width = Math.random() * 10 + 5 + 'px';
      particle.style.height = particle.style.width;
      particle.style.background = colors[Math.floor(Math.random() * colors.length)];
      particle.style.borderRadius = '50%';
      particle.style.pointerEvents = 'none';
      particle.style.boxShadow = `0 0 ${Math.random() * 10 + 5}px ${particle.style.background}`;

      const rect = element.getBoundingClientRect();
      particle.style.left = rect.left + Math.random() * rect.width + 'px';
      particle.style.top = rect.top + Math.random() * rect.height + 'px';

      document.body.appendChild(particle);

      const duration = Math.random() * 2 + 2;
      const distance = Math.random() * 200 + 100;
      const angle = (Math.random() - 0.5) * Math.PI;

      let startTime = Date.now();
      const animate = () => {
        const elapsed = (Date.now() - startTime) / 1000;
        const progress = elapsed / duration;

        if (progress > 1) {
          particle.remove();
          return;
        }

        const x = Math.cos(angle) * distance * progress;
        const y = -distance * progress;
        const opacity = 1 - progress;

        particle.style.transform = `translate(${x}px, ${y}px)`;
        particle.style.opacity = opacity;

        requestAnimationFrame(animate);
      };

      animate();
    }
  }

  /**
   * Create confetti explosion effect
   * Usage: NitroAnimations.confetti(element)
   */
  static confetti(element) {
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const confettiPieces = [];

    for (let i = 0; i < 50; i++) {
      const piece = document.createElement('div');
      piece.style.position = 'fixed';
      piece.style.left = x + 'px';
      piece.style.top = y + 'px';
      piece.style.width = '10px';
      piece.style.height = '10px';
      piece.style.background = `hsl(${Math.random() * 360}, 70%, 60%)`;
      piece.style.pointerEvents = 'none';
      piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';

      document.body.appendChild(piece);
      confettiPieces.push(piece);

      const velocity = {
        x: (Math.random() - 0.5) * 15,
        y: (Math.random() - 0.5) * 15 - 5
      };

      let startTime = Date.now();
      const animate = () => {
        const elapsed = (Date.now() - startTime) / 1000;

        if (elapsed > 3) {
          piece.remove();
          return;
        }

        velocity.y += 0.2; // gravity
        const newX = x + velocity.x * elapsed * 100;
        const newY = y + velocity.y * elapsed * 100;
        const opacity = Math.max(0, 1 - elapsed / 3);

        piece.style.transform = `translate(${newX}px, ${newY}px) rotate(${elapsed * 360}deg)`;
        piece.style.opacity = opacity;

        requestAnimationFrame(animate);
      };

      animate();
    }
  }

  /**
   * Create ripple effect from click point
   * Usage: NitroAnimations.ripple(event)
   */
  static ripple(event) {
    const ripple = document.createElement('div');
    const rect = event.currentTarget.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;

    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    ripple.style.position = 'absolute';
    ripple.style.background = 'rgba(255, 255, 255, 0.5)';
    ripple.style.borderRadius = '50%';
    ripple.style.pointerEvents = 'none';
    ripple.style.opacity = '0.7';

    event.currentTarget.appendChild(ripple);

    const duration = 600;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / duration;

      if (progress > 1) {
        ripple.remove();
        return;
      }

      ripple.style.transform = `scale(${progress * 2})`;
      ripple.style.opacity = 0.7 * (1 - progress);

      requestAnimationFrame(animate);
    };

    animate();
  }

  /**
   * Create glitch effect
   * Usage: NitroAnimations.glitch(element)
   */
  static glitch(element) {
    const originalText = element.textContent;
    const glitchChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    let glitchCount = 0;

    const glitchInterval = setInterval(() => {
      if (glitchCount > 20) {
        clearInterval(glitchInterval);
        element.textContent = originalText;
        return;
      }

      let glitchedText = '';
      for (let i = 0; i < originalText.length; i++) {
        if (Math.random() > 0.7) {
          glitchedText += glitchChars[Math.floor(Math.random() * glitchChars.length)];
        } else {
          glitchedText += originalText[i];
        }
      }

      element.textContent = glitchedText;
      glitchCount++;
    }, 50);
  }

  /**
   * Create pulse/heartbeat effect
   * Usage: NitroAnimations.pulse(element, options)
   */
  static pulse(element, options = {}) {
    const {
      duration = 0.6,
      scale = 1.1,
      color = 'rgba(99, 179, 237, 0.5)'
    } = options;

    const pulse = document.createElement('div');
    pulse.style.position = 'absolute';
    pulse.style.width = '100%';
    pulse.style.height = '100%';
    pulse.style.top = '0';
    pulse.style.left = '0';
    pulse.style.borderRadius = element.style.borderRadius || '0';
    pulse.style.backgroundColor = color;
    pulse.style.pointerEvents = 'none';
    pulse.style.zIndex = '-1';

    element.style.position = 'relative';
    element.appendChild(pulse);

    const startTime = Date.now();
    const animate = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      const progress = (elapsed % duration) / duration;

      pulse.style.transform = `scale(${1 + (scale - 1) * Math.sin(progress * Math.PI)})`;
      pulse.style.opacity = 1 - progress;

      requestAnimationFrame(animate);
    };

    animate();
  }

  /**
   * Create floating background animation
   * Usage: NitroAnimations.floatingBg(element)
   */
  static floatingBg(element) {
    const canvas = document.createElement('canvas');
    canvas.width = element.clientWidth;
    canvas.height = element.clientHeight;
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.zIndex = '-1';
    canvas.style.opacity = '0.5';

    element.style.position = 'relative';
    element.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    const particles = [];

    // Create particles
    for (let i = 0; i < 50; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        radius: Math.random() * 2 + 1,
        opacity: Math.random() * 0.5 + 0.3
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.fillStyle = `rgba(99, 179, 237, ${p.opacity})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      requestAnimationFrame(animate);
    };

    animate();
  }

  /**
   * Create rainbow text effect
   * Usage: NitroAnimations.rainbowText(element)
   */
  static rainbowText(element) {
    const text = element.textContent;
    const colors = [
      '#FF0000', '#FF7F00', '#FFFF00', '#00FF00',
      '#0000FF', '#4B0082', '#9400D3'
    ];

    let html = '';
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const color = colors[i % colors.length];
      html += `<span style="color: ${color}; transition: all 0.3s ease;">${char}</span>`;
    }

    element.innerHTML = html;

    const spans = element.querySelectorAll('span');
    spans.forEach((span, i) => {
      span.addEventListener('mouseenter', () => {
        span.style.textShadow = `0 0 10px ${colors[i % colors.length]}`;
        span.style.transform = 'scale(1.2)';
      });

      span.addEventListener('mouseleave', () => {
        span.style.textShadow = 'none';
        span.style.transform = 'scale(1)';
      });
    });
  }

  /**
   * Initialize all animations on page
   * Usage: NitroAnimations.init()
   */
  static init() {
    // Add ripple effect to all buttons
    document.querySelectorAll('button, [data-nitro-ripple]').forEach(btn => {
      btn.addEventListener('click', (e) => this.ripple(e));
      btn.style.position = 'relative';
      btn.style.overflow = 'hidden';
    });

    // Add animations to elements with data attributes
    document.querySelectorAll('[data-nitro-particles]').forEach(el => {
      el.addEventListener('click', () => this.createParticles(el, 30));
    });

    console.log('🎆 Nitro Animations initialized!');
  }
}

// Export for use
if (typeof window !== 'undefined') {
  window.NitroAnimations = NitroAnimations;
}
