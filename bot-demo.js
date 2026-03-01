// bot-demo.js — Interactive bot-behaviour demos for docs.html
// All simulation runs in logical space: 900 × 540 (world units).
// The canvas is scaled to fill its container via CSS aspect-ratio + ResizeObserver.

const LW = 900, LH = 540;
const TURN_SPEED = 5.5;  // rad/s at |turn| = 1
const MOVE_SPEED = 220;  // px/s at throttle = 1
const MARGIN     = 28;   // world units kept from edges

// ── Maths ─────────────────────────────────────────────────────────────────────

function normAngle(a) {
  while (a >  Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function dist(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// ── Canvas setup ──────────────────────────────────────────────────────────────

function setupDemoCanvas(canvas) {
  const ctx = canvas.getContext('2d');

  function fit() {
    const dpr  = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1) return;
    canvas.width  = Math.round(rect.width  * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(canvas.width / LW, 0, 0, canvas.height / LH, 0, 0);
  }

  new ResizeObserver(fit).observe(canvas);
  fit();
  return ctx;
}

// ── Drawing primitives ────────────────────────────────────────────────────────

function clearBg(ctx) {
  ctx.fillStyle = '#0d0d0d';
  ctx.fillRect(0, 0, LW, LH);

  // dot grid
  ctx.fillStyle = '#1c1c1c';
  for (let x = 45; x < LW; x += 45)
    for (let y = 45; y < LH; y += 45) {
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

  // border
  ctx.strokeStyle = '#2a2a2a';
  ctx.lineWidth   = 2;
  ctx.strokeRect(1, 1, LW - 2, LH - 2);
}

function drawBot(ctx, bot, color, label) {
  ctx.save();
  ctx.translate(bot.x, bot.y);
  ctx.rotate(bot.angle);

  ctx.shadowColor = color;
  ctx.shadowBlur  = 12;

  // body
  ctx.fillStyle   = '#0d0d0d';
  ctx.strokeStyle = color;
  ctx.lineWidth   = 1.5;
  ctx.fillRect(-15, -11, 30, 22);
  ctx.strokeRect(-15, -11, 30, 22);

  // barrel
  ctx.fillStyle = color;
  ctx.fillRect(10, -3, 16, 6);

  // center pip
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
  ctx.shadowBlur = 0;

  if (label) {
    ctx.font      = '15px "Share Tech Mono"';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.fillText(label, bot.x, bot.y - 22);
  }
}

function drawRing(ctx, x, y, r, color, dashed = false) {
  ctx.save();
  if (dashed) ctx.setLineDash([6, 8]);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth   = 1.5;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawDash(ctx, x1, y1, x2, y2, color) {
  ctx.save();
  ctx.setLineDash([5, 7]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth   = 1.5;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function hud(ctx, x, y, text, color) {
  ctx.font      = '16px "Share Tech Mono"';
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.fillText(text, x, y);
}

// ── Physics ───────────────────────────────────────────────────────────────────

function step(bot, turn, throttle, dt) {
  bot.angle += turn * TURN_SPEED * dt;
  bot.x = clamp(bot.x + Math.cos(bot.angle) * throttle * MOVE_SPEED * dt, MARGIN, LW - MARGIN);
  bot.y = clamp(bot.y + Math.sin(bot.angle) * throttle * MOVE_SPEED * dt, MARGIN, LH - MARGIN);
}

function spawnBullet(bot, bullets) {
  bullets.push({
    x:  bot.x + Math.cos(bot.angle) * 26,
    y:  bot.y + Math.sin(bot.angle) * 26,
    vx: Math.cos(bot.angle) * 540,
    vy: Math.sin(bot.angle) * 540,
    age: 0,
  });
}

function updateBullets(bullets, dt) {
  for (const b of bullets) { b.x += b.vx * dt; b.y += b.vy * dt; b.age += dt; }
  bullets.splice(0, bullets.length,
    ...bullets.filter(b => b.age < 0.8 && b.x > 0 && b.x < LW && b.y > 0 && b.y < LH));
}

function renderBullets(ctx, bullets) {
  for (const b of bullets) {
    const a = 1 - b.age / 0.8;
    ctx.fillStyle   = `rgba(255,255,100,${a})`;
    ctx.shadowColor = '#ffff00';
    ctx.shadowBlur  = 8;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO 1 — Movement Playground
// Return-value section. Single bot, turn + throttle sliders, hold-to-shoot.
// ─────────────────────────────────────────────────────────────────────────────

export function initMovementDemo(root) {
  const canvas = root.querySelector('canvas');
  const ctx    = setupDemoCanvas(canvas);

  const turnInput     = root.querySelector('[data-ctrl="turn"]');
  const throttleInput = root.querySelector('[data-ctrl="throttle"]');
  const shootBtn      = root.querySelector('[data-ctrl="shoot"]');
  const turnDisp      = root.querySelector('[data-val="turn"]');
  const throttleDisp  = root.querySelector('[data-val="throttle"]');

  const bot     = { x: LW / 2, y: LH / 2, angle: 0 };
  const bullets = [];
  const trail   = [];
  let shooting  = false;
  let lastShot  = 0;
  let prev      = null;

  const setShoot = v => shooting = v;
  shootBtn?.addEventListener('mousedown',  () => setShoot(true));
  shootBtn?.addEventListener('touchstart', () => setShoot(true),  { passive: true });
  shootBtn?.addEventListener('mouseup',    () => setShoot(false));
  shootBtn?.addEventListener('touchend',   () => setShoot(false));
  document.addEventListener('mouseup',     () => setShoot(false));

  function frame(t) {
    const dt = prev ? Math.min((t - prev) / 1000, 0.05) : 0;
    prev = t;

    const turn     = parseFloat(turnInput?.value     ?? 0);
    const throttle = parseFloat(throttleInput?.value ?? 0);

    if (turnDisp)     turnDisp.textContent     = (turn >= 0 ? '+' : '') + turn.toFixed(2);
    if (throttleDisp) throttleDisp.textContent = throttle.toFixed(2);

    step(bot, turn, throttle, dt);

    if (shooting && t - lastShot > 280) { spawnBullet(bot, bullets); lastShot = t; }
    updateBullets(bullets, dt);

    if (throttle > 0.01) { trail.push({ x: bot.x, y: bot.y }); if (trail.length > 80) trail.shift(); }

    // ── Render ──────────────────────────────────────────────────────────────
    clearBg(ctx);

    // trail
    for (let i = 1; i < trail.length; i++) {
      const a = (i / trail.length) * 0.3;
      ctx.strokeStyle = `rgba(0,255,136,${a})`;
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
      ctx.lineTo(trail[i].x, trail[i].y);
      ctx.stroke();
    }

    renderBullets(ctx, bullets);

    // heading ray
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.setLineDash([4, 5]);
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(bot.x, bot.y);
    ctx.lineTo(bot.x + Math.cos(bot.angle) * 55, bot.y + Math.sin(bot.angle) * 55);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    drawBot(ctx, bot, '#00ff88', null);

    // HUD
    hud(ctx, 12, 26, `turn      ${(turn >= 0 ? '+' : '')}${turn.toFixed(2)}`, '#00ff88');
    hud(ctx, 12, 50, `throttle  ${throttle.toFixed(2)}`, '#00ff88');
    hud(ctx, 12, 74, `shoot     ${shooting}`, shooting ? '#ffff00' : '#444');

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO 2 — Follow Leader
// `me` parameter section. Leader patrols a figure-8; companion follows.
// Sliders: minDist (stop-following threshold), turnMult (turning aggressiveness).
// ─────────────────────────────────────────────────────────────────────────────

export function initFollowDemo(root) {
  const canvas = root.querySelector('canvas');
  const ctx    = setupDemoCanvas(canvas);

  const minDistInput  = root.querySelector('[data-ctrl="minDist"]');
  const turnMultInput = root.querySelector('[data-ctrl="turnMult"]');
  const minDistDisp   = root.querySelector('[data-val="minDist"]');
  const turnMultDisp  = root.querySelector('[data-val="turnMult"]');

  const leader    = { x: LW * 0.35, y: LH * 0.5, angle: 0 };
  const companion = { x: LW * 0.55, y: LH * 0.5, angle: Math.PI };
  let prev = null, t0 = null;

  function frame(t) {
    if (!t0) t0 = t;
    const dt      = prev ? Math.min((t - prev) / 1000, 0.05) : 0;
    prev = t;
    const elapsed = (t - t0) / 1000;

    const minDist  = parseFloat(minDistInput?.value  ?? 80);
    const turnMult = parseFloat(turnMultInput?.value ?? 1.5);

    if (minDistDisp)  minDistDisp.textContent  = Math.round(minDist);
    if (turnMultDisp) turnMultDisp.textContent = turnMult.toFixed(1);

    // Leader: lemniscate (figure-8) path
    const r = 200;
    const s = elapsed * 0.45;
    const d = 1 + Math.sin(s) ** 2;
    const nx = LW / 2 + r * Math.cos(s) / d;
    const ny = LH / 2 + r * Math.sin(s) * Math.cos(s) / d;
    leader.angle = Math.atan2(ny - leader.y, nx - leader.x);
    leader.x = clamp(nx, MARGIN + 10, LW - MARGIN - 10);
    leader.y = clamp(ny, MARGIN + 10, LH - MARGIN - 10);

    // Companion follow logic (exact from docs)
    const dx = leader.x - companion.x;
    const dy = leader.y - companion.y;
    const dd = Math.sqrt(dx * dx + dy * dy);

    let compTurn = 0, compThrottle = 0;
    if (dd > minDist) {
      const targetAngle = Math.atan2(dy, dx);
      const delta       = normAngle(targetAngle - companion.angle);
      compTurn          = clamp(delta * turnMult, -1, 1);
      compThrottle      = clamp(dd / 200, 0.3, 1);
    }
    step(companion, compTurn, compThrottle, dt);

    const isFollowing = dd > minDist;

    // ── Render ──────────────────────────────────────────────────────────────
    clearBg(ctx);

    // minDist ring fill
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.fillStyle   = '#4488ff';
    ctx.beginPath();
    ctx.arc(companion.x, companion.y, minDist, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    drawRing(ctx, companion.x, companion.y, minDist, '#4488ff44', true);

    // follow line
    if (isFollowing) drawDash(ctx, companion.x, companion.y, leader.x, leader.y, '#ffffff18');

    // distance badge
    const mx = (companion.x + leader.x) / 2;
    const my = (companion.y + leader.y) / 2;
    ctx.font      = '14px "Share Tech Mono"';
    ctx.textAlign = 'center';
    ctx.fillStyle = isFollowing ? '#00ff88' : '#333';
    ctx.fillText(`${Math.round(dd)}px`, mx, my - 6);

    drawBot(ctx, leader,    '#4488ff', 'me');
    drawBot(ctx, companion, '#00ff88', 'companion');

    // HUD
    hud(ctx, 12, 26, `distance  ${Math.round(dd)} px`,    isFollowing ? '#00ff88' : '#9b9b9b');
    hud(ctx, 12, 50, `minDist   ${Math.round(minDist)} px`,  '#4488ff');
    hud(ctx, 12, 74, `status    ${isFollowing ? 'following' : 'holding'}`, isFollowing ? '#00ff88' : '#9b9b9b');

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO 3 — Ranger (Full Example)
// bot-examples section. Full escort ↔ combat logic, three bots, live combat.
// Sliders: CLOSE_RANGE, IDEAL_RANGE, SHOOT_RANGE.
// ─────────────────────────────────────────────────────────────────────────────

export function initRangerDemo(root) {
  const canvas = root.querySelector('canvas');
  const ctx    = setupDemoCanvas(canvas);

  const idealInput = root.querySelector('[data-ctrl="idealRange"]');
  const closeInput = root.querySelector('[data-ctrl="closeRange"]');
  const shootInput = root.querySelector('[data-ctrl="shootRange"]');
  const idealDisp  = root.querySelector('[data-val="idealRange"]');
  const closeDisp  = root.querySelector('[data-val="closeRange"]');
  const shootDisp  = root.querySelector('[data-val="shootRange"]');

  const me        = { x: 180, y: LH * 0.5, angle: 0 };
  const companion = { x: 260, y: LH * 0.5 + 60, angle: 0 };
  const enemy     = { x: 720, y: LH * 0.5, angle: Math.PI };

  const meWps    = [{ x: 150, y: 110 }, { x: 300, y: 200 }, { x: 260, y: 380 }, { x: 130, y: 270 }];
  const enemyWps = [{ x: 720, y: 110 }, { x: 820, y: 270 }, { x: 720, y: 430 }, { x: 580, y: 270 }];
  let mWpIdx = 0, eWpIdx = 0;

  const bullets = [];
  let lastShot = 0, prev = null;

  function patrol(bot, wp, speed, dt) {
    const dx = wp.x - bot.x, dy = wp.y - bot.y;
    const d  = Math.sqrt(dx * dx + dy * dy);
    bot.angle = Math.atan2(dy, dx);
    bot.x    += Math.cos(bot.angle) * speed * dt;
    bot.y    += Math.sin(bot.angle) * speed * dt;
    return d;
  }

  function frame(t) {
    const dt = prev ? Math.min((t - prev) / 1000, 0.05) : 0;
    prev = t;

    const IDEAL_RANGE = parseFloat(idealInput?.value ?? 190);
    const CLOSE_RANGE = parseFloat(closeInput?.value ?? 110);
    const SHOOT_RANGE = parseFloat(shootInput?.value ?? 260);

    if (idealDisp) idealDisp.textContent = Math.round(IDEAL_RANGE);
    if (closeDisp) closeDisp.textContent = Math.round(CLOSE_RANGE);
    if (shootDisp) shootDisp.textContent = Math.round(SHOOT_RANGE);

    // Patrol me and enemy
    if (patrol(me,    meWps[mWpIdx],    80,  dt) < 20) mWpIdx = (mWpIdx + 1) % meWps.length;
    if (patrol(enemy, enemyWps[eWpIdx], 110, dt) < 20) eWpIdx = (eWpIdx + 1) % enemyWps.length;

    // ── Ranger logic (matches docs code) ────────────────────────────────────
    const targetDist = dist(companion, enemy);
    const canSee     = targetDist < 320; // simplified: no walls

    let mode = 'ESCORT', compTurn = 0, compThrottle = 0, willShoot = false;

    if (canSee) {
      mode = 'COMBAT';
      const toTarget = Math.atan2(enemy.y - companion.y, enemy.x - companion.x);
      const delta    = normAngle(toTarget - companion.angle);
      compTurn = clamp(delta * 1.6, -1, 1);

      if      (targetDist < CLOSE_RANGE)  compThrottle = -0.6;
      else if (targetDist > IDEAL_RANGE)  compThrottle =  0.7;
      else                                 compThrottle =  0.1;

      willShoot = targetDist < SHOOT_RANGE;
    } else {
      const leaderDist = dist(companion, me);
      if (leaderDist > 80) {
        const toLeader = Math.atan2(me.y - companion.y, me.x - companion.x);
        const delta    = normAngle(toLeader - companion.angle);
        compTurn     = clamp(delta * 1.5, -1, 1);
        compThrottle = clamp(leaderDist / 180, 0.3, 0.9);
      }
    }

    step(companion, compTurn, compThrottle, dt);

    if (willShoot && t - lastShot > 280) { spawnBullet(companion, bullets); lastShot = t; }
    updateBullets(bullets, dt);

    // ── Render ──────────────────────────────────────────────────────────────
    clearBg(ctx);

    // Range zone fills
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.fillStyle   = '#ff4444';
    ctx.beginPath(); ctx.arc(companion.x, companion.y, CLOSE_RANGE, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle   = '#00ff88';
    ctx.beginPath(); ctx.arc(companion.x, companion.y, IDEAL_RANGE, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // Range outlines
    drawRing(ctx, companion.x, companion.y, CLOSE_RANGE, '#ff444466', true);
    drawRing(ctx, companion.x, companion.y, IDEAL_RANGE, '#00ff8866', true);
    drawRing(ctx, companion.x, companion.y, SHOOT_RANGE, '#ffff0055', true);

    // Aim line when shooting
    if (mode === 'COMBAT' && willShoot) {
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth   = 1;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(companion.x, companion.y);
      ctx.lineTo(enemy.x, enemy.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    renderBullets(ctx, bullets);

    drawBot(ctx, me,        '#4488ff', 'me');
    drawBot(ctx, companion, '#00ff88', 'companion');
    drawBot(ctx, enemy,     '#ff4444', 'enemy');

    // Legend (top-left)
    hud(ctx, 12, 26, '── close range', '#ff4444');
    hud(ctx, 12, 48, '── ideal range', '#00ff88');
    hud(ctx, 12, 70, '── shoot range', '#ffff00');

    // Mode badge (top-right)
    const modeColor = mode === 'COMBAT' ? '#ff4444' : '#4488ff';
    ctx.fillStyle   = modeColor + '18';
    ctx.strokeStyle = modeColor;
    ctx.lineWidth   = 1;
    ctx.fillRect(LW - 175, 10, 160, 34);
    ctx.strokeRect(LW - 175, 10, 160, 34);
    ctx.font      = '20px "Barlow Condensed"';
    ctx.textAlign = 'center';
    ctx.fillStyle = modeColor;
    ctx.fillText(mode, LW - 95, 33);

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
