// public/js/bg_animation.js
import {
    setupCanvas,
    LOGICAL_W,
    LOGICAL_H
} from "/canvas.js";
import {
    MAPS
} from "/maps.js";

function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
}

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function makeRng(seed = 123456789) {
    // Tiny deterministic RNG so the background is stable per refresh
    let s = seed >>> 0;
    return () => {
        s ^= s << 13;
        s >>>= 0;
        s ^= s >> 17;
        s >>>= 0;
        s ^= s << 5;
        s >>>= 0;
        return (s >>> 0) / 4294967296;
    };
}

function buildGrid() {
    // Your maps assume 30x18 logical tiles in gameplay; keep that here too
    const gridW = 30,
        gridH = 18,
        tile = 30;

    const m = pick(MAPS);
    const g2d = m.makeGrid(gridW, gridH); // returns [y][x] 0/1

    // Flatten like the game world uses
    const grid = new Uint8Array(gridW * gridH);
    for (let y = 0; y < gridH; y++) {
        for (let x = 0; x < gridW; x++) {
            grid[y * gridW + x] = g2d[y][x] ? 1 : 0;
        }
    }

    return {
        gridW,
        gridH,
        tile,
        grid,
        id: m.id,
        name: m.name
    };
}

function isWall(world, tx, ty) {
    if (tx < 0 || ty < 0 || tx >= world.gridW || ty >= world.gridH) return true;
    return world.grid[ty * world.gridW + tx] === 1;
}

function collideWall(world, x, y, r) {
    // Circle vs tile walls (cheap)
    const minTx = Math.floor((x - r) / world.tile);
    const maxTx = Math.floor((x + r) / world.tile);
    const minTy = Math.floor((y - r) / world.tile);
    const maxTy = Math.floor((y + r) / world.tile);

    for (let ty = minTy; ty <= maxTy; ty++) {
        for (let tx = minTx; tx <= maxTx; tx++) {
            if (!isWall(world, tx, ty)) continue;

            const rx = tx * world.tile;
            const ry = ty * world.tile;

            // Nearest point on tile AABB
            const nx = clamp(x, rx, rx + world.tile);
            const ny = clamp(y, ry, ry + world.tile);

            const dx = x - nx;
            const dy = y - ny;
            const d2 = dx * dx + dy * dy;
            if (d2 <= r * r) return true;
        }
    }
    return false;
}

function spawnOnFloor(world, rng) {
    for (let tries = 0; tries < 2000; tries++) {
        const tx = 1 + Math.floor(rng() * (world.gridW - 2));
        const ty = 1 + Math.floor(rng() * (world.gridH - 2));
        if (isWall(world, tx, ty)) continue;
        return {
            x: (tx + 0.5) * world.tile,
            y: (ty + 0.5) * world.tile,
        };
    }
    return {
        x: world.tile * 2,
        y: world.tile * 2
    };
}

function drawBase(ctx, world) {
    // Slightly “terminal green” but muted so it reads as background
    ctx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);

    ctx.fillStyle = "rgba(10, 14, 18, 1)";
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    // faint grid
    ctx.save();
    ctx.globalAlpha = 0.01;
    ctx.strokeStyle = "rgba(255,255,255,1)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= LOGICAL_W; x += world.tile) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, LOGICAL_H);
        ctx.stroke();
    }
    for (let y = 0; y <= LOGICAL_H; y += world.tile) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(LOGICAL_W, y);
        ctx.stroke();
    }
    ctx.restore();

    // walls
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = "rgba(230, 240, 255, 1)";
    for (let y = 0; y < world.gridH; y++) {
        for (let x = 0; x < world.gridW; x++) {
            if (world.grid[y * world.gridW + x] !== 1) continue;
            const px = x * world.tile;
            const py = y * world.tile;
            ctx.fillRect(px + 2, py + 2, world.tile - 4, world.tile - 4);
        }
    }
    ctx.restore();
}

function drawEntity(ctx, p, isTank = false) {
    ctx.save();
    ctx.translate(p.x, p.y);

    // Tank base (movement direction)
    ctx.save();
    ctx.rotate(p.angle);

    ctx.fillStyle = "#2b3038";
    ctx.beginPath(); ctx.roundRect(-17, -12, 34, 6, 2); ctx.fill();
    ctx.beginPath(); ctx.roundRect(-17, 6, 34, 6, 2); ctx.fill();

    ctx.fillStyle = "#3c424d";
    for (let i = -14; i <= 14; i += 7) {
        ctx.fillRect(i, -11, 5, 4);
        ctx.fillRect(i, 7, 5, 4);
    }

    ctx.beginPath();
    ctx.roundRect(-13, -9, 26, 18, 4);
    ctx.fillStyle = p.col;
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.65)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.roundRect(-5, -5, 10, 10, 4);
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.fill();

    ctx.restore();

    // Turret / head (aim direction)
    ctx.save();
    ctx.rotate(p.aimAngle);

    if (isTank) {
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.fillStyle = p.col;
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.65)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.roundRect(2, -3, 22, 6, 3);
        ctx.fillStyle = p.col;
        ctx.fill();
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(20, -3, 4, 6);
    } else {
        const headR = 10;
        ctx.beginPath();
        ctx.arc(0, 0, headR, 0, Math.PI * 2);
        ctx.fillStyle = "#f0c8a0";
        ctx.fill();

        ctx.fillStyle = "#000";
        ctx.beginPath(); ctx.arc(headR * 0.7, -headR * 0.38, 1.8, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(headR * 0.7, headR * 0.38, 1.8, 0, Math.PI * 2); ctx.fill();

        ctx.beginPath();
        ctx.arc(-headR * 0.72, 0, 5.5, 0, Math.PI * 2);
        ctx.fillStyle = "#1a1a2e";
        ctx.fill();

        ctx.beginPath();
        ctx.roundRect(headR, -2, 18, 4, 2);
        ctx.fillStyle = "#1b2430";
        ctx.fill();
    }

    ctx.restore();
    ctx.restore();
}

function drawBullets(ctx, bullets) {
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    for (const b of bullets) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 2.6, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

// --- CRT curvature warp (Canvas 2D mesh warp) -------------------------------

function makeWarpMesh(cols, rows) {
    // Precompute UV grid once
    const uvs = [];
    for (let j = 0; j <= rows; j++) {
        for (let i = 0; i <= cols; i++) {
            uvs.push({
                u: i / cols,
                v: j / rows
            });
        }
    }
    return {
        cols,
        rows,
        uvs
    };
}

// 2D barrel distortion in UV space (0..1)
function warpUV(u, v, k) {
    // centred coords in [-1,1]
    const x = u * 2 - 1;
    const y = v * 2 - 1;

    // Barrel distortion: r' = r * (1 + k*r^2)
    const r2 = x * x + y * y;
    const f = 1 + k * r2;

    const wx = x * f;
    const wy = y * f;

    // back to UV
    return {
        u: (wx + 1) * 0.5,
        v: (wy + 1) * 0.5
    };
}

function drawWarpedImage(ctx, src, mesh, k, scale = 1.05) {
    const W = LOGICAL_W;
    const H = LOGICAL_H;

    // Destination rect (slight zoom = magnified)
    const dw = W * scale;
    const dh = H * scale;
    const ox = (W - dw) * 0.5;
    const oy = (H - dh) * 0.5;

    const {
        cols,
        rows,
        uvs
    } = mesh;

    // Precompute warped vertex positions for this frame (cheap)
    const pts = new Array(uvs.length);
    for (let idx = 0; idx < uvs.length; idx++) {
        const {
            u,
            v
        } = uvs[idx];
        const wuv = warpUV(u, v, k);

        // clamp so we do not sample outside the source
        const su = Math.max(0, Math.min(1, wuv.u));
        const sv = Math.max(0, Math.min(1, wuv.v));

        pts[idx] = {
            sx: su * src.width,
            sy: sv * src.height,
            dx: ox + u * dw,
            dy: oy + v * dh,
        };
    }

    // Draw each cell as a clipped quad using two triangles
    // We approximate the quad via two clipped triangles using ctx.setTransform + drawImage
    // Method: map a source triangle to a destination triangle with affine transform.
    function drawTri(p0, p1, p2) {
        // Source triangle
        const sx0 = p0.sx,
            sy0 = p0.sy;
        const sx1 = p1.sx,
            sy1 = p1.sy;
        const sx2 = p2.sx,
            sy2 = p2.sy;

        // Destination triangle
        const dx0 = p0.dx,
            dy0 = p0.dy;
        const dx1 = p1.dx,
            dy1 = p1.dy;
        const dx2 = p2.dx,
            dy2 = p2.dy;

        // Solve affine transform from source to destination:
        // [a c e] [sx]   [dx]
        // [b d f] [sy] = [dy]
        // We compute matrix that maps (sx,sy) -> (dx,dy)
        const denom = (sx0 * (sy1 - sy2) + sx1 * (sy2 - sy0) + sx2 * (sy0 - sy1));
        if (Math.abs(denom) < 1e-6) return;

        const a = (dx0 * (sy1 - sy2) + dx1 * (sy2 - sy0) + dx2 * (sy0 - sy1)) / denom;
        const b = (dy0 * (sy1 - sy2) + dy1 * (sy2 - sy0) + dy2 * (sy0 - sy1)) / denom;
        const c = (dx0 * (sx2 - sx1) + dx1 * (sx0 - sx2) + dx2 * (sx1 - sx0)) / denom;
        const d = (dy0 * (sx2 - sx1) + dy1 * (sx0 - sx2) + dy2 * (sx1 - sx0)) / denom;
        const e = (dx0 * (sx1 * sy2 - sx2 * sy1) + dx1 * (sx2 * sy0 - sx0 * sy2) + dx2 * (sx0 * sy1 - sx1 * sy0)) / denom;
        const f = (dy0 * (sx1 * sy2 - sx2 * sy1) + dy1 * (sx2 * sy0 - sx0 * sy2) + dy2 * (sx0 * sy1 - sx1 * sy0)) / denom;

        ctx.save();

        // Clip destination triangle
        ctx.beginPath();
        ctx.moveTo(dx0, dy0);
        ctx.lineTo(dx1, dy1);
        ctx.lineTo(dx2, dy2);
        ctx.closePath();
        ctx.clip();

        // Set transform so drawing the whole source positions the triangle correctly
        ctx.setTransform(a, b, c, d, e, f);
        ctx.drawImage(src, 0, 0);

        ctx.restore();
    }

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);

    for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
            const idx00 = j * (cols + 1) + i;
            const idx10 = idx00 + 1;
            const idx01 = idx00 + (cols + 1);
            const idx11 = idx01 + 1;

            const p00 = pts[idx00];
            const p10 = pts[idx10];
            const p01 = pts[idx01];
            const p11 = pts[idx11];

            // Two triangles: (00,10,11) and (00,11,01)
            drawTri(p00, p10, p11);
            drawTri(p00, p11, p01);
        }
    }

    ctx.restore();
}

function addScanlinesNoiseVignette(ctx, t) {
    // scanlines
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = "rgba(0,0,0,1)";
    for (let y = 0; y < LOGICAL_H; y += 3) ctx.fillRect(0, y, LOGICAL_W, 1);
    ctx.restore();

    // tiny vertical jitter occasionally (not wavy)
    if ((t | 0) % 5000 < 50) {
        ctx.save();
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 0.12;
        const j = (Math.random() - 0.5) * 4;
        ctx.drawImage(ctx.canvas, 0, j);
        ctx.restore();
    }

    // light noise streaks
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = "rgba(255,255,255,1)";
    for (let i = 0; i < 80; i++) {
        const x = Math.random() * LOGICAL_W;
        const y = Math.random() * LOGICAL_H;
        const w = 30 + Math.random() * 90;
        const h = 1 + Math.random() * 2;
        ctx.fillRect(x, y, w, h);
    }
    ctx.restore();

    // vignette
    ctx.save();
    const g = ctx.createRadialGradient(
        LOGICAL_W * 0.5, LOGICAL_H * 0.45, 90,
        LOGICAL_W * 0.5, LOGICAL_H * 0.5, 560
    );
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.58)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    ctx.restore();
}

function addChromaticAberration(ctx, buffer, amount = 1.25) {
    const tmp = document.createElement("canvas");
    tmp.width = LOGICAL_W;
    tmp.height = LOGICAL_H;
    const tctx = tmp.getContext("2d");

    // Copy current warped frame
    tctx.drawImage(buffer, 0, 0);

    ctx.save();
    ctx.globalCompositeOperation = "screen";

    ctx.globalAlpha = 0.06;
    ctx.drawImage(tmp, amount, 0);

    ctx.globalAlpha = 0.045;
    ctx.drawImage(tmp, -amount, 0);

    ctx.restore();
}
// Cache the mesh and off-screen warp buffer so we do not rebuild each frame
let __CRT_MESH = null;
let __WARP_BUF = null;

function applyCrt(ctx, srcCanvas, t) {
    if (!__CRT_MESH) __CRT_MESH = makeWarpMesh(34, 20);
    if (!__WARP_BUF) {
        __WARP_BUF = document.createElement("canvas");
        __WARP_BUF.width = LOGICAL_W;
        __WARP_BUF.height = LOGICAL_H;
    }

    const k = 0.10 + 0.01 * Math.sin(t * 0.00035);

    // Render CRT warp into off-screen buffer (identity space, 900x540)
    drawWarpedImage(__WARP_BUF.getContext("2d"), srcCanvas, __CRT_MESH, k, 1.08);

    // Scale the warped buffer onto the full-screen canvas via the scale transform
    ctx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);
    ctx.drawImage(__WARP_BUF, 0, 0);

    // Apply CA using the off-screen buffer as source
    addChromaticAberration(ctx, __WARP_BUF, 1.15);

    addScanlinesNoiseVignette(ctx, t);
}

export function startLoginBgFx() {
    const canvas = document.getElementById("bgFx");
    if (!canvas) return;

    const {
        ctx
    } = setupCanvas(canvas);

    const seed = (Date.now() ^ (canvas.width + canvas.height)) >>> 0;
    const rng = makeRng(seed);

    const world = buildGrid();
    world.worldW = world.gridW * world.tile;
    world.worldH = world.gridH * world.tile;

    const players = [];
    const bullets = [];

    const cols = [
        "rgba(0,255,136,0.55)",
        "rgba(255,0,97,0.45)",
        "rgba(255,191,63,0.45)",
        "rgba(255,255,255,0.35)",
    ];

    for (let i = 0; i < 4; i++) {
        const s = spawnOnFloor(world, rng);
        players.push({
            x: s.x,
            y: s.y,
            angle: rng() * Math.PI * 2,
            aimAngle: rng() * Math.PI * 2,
            targetAngle: rng() * Math.PI * 2,
            targetAim: rng() * Math.PI * 2,
            col: cols[i % cols.length],
            isTank: i % 2 === 1,
            nextTurnAt: 0,
            nextShotAt: 300 + rng() * 1200,
        });
    }

    // Low-res “game buffer” that we then magnify + distort
    const base = document.createElement("canvas");
    base.width = LOGICAL_W;
    base.height = LOGICAL_H;
    const bctx = base.getContext("2d");

    let last = performance.now();

    function step(now) {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;

        // Sometimes switch map to keep it lively
        if (rng() < 0.0025) {
            const next = buildGrid();
            world.grid = next.grid;
            world.gridW = next.gridW;
            world.gridH = next.gridH;
            world.tile = next.tile;
            world.worldW = world.gridW * world.tile;
            world.worldH = world.gridH * world.tile;
        }

        // Sim update
        for (const p of players) {
            // pick new headings occasionally
            if (now > p.nextTurnAt) {
                p.targetAngle = rng() * Math.PI * 2;
                p.targetAim = rng() * Math.PI * 2;
                p.nextTurnAt = now + 600 + rng() * 1400;
            }

            // smooth turn towards target
            const turnRate = 3.8;
            const da = Math.atan2(Math.sin(p.targetAngle - p.angle), Math.cos(p.targetAngle - p.angle));
            p.angle += da * clamp(turnRate * dt, 0, 1);

            const daa = Math.atan2(Math.sin(p.targetAim - p.aimAngle), Math.cos(p.targetAim - p.aimAngle));
            p.aimAngle += daa * clamp(5.0 * dt, 0, 1);

            // move forward
            const speed = 120;
            const nx = p.x + Math.cos(p.angle) * speed * dt;
            const ny = p.y + Math.sin(p.angle) * speed * dt;

            if (!collideWall(world, nx, ny, p.isTank ? 13 : 11)) {
                p.x = nx;
                p.y = ny;
            } else {
                // bounce: pick a new direction
                p.targetAngle = rng() * Math.PI * 2;
            }

            // shoot occasionally
            if (now > p.nextShotAt && rng() < 0.8) {
                bullets.push({
                    x: p.x + Math.cos(p.aimAngle) * 18,
                    y: p.y + Math.sin(p.aimAngle) * 18,
                    vx: Math.cos(p.aimAngle) * 340,
                    vy: Math.sin(p.aimAngle) * 340,
                    life: 0.9 + rng() * 0.6,
                });
                p.nextShotAt = now + 260 + rng() * 900;
            }
        }

        // bullets
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            b.life -= dt;
            b.x += b.vx * dt;
            b.y += b.vy * dt;

            // wall hit
            const tx = Math.floor(b.x / world.tile);
            const ty = Math.floor(b.y / world.tile);
            if (b.life <= 0 || isWall(world, tx, ty)) bullets.splice(i, 1);
        }

        // Draw into base buffer
        drawBase(bctx, world);
        drawBullets(bctx, bullets);

        for (const p of players) drawEntity(bctx, p, p.isTank);

        // Apply CRT effect onto visible canvas
        applyCrt(ctx, base, now);

        requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
}

startLoginBgFx();