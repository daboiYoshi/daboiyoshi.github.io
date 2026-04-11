/* ============================================================
   VOID BREACH — 3D Renderer (Canvas-based pseudo-3D)
   All geometry is drawn on a 2D canvas with perspective math
   ============================================================ */

'use strict';

const Renderer = (() => {

  /* ── Types ─────────────────────────────────────────────── */
  const NEAR = 0.1, FAR = 2000;
  let canvas, ctx, W, H, cx, cy;
  let fov = 75;  // degrees
  let fovRad, aspectRatio, tanHalfFov;

  function init(canvasEl) {
    canvas = canvasEl;
    ctx    = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }

  function resize() {
    W  = canvas.width  = window.innerWidth;
    H  = canvas.height = window.innerHeight;
    cx = W / 2;
    cy = H / 2;
    fovRad      = fov * Math.PI / 180;
    aspectRatio = W / H;
    tanHalfFov  = Math.tan(fovRad / 2);
  }

  /* ── Projection ─────────────────────────────────────────── */
  // Projects a 3D point (already in camera space) to 2D screen coords.
  // Returns null if behind camera.
  function project(x, y, z) {
    if (z < NEAR) return null;
    const scale = 1 / (z * tanHalfFov);
    const sx = cx + x * scale * cx;
    const sy = cy - y * scale * cx; // uniform scale to preserve FOV
    const w  = scale * cx;          // half-projected-size for scale ref
    return { x: sx, y: sy, z, w, scale };
  }

  /* ── Clear ──────────────────────────────────────────────── */
  function clear() {
    ctx.fillStyle = '#000008';
    ctx.fillRect(0, 0, W, H);
  }

  /* ── Stars ──────────────────────────────────────────────── */
  function drawStar(x, y, radius, opacity) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${opacity})`;
    ctx.fill();
  }

  /* ── Generic mesh ───────────────────────────────────────── */
  // Draws a polygon from projected verts
  function drawPoly(pts, fillColor, strokeColor, strokeW) {
    if (pts.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    if (fillColor) { ctx.fillStyle = fillColor; ctx.fill(); }
    if (strokeColor) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeW || 1;
      ctx.stroke();
    }
  }

  /* ── Ship ───────────────────────────────────────────────── */
  function drawPlayerShip(px, py, roll, thrustLevel) {
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(roll);

    const s = 26;
    // Main body
    const body = [
      { x:  0,    y: -s*1.8 },
      { x: -s*0.5, y:  0    },
      { x:  0,    y:  s*0.4 },
      { x:  s*0.5, y:  0    }
    ];
    ctx.beginPath();
    ctx.moveTo(body[0].x, body[0].y);
    for (let v of body.slice(1)) ctx.lineTo(v.x, v.y);
    ctx.closePath();
    ctx.fillStyle = '#0a1a2e';
    ctx.fill();
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Wings
    const lWing = [
      { x:  0,     y: -s*0.2 },
      { x: -s*1.6, y:  s*0.8 },
      { x: -s*0.8, y:  s*1.0 },
      { x: -s*0.2, y:  s*0.3 }
    ];
    const rWing = lWing.map(v => ({ x: -v.x, y: v.y }));

    for (const wing of [lWing, rWing]) {
      ctx.beginPath();
      ctx.moveTo(wing[0].x, wing[0].y);
      for (let v of wing.slice(1)) ctx.lineTo(v.x, v.y);
      ctx.closePath();
      ctx.fillStyle = 'rgba(0,80,120,0.7)';
      ctx.fill();
      ctx.strokeStyle = '#0077ff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Cockpit glow
    ctx.beginPath();
    ctx.ellipse(0, -s*0.8, s*0.18, s*0.35, 0, 0, Math.PI*2);
    ctx.fillStyle = '#00e5ff';
    ctx.fill();

    const cockpitGrad = ctx.createRadialGradient(0, -s*0.8, 0, 0, -s*0.8, s*0.5);
    cockpitGrad.addColorStop(0, 'rgba(0,229,255,0.6)');
    cockpitGrad.addColorStop(1, 'rgba(0,229,255,0)');
    ctx.beginPath();
    ctx.arc(0, -s*0.8, s*0.5, 0, Math.PI*2);
    ctx.fillStyle = cockpitGrad;
    ctx.fill();

    // Engine glow (thruster)
    if (thrustLevel > 0) {
      const eg = ctx.createRadialGradient(0, s*0.5, 0, 0, s*1.2, s*0.6);
      eg.addColorStop(0, `rgba(0,200,255,${0.9 * thrustLevel})`);
      eg.addColorStop(0.3, `rgba(100,0,255,${0.6 * thrustLevel})`);
      eg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.ellipse(0, s*0.5, s*0.35*thrustLevel, s*0.8*thrustLevel, 0, 0, Math.PI*2);
      ctx.fillStyle = eg;
      ctx.fill();
    }

    ctx.restore();
  }

  /* ── Enemy: fighter ─────────────────────────────────────── */
  function drawFighter(px, py, scale, color, health, maxHealth) {
    const s = 18 * scale;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.PI); // pointing down

    // Body
    ctx.beginPath();
    ctx.moveTo(0, -s*1.4);
    ctx.lineTo(-s*0.4, 0);
    ctx.lineTo(0, s*0.3);
    ctx.lineTo(s*0.4, 0);
    ctx.closePath();
    ctx.fillStyle = 'rgba(40,0,0,0.8)';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Wings
    ctx.beginPath();
    ctx.moveTo(0, -s*0.3);
    ctx.lineTo(-s*1.3, s*0.7);
    ctx.lineTo(-s*0.6, s*0.9);
    ctx.lineTo(-s*0.1, s*0.3);
    ctx.closePath();
    ctx.fillStyle = 'rgba(60,0,0,0.6)';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.8;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, -s*0.3);
    ctx.lineTo(s*1.3, s*0.7);
    ctx.lineTo(s*0.6, s*0.9);
    ctx.lineTo(s*0.1, s*0.3);
    ctx.closePath();
    ctx.fillStyle = 'rgba(60,0,0,0.6)';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.8;
    ctx.stroke();

    drawHealthBar(0, -s*1.7, s*2, health, maxHealth);
    ctx.restore();
  }

  /* ── Enemy: bomber ──────────────────────────────────────── */
  function drawBomber(px, py, scale, color, health, maxHealth) {
    const s = 22 * scale;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.PI);

    // Bulky body
    ctx.beginPath();
    ctx.ellipse(0, 0, s*0.7, s*1.2, 0, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(20,10,0,0.9)';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Broad wings
    ctx.beginPath();
    ctx.moveTo(-s*0.5, -s*0.3);
    ctx.lineTo(-s*2.0, s*0.4);
    ctx.lineTo(-s*1.6, s*0.8);
    ctx.lineTo(-s*0.3, s*0.2);
    ctx.closePath();
    ctx.fillStyle = 'rgba(40,20,0,0.7)';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(s*0.5, -s*0.3);
    ctx.lineTo(s*2.0, s*0.4);
    ctx.lineTo(s*1.6, s*0.8);
    ctx.lineTo(s*0.3, s*0.2);
    ctx.closePath();
    ctx.fillStyle = 'rgba(40,20,0,0.7)';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Glow core
    const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, s*0.5);
    cg.addColorStop(0, `${color}99`);
    cg.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.arc(0, 0, s*0.5, 0, Math.PI*2);
    ctx.fillStyle = cg;
    ctx.fill();

    drawHealthBar(0, -s*1.5, s*2.5, health, maxHealth);
    ctx.restore();
  }

  /* ── Enemy: scout ───────────────────────────────────────── */
  function drawScout(px, py, scale, color, health, maxHealth) {
    const s = 12 * scale;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.PI);

    ctx.beginPath();
    ctx.moveTo(0, -s*1.6);
    ctx.lineTo(-s*0.6, s*0.5);
    ctx.lineTo(0, s*1.0);
    ctx.lineTo(s*0.6, s*0.5);
    ctx.closePath();
    ctx.fillStyle = 'rgba(30,30,0,0.8)';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    drawHealthBar(0, -s*2, s*1.6, health, maxHealth);
    ctx.restore();
  }

  /* ── Enemy: capital ship ────────────────────────────────── */
  function drawCapital(px, py, scale, color, health, maxHealth, time) {
    const s = 30 * scale;
    ctx.save();
    ctx.translate(px, py);

    // Main hull
    ctx.beginPath();
    ctx.moveTo(0, -s*2.5);
    ctx.lineTo(-s*1.2, -s*0.8);
    ctx.lineTo(-s*1.8, s*1.5);
    ctx.lineTo(-s*0.5, s*2.0);
    ctx.lineTo(s*0.5, s*2.0);
    ctx.lineTo(s*1.8, s*1.5);
    ctx.lineTo(s*1.2, -s*0.8);
    ctx.closePath();
    ctx.fillStyle = 'rgba(10,0,20,0.95)';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner detail lines
    ctx.strokeStyle = `${color}44`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -s*2.0);
    ctx.lineTo(0, s*1.8);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-s*1.0, 0);
    ctx.lineTo(s*1.0, 0);
    ctx.stroke();

    // Engine nodes - pulsing
    const pulse = (Math.sin(time * 4) + 1) * 0.5;
    const engineY = s*1.8;
    for (let ex of [-s*0.7, 0, s*0.7]) {
      const eg = ctx.createRadialGradient(ex, engineY, 0, ex, engineY, s*0.35);
      eg.addColorStop(0, `rgba(0,200,255,${0.6 + 0.4*pulse})`);
      eg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(ex, engineY, s*0.35, 0, Math.PI*2);
      ctx.fillStyle = eg;
      ctx.fill();
    }

    // Weapon hard-points
    for (let wp of [-s*1.4, s*1.4]) {
      ctx.beginPath();
      ctx.arc(wp, 0, s*0.18, 0, Math.PI*2);
      ctx.fillStyle = `${color}88`;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.fill();
      ctx.stroke();
    }

    // Boss aura
    const aura = ctx.createRadialGradient(0, 0, s*1, 0, 0, s*3.5);
    aura.addColorStop(0, `${color}18`);
    aura.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.arc(0, 0, s*3.5, 0, Math.PI*2);
    ctx.fillStyle = aura;
    ctx.fill();

    drawHealthBar(0, -s*3.0, s*4, health, maxHealth);
    ctx.restore();
  }

  /* ── Health bar ─────────────────────────────────────────── */
  function drawHealthBar(x, y, width, hp, maxHp) {
    const ratio = Math.max(0, hp / maxHp);
    const w2 = width;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x - w2/2, y - 3, w2, 5);
    const color = ratio > 0.5 ? '#00ff88' : ratio > 0.25 ? '#ffb800' : '#ff2d78';
    ctx.fillStyle = color;
    ctx.fillRect(x - w2/2, y - 3, w2 * ratio, 5);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x - w2/2, y - 3, w2, 5);
  }

  /* ── Projectile ─────────────────────────────────────────── */
  function drawProjectile(x, y, angle, length, color, glowColor) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    const grad = ctx.createLinearGradient(0, -length, 0, length * 0.3);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.3, color);
    grad.addColorStop(0.7, glowColor || color);
    grad.addColorStop(1, 'rgba(255,255,255,0.9)');

    ctx.beginPath();
    ctx.moveTo(-1.5, -length);
    ctx.lineTo(-1.5, length * 0.3);
    ctx.lineTo(0,     length * 0.5);
    ctx.lineTo(1.5,  length * 0.3);
    ctx.lineTo(1.5,  -length);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Glow
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 8);
    glow.addColorStop(0, `${glowColor || color}cc`);
    glow.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI*2);
    ctx.fillStyle = glow;
    ctx.fill();

    ctx.restore();
  }

  /* ── Missile ────────────────────────────────────────────── */
  function drawMissile(x, y, angle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(-3, 2);
    ctx.lineTo(0, 0);
    ctx.lineTo(3, 2);
    ctx.closePath();
    ctx.fillStyle = '#ff6600';
    ctx.strokeStyle = '#ffaa00';
    ctx.lineWidth = 1;
    ctx.fill();
    ctx.stroke();

    // Exhaust
    const eg = ctx.createRadialGradient(0, 4, 0, 0, 8, 6);
    eg.addColorStop(0, 'rgba(255,150,0,0.9)');
    eg.addColorStop(1, 'rgba(255,100,0,0)');
    ctx.beginPath();
    ctx.arc(0, 5, 6, 0, Math.PI*2);
    ctx.fillStyle = eg;
    ctx.fill();

    ctx.restore();
  }

  /* ── Explosion ──────────────────────────────────────────── */
  function drawExplosion(x, y, progress, maxRadius, color) {
    // progress: 0→1
    const r  = maxRadius * progress;
    const op = 1 - progress;

    // Core flash
    const cg = ctx.createRadialGradient(x, y, 0, x, y, r * 0.4);
    cg.addColorStop(0, `rgba(255,255,255,${op})`);
    cg.addColorStop(1, `rgba(255,200,100,0)`);
    ctx.beginPath();
    ctx.arc(x, y, r * 0.4, 0, Math.PI*2);
    ctx.fillStyle = cg;
    ctx.fill();

    // Outer ring
    const og = ctx.createRadialGradient(x, y, r * 0.6, x, y, r);
    og.addColorStop(0, `${color}${Math.floor(op*200).toString(16).padStart(2,'0')}`);
    og.addColorStop(1, `${color}00`);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI*2);
    ctx.fillStyle = og;
    ctx.fill();

    // Shockwave ring
    if (progress < 0.6) {
      const rOp = (1 - progress / 0.6) * 0.8;
      ctx.beginPath();
      ctx.arc(x, y, r * 1.3, 0, Math.PI*2);
      ctx.strokeStyle = `rgba(255,180,80,${rOp})`;
      ctx.lineWidth = 3 * (1 - progress);
      ctx.stroke();
    }
  }

  /* ── Particle ───────────────────────────────────────────── */
  function drawParticle(x, y, size, color, opacity) {
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI*2);
    ctx.fillStyle = color.replace(')', `,${opacity})`).replace('rgb', 'rgba');
    ctx.fill();
  }

  /* ── Powerup ────────────────────────────────────────────── */
  function drawPowerup(x, y, color, symbol, pulse) {
    const r = 14 + 3 * pulse;
    // Outer ring
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI*2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `${color}44`);
    g.addColorStop(1, `${color}00`);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI*2);
    ctx.fillStyle = g;
    ctx.fill();

    // Icon
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(symbol, x, y);
  }

  /* ── Background nebula ──────────────────────────────────── */
  function drawNebula(x, y, rx, ry, colorA, colorB, opacity) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
    g.addColorStop(0, colorA.replace(')', `,${opacity})`).replace('rgb', 'rgba'));
    g.addColorStop(0.5, colorB.replace(')', `,${opacity * 0.3})`).replace('rgb', 'rgba'));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.scale(rx / Math.max(rx, ry), ry / Math.max(rx, ry));
    ctx.beginPath();
    ctx.arc(x * Math.max(rx,ry)/rx, y * Math.max(rx,ry)/ry, Math.max(rx,ry), 0, Math.PI*2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
  }

  /* ── Grid (cockpit-style floor) ─────────────────────────── */
  function drawGrid(offsetY, speed) {
    ctx.save();
    ctx.strokeStyle = 'rgba(0,100,150,0.15)';
    ctx.lineWidth = 0.5;
    const gridSize = 60;
    const perspective = 400;
    const horizon = H * 0.55;

    for (let x = -10; x <= 10; x++) {
      const x1 = cx + x * gridSize;
      const x2 = cx + (x * gridSize * 4) + ((cx - cx) * 2);
      ctx.beginPath();
      ctx.moveTo(x1, H);
      const px = cx + (x1 - cx) * (1 - perspective/(perspective + H - horizon));
      ctx.lineTo(px, horizon);
      ctx.stroke();
    }

    const lineCount = 12;
    for (let i = 0; i <= lineCount; i++) {
      const t   = i / lineCount;
      const z   = perspective / (1 - t + 0.0001);
      const y2d = horizon + (H - horizon) * t;
      ctx.beginPath();
      ctx.moveTo(0, y2d);
      ctx.lineTo(W, y2d);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ── Public ─────────────────────────────────────────────── */
  return {
    init, resize, clear, project,
    drawStar, drawPoly,
    drawPlayerShip, drawFighter, drawBomber, drawScout, drawCapital,
    drawProjectile, drawMissile, drawExplosion, drawParticle, drawPowerup,
    drawNebula, drawGrid, drawHealthBar,
    get W() { return W; },
    get H() { return H; },
    get cx() { return cx; },
    get cy() { return cy; },
    get ctx() { return ctx; }
  };
})();
