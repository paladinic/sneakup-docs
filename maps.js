// public/js/game/maps.js - shared map definitions (ES module)
// Map string format: "1" = wall, "." or "_" = floor (each row must be GRID_W chars)
function mapFromStrings(rows) {
  const h = rows.length;
  const w = rows[0].length;
  const g = Array.from({ length: h }, () => Array(w).fill(1));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (rows[y][x] === "." || rows[y][x] === "_") g[y][x] = 0;
  return g;
}

function makeArena(w, h) {
  const g = Array.from({ length: h }, () => Array.from({ length: w }, () => 0));

  for (let x = 0; x < w; x++) { g[0][x] = 1; g[h - 1][x] = 1; }
  for (let y = 0; y < h; y++) { g[y][0] = 1; g[y][w - 1] = 1; }

  for (let x = 3; x < w - 3; x++) g[4][x] = 1;
  for (let x = 3; x < w - 3; x++) g[12][x] = 1;

  for (let y = 2; y < h - 2; y++) g[y][9] = 1;
  for (let y = 2; y < h - 2; y++) g[y][20] = 1;

  g[4][6] = 0; g[4][15] = 0; g[4][24] = 0;
  g[12][6] = 0; g[12][15] = 0; g[12][24] = 0;
  g[7][9] = 0; g[9][20] = 0;

  return g;
}

function makePillars(w, h) {
  const g = Array.from({ length: h }, () => Array.from({ length: w }, () => 0));

  for (let x = 0; x < w; x++) { g[0][x] = 1; g[h - 1][x] = 1; }
  for (let y = 0; y < h; y++) { g[y][0] = 1; g[y][w - 1] = 1; }

  // Four wall blocks providing corner cover
  for (let y = 3; y <= 6; y++) for (let x = 6; x <= 8; x++) g[y][x] = 1;
  for (let y = 3; y <= 6; y++) for (let x = 21; x <= 23; x++) g[y][x] = 1;
  for (let y = 11; y <= 14; y++) for (let x = 6; x <= 8; x++) g[y][x] = 1;
  for (let y = 11; y <= 14; y++) for (let x = 21; x <= 23; x++) g[y][x] = 1;

  // Centre cross - horizontal bar
  for (let x = 11; x <= 18; x++) g[8][x] = 1;
  // Centre cross - vertical bar
  for (let y = 5; y <= 12; y++) g[y][14] = 1;
  // Centre intersection open
  g[8][14] = 0;

  return g;
}

function makeRing(w, h) {
  const g = Array.from({ length: h }, () => Array.from({ length: w }, () => 0));

  // Border walls
  for (let x = 0; x < w; x++) { g[0][x] = 1; g[h - 1][x] = 1; }
  for (let y = 0; y < h; y++) { g[y][0] = 1; g[y][w - 1] = 1; }

  // Inner ring bounds (kept away from edges)
  const left = 5;
  const right = w - 6;
  const top = 3;
  const bottom = h - 4;

  // Draw ring: top and bottom edges
  for (let x = left; x <= right; x++) {
    g[top][x] = 1;
    g[top + 1][x] = 1;      // thickness
    g[bottom][x] = 1;
    g[bottom - 1][x] = 1;   // thickness
  }

  // Draw ring: left and right edges
  for (let y = top; y <= bottom; y++) {
    g[y][left] = 1;
    g[y][left + 1] = 1;     // thickness
    g[y][right] = 1;
    g[y][right - 1] = 1;    // thickness
  }

  // Four entrances into the ring (carve gaps through thickness)
  const midX = Math.floor(w / 2);
  const midY = Math.floor(h / 2);

  // North entrance
  g[top][midX] = 0; g[top + 1][midX] = 0;
  g[top][midX - 1] = 0; g[top + 1][midX - 1] = 0;

  // South entrance
  g[bottom][midX] = 0; g[bottom - 1][midX] = 0;
  g[bottom][midX + 1] = 0; g[bottom - 1][midX + 1] = 0;

  // West entrance
  g[midY][left] = 0; g[midY][left + 1] = 0;
  g[midY - 1][left] = 0; g[midY - 1][left + 1] = 0;

  // East entrance
  g[midY][right] = 0; g[midY][right - 1] = 0;
  g[midY + 1][right] = 0; g[midY + 1][right - 1] = 0;

  // Interior pillars for cover (small vertical blocks)
  for (let y = midY - 3; y <= midY + 3; y++) {
    g[y][midX - 5] = 1;
    g[y][midX + 5] = 1;
  }

  // Ensure centre is open
  g[midY][midX] = 0;

  return g;
}

function makeCorridors() {
  // Three 2-tile-tall horizontal lanes connected by three 2-tile-wide vertical shafts.
  // Cover bumps alternate rows (never blocking both rows) so all corridors stay connected.
  // V shafts at x=5..6, x=14..15, x=23..24  (always open in every row they traverse)
  // P1 spawn tile (2,2) - in H1, left of V1 ✓
  // P2 spawn tile (28,16) - in H3, right of V3 ✓
  return mapFromStrings([
    "111111111111111111111111111111", // y= 0  border
    "111111111111111111111111111111", // y= 1  wall
    "1.........1..................1", // y= 2  H1  ← P1 spawn
    "1...................1........1", // y= 3  H1
    "11111..1111111..1111111..11111", // y= 4  V shafts through wall
    "11111..1111111..1111111..11111", // y= 5
    "11111..1111111..1111111..11111", // y= 6
    "11111..1111111..1111111..11111", // y= 7
    "1.........1..................1", // y= 8  H2
    "1...................1........1", // y= 9  H2
    "11111..1111111..1111111..11111", // y=10  V shafts through wall
    "11111..1111111..1111111..11111", // y=11
    "11111..1111111..1111111..11111", // y=12
    "11111..1111111..1111111..11111", // y=13
    "11111..1111111..1111111..11111", // y=14
    "1.........1..................1", // y=15  H3
    "1...................1........1", // y=16  H3  ← P2 spawn
    "111111111111111111111111111111", // y=17  border
  ]);
}

export const MAPS = [
  {
    id: "arena",
    name: "Arena",
    description: "Two-lane arena with cross-dividers",
    makeGrid: makeArena,
  },
  {
    id: "pillars",
    name: "Pillars",
    description: "Open field with wall blocks and a centre cross",
    makeGrid: makePillars,
  },
  {
    id: "ring",
    name: "Ring",
    description: "Thick inner ring with four entrances and mid-cover pillars",
    makeGrid: makeRing,
  },
  {
    id: "corridors",
    name: "Corridors",
    description: "Three tight lanes connected by narrow vertical shafts",
    makeGrid: makeCorridors,
  },
];

export function getMap(id) {
  return MAPS.find((m) => m.id === id) || MAPS[0];
}
