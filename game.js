import * as THREE from "three";
import { SERVER_URL } from "./config.js"; // your Render address lives in config.js

// ================= SCENE =================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 1000);
scene.add(camera); // needed so the first-person hands, hammer and shield show up

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const sun = new THREE.DirectionalLight(0xffffff, 1);
sun.position.set(10, 20, 10);
scene.add(sun);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(100, 100),
  new THREE.MeshStandardMaterial({ color: 0x55aa55 })
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const player = new THREE.Mesh(
  new THREE.BoxGeometry(1, 2, 1),
  new THREE.MeshStandardMaterial({ color: 0x8e44ad })
);
player.position.y = 1;
scene.add(player);

// Bald head (only shows when there is no mahoney.png cutout)
const headMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.45, 16, 16),
  new THREE.MeshStandardMaterial({ color: 0xf1c27d })
);
headMesh.position.y = 1.4;
player.add(headMesh);
let headLocalY = 1.4;

// Glow on his head during the ult
const glowCanvas = document.createElement("canvas");
glowCanvas.width = glowCanvas.height = 128;
const gctx = glowCanvas.getContext("2d");
const glowGrad = gctx.createRadialGradient(64, 64, 0, 64, 64, 64);
glowGrad.addColorStop(0, "rgba(255,255,255,1)");
glowGrad.addColorStop(0.3, "rgba(255,240,150,0.85)");
glowGrad.addColorStop(1, "rgba(255,200,50,0)");
gctx.fillStyle = glowGrad;
gctx.fillRect(0, 0, 128, 128);
const headGlow = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(glowCanvas),
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  })
);
headGlow.position.set(0, headLocalY, -0.3);
headGlow.visible = false;
player.add(headGlow);

// ================= ASSETS =================
const texLoader = new THREE.TextureLoader();

// Loads a photo onto a material. If the photo is missing, the plain color stays.
function addPhoto(material, file, repeatX, repeatY) {
  texLoader.load(file, (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeatX, repeatY);
    material.map = t;
    material.color.setHex(0xffffff);
    material.needsUpdate = true;
  });
}

// Phone picture (flying phones, grenade, and the phone in his hand)
let phoneAspect = 1; // set automatically from your picture
const phoneTexture = texLoader.load("phone.png", (t) => {
  phoneAspect = t.image.width / t.image.height;
});
phoneTexture.colorSpace = THREE.SRGBColorSpace;
const phoneMat = new THREE.MeshBasicMaterial({
  map: phoneTexture,
  transparent: true,
  alphaTest: 0.05,
  side: THREE.DoubleSide,
});
const phoneGeo = new THREE.PlaneGeometry(1, 1);

// Shield: blue disc + your logo + gold rim (the logo appears once logo.png loads)
const shieldDiscMat = new THREE.MeshBasicMaterial({
  color: 0x3a7bff, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false,
});
const shieldLogoMat = new THREE.MeshBasicMaterial({
  transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false,
});
const shieldRimMat = new THREE.MeshBasicMaterial({ color: 0xffd700, side: THREE.DoubleSide });

function makeShield(radius) {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CircleGeometry(radius, 40), shieldDiscMat);
  const logo = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.9, 40), shieldLogoMat);
  logo.position.z = 0.01;
  const rim = new THREE.Mesh(new THREE.RingGeometry(radius * 0.94, radius, 40), shieldRimMat);
  rim.position.z = 0.02;
  g.add(disc, logo, rim);
  g.visible = false;
  return g;
}

// ================= MAP: FOOTBALL FIELD =================
const END_COLOR = "#1a2a6c"; // kill banner + cover blocks
const ENDZONE_COLOR = "#c8102e"; // end zones (red)
const fc = document.createElement("canvas");
fc.width = 640;
fc.height = 1440;
const ctx = fc.getContext("2d");

// grass stripes (each stripe = 10 yards)
for (let i = 0; i < 12; i++) {
  ctx.fillStyle = i % 2 === 0 ? "#2e8b3a" : "#3a9d47";
  ctx.fillRect(0, i * 120, 640, 120);
}
// end zones
ctx.fillStyle = ENDZONE_COLOR;
ctx.fillRect(0, 0, 640, 120);
ctx.fillRect(0, 1320, 640, 120);
// yard lines and sidelines
ctx.fillStyle = "#ffffff";
for (let i = 1; i < 12; i++) ctx.fillRect(0, i * 120 - 3, 640, 6);
ctx.fillRect(0, 0, 8, 1440);
ctx.fillRect(632, 0, 8, 1440);
// end zone text
ctx.font = "bold 80px sans-serif";
ctx.textAlign = "center";
ctx.textBaseline = "middle";
ctx.fillText("COUGARS", 320, 60);
ctx.fillText("COUGARS", 320, 1380);

const fieldTex = new THREE.CanvasTexture(fc);
fieldTex.colorSpace = THREE.SRGBColorSpace;
fieldTex.anisotropy = 8;
const field = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 90),
  new THREE.MeshStandardMaterial({ map: fieldTex })
);
field.rotation.x = -Math.PI / 2;
field.position.y = 0.02;
scene.add(field);

// Logo at midfield + on the shield (only appears if logo.png exists)
texLoader.load("logo.png", (t) => {
  t.colorSpace = THREE.SRGBColorSpace;
  const logo = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 14), // size of the logo
    new THREE.MeshBasicMaterial({ map: t, transparent: true })
  );
  logo.rotation.x = -Math.PI / 2;
  logo.position.y = 0.06;
  scene.add(logo);

  shieldLogoMat.map = t;
  shieldLogoMat.opacity = 0.95;
  shieldLogoMat.needsUpdate = true;
});

// Goalposts (just decoration, bullets pass through)
const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd700 });
function makeGoalpost(z) {
  const parts = [
    [5.6, 0.2, 0.2, 0, 3],    // crossbar
    [0.2, 5, 0.2, -2.8, 5.5], // left upright
    [0.2, 5, 0.2, 2.8, 5.5],  // right upright
    [0.2, 3, 0.2, 0, 1.5],    // base
  ];
  for (const [w, h, d, x, y] of parts) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), goldMat);
    m.position.set(x, y, z);
    scene.add(m);
  }
}
makeGoalpost(-44);
makeGoalpost(44);


// ----- Walls and cover -----
// x/z = center, w = width, d = depth, h = height (default 6), color = hex
// Add  photo: "hall.jpg"  to any wall to put a photo on it.
const walls = [
  // fences around the field (side fences are low so you can see the bleachers)
  { x: 0, z: -47, w: 48, d: 2, h: 6, color: 0x444444 },
  { x: 0, z: 47, w: 48, d: 2, h: 6, color: 0x444444 },
  // cover (equipment and benches)
  { x: -10, z: -22, w: 5, d: 2, h: 3, color: 0x1a2a6c },
  { x: 10, z: -22, w: 5, d: 2, h: 3, color: 0x1a2a6c },
  { x: -10, z: 22, w: 5, d: 2, h: 3, color: 0x1a2a6c },
  { x: 10, z: 22, w: 5, d: 2, h: 3, color: 0x1a2a6c },
  { x: -14, z: 0, w: 2, d: 6, h: 3, color: 0x888888 },
  { x: 14, z: 0, w: 2, d: 6, h: 3, color: 0x888888 },
];

// ===== walkable bleachers, announcer room, stairs =====
function fence(x, z0, z1) { walls.push({ x, z: (z0 + z1) / 2, w: 2, d: z1 - z0, h: 2.5, color: 0x444444 }); }
for (const sx of [-23, 23]) { fence(sx, -48, -39); fence(sx, -33, -6); fence(sx, 6, 33); fence(sx, 39, 48); }
for (const side of [-1, 1]) {
  for (let i = 0; i < 8; i++) {
    const top = 0.5 * (i + 1);
    walls.push({ x: side * (24.8 + i * 1.6), z: 0, w: 1.6, d: 60, y0: i < 4 ? 0 : top - 0.3, h: top, color: i % 2 ? 0x7b858f : 0x9aa3ad });
  }
  walls.push({ x: side * 37, z: 0, w: 0.4, d: 60, h: 4.6, color: 0x555555 });
  const bl = new THREE.PointLight(0xffe0b0, 1.2, 14); bl.position.set(side * 33.5, 1.5, 0); scene.add(bl);
}
const RY = 6; // announcer room floor height
walls.push(
  { x: -42.5, z: 0, w: 10, d: 24, y0: 5.7, h: RY, color: 0x3a3a4a },
  { x: -47.25, z: 0, w: 0.5, d: 24, y0: RY, h: 9, color: 0x2c2c3c },
  { x: -37.75, z: 0, w: 0.5, d: 24, y0: RY, h: 7, color: 0x2c2c3c },
  { x: -42.5, z: -12.25, w: 10, d: 0.5, y0: RY, h: 9, color: 0x2c2c3c },
  { x: -47, z: 12.25, w: 1, d: 0.5, y0: RY, h: 9, color: 0x2c2c3c },
  { x: -39.5, z: 12.25, w: 4, d: 0.5, y0: RY, h: 9, color: 0x2c2c3c },
  { x: -42.5, z: 0, w: 11, d: 25, y0: 9, h: 9.4, color: 0x222233 },
  { x: -45.5, z: 4, w: 1.2, d: 8, y0: RY, h: 7, color: 0x6b4a2b }
);
for (let k = 0; k < 12; k++) {
  walls.push({ x: -44, z: 27 - 1.25 * (k + 0.5), w: 4, d: 1.25, h: 0.5 * (k + 1), color: k % 2 ? 0x777777 : 0x999999 });
}
const roomLight = new THREE.PointLight(0xfff0d0, 1.5, 20); roomLight.position.set(-42.5, 8, 0); scene.add(roomLight);

const wallBoxes = [];
for (const wall of walls) {
  const h = wall.h || 6;
  const mat = new THREE.MeshStandardMaterial({ color: wall.color || 0xd8d0c0 });
  if (wall.photo) addPhoto(mat, wall.photo, 1, 1);
  const y0 = wall.y0 || 0;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(wall.w, h - y0, wall.d), mat);
  mesh.position.set(wall.x, (h + y0) / 2, wall.z);
  scene.add(mesh);
  wallBoxes.push({
    minX: wall.x - wall.w / 2,
    maxX: wall.x + wall.w / 2,
    minZ: wall.z - wall.d / 2,
    maxZ: wall.z + wall.d / 2,
    h: h,
    y0: y0,
  });
}

const STEP_HEIGHT = 0.65, GRAVITY = 26, JUMP_SPEED = 9.5;
let velY = 0, onGround = true;

// Stops players and bots from walking through walls (feet = height of your feet)
function pushOutOfWalls(pos, feet = 0, step = 0) {
  const r = 0.6;
  for (const b of wallBoxes) {
    if (feet >= b.h - step || feet + 2 <= b.y0) continue; // stepped over it, or it is above your head
    if (pos.x > b.minX - r && pos.x < b.maxX + r && pos.z > b.minZ - r && pos.z < b.maxZ + r) {
      const left = pos.x - (b.minX - r), right = b.maxX + r - pos.x;
      const up = pos.z - (b.minZ - r), down = b.maxZ + r - pos.z;
      const m = Math.min(left, right, up, down);
      if (m === left) pos.x = b.minX - r;
      else if (m === right) pos.x = b.maxX + r;
      else if (m === up) pos.z = b.minZ - r;
      else pos.z = b.maxZ + r;
    }
  }
}

// True if a point (phone, grenade, enemy ball) is inside a wall
function insideWall(p) {
  for (const b of wallBoxes) {
    if (p.x > b.minX && p.x < b.maxX && p.z > b.minZ && p.z < b.maxZ && p.y < b.h && p.y >= b.y0) return true;
  }
  return false;
}

function groundAt(x, z, feet) {
  let g = 0;
  for (const b of wallBoxes) {
    if (x > b.minX - 0.3 && x < b.maxX + 0.3 && z > b.minZ - 0.3 && z < b.maxZ + 0.3 && b.h <= feet + STEP_HEIGHT && b.h > g) g = b.h;
  }
  return g;
}

function physicsStep(dt, canJump) {
  const p = player.position;
  const prev = p.y - 1;
  if (canJump && keys.Space && onGround) { velY = JUMP_SPEED; onGround = false; }
  velY -= GRAVITY * dt;
  let feet = prev + velY * dt;
  if (velY > 0) {
    for (const b of wallBoxes) {
      if (b.y0 > 0 && p.x > b.minX - 0.4 && p.x < b.maxX + 0.4 && p.z > b.minZ - 0.4 && p.z < b.maxZ + 0.4 &&
          prev + 2 <= b.y0 + 0.01 && feet + 2 > b.y0) { feet = b.y0 - 2; velY = 0; }
    }
  }
  const g = groundAt(p.x, p.z, prev);
  if (feet <= g) { feet = g; velY = 0; onGround = true; } else onGround = false;
  p.y = feet + 1;
}

// Two-way teleporter: field (east side) <-> announcer room
const pads = [
  { x: 18, z: -30, y: 0, to: [-41, 6, 0], c: 0x00e5ff },
  { x: -43.5, z: -8, y: 6, to: [18, 0, -26], c: 0xff66ff },
];
for (const pd of pads) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.12, 24), new THREE.MeshStandardMaterial({ color: pd.c, emissive: pd.c, emissiveIntensity: 0.9 }));
  m.position.set(pd.x, pd.y + 0.06, pd.z); scene.add(m);
  const pl = new THREE.PointLight(pd.c, 1.2, 8); pl.position.set(pd.x, pd.y + 1.2, pd.z); scene.add(pl);
}
let padCooldown = 0;
function checkPads(now) {
  if (!playing || dead || now < padCooldown) return;
  const p = player.position, feet = p.y - 1;
  for (const pd of pads) {
    if (Math.hypot(p.x - pd.x, p.z - pd.z) < 1.2 && Math.abs(feet - pd.y) < 0.6) {
      p.set(pd.to[0], pd.to[1] + 1, pd.to[2]); velY = 0; padCooldown = now + 1500; break;
    }
  }
}

// True if nothing is blocking the line between two spots (used by bots to "see")
function hasLineOfSight(a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const steps = Math.ceil(Math.hypot(dx, dz));
  const p = new THREE.Vector3(0, 1.5, 0);
  for (let i = 1; i < steps; i++) {
    p.x = a.x + (dx * i) / steps;
    p.z = a.z + (dz * i) / steps;
    if (insideWall(p)) return false;
  }
  return true;
}

// Places where players and bots can spawn (all clear of walls)
const SPAWNS = [
  [-15, -35], [15, -35], [-15, 35], [15, 35], [0, -30],
  [0, 30], [-6, -12], [6, 12], [-6, 12], [6, -12],
];

// ================= CHARACTERS =================
// Change these numbers to balance him. More teachers get added here later.
const characters = {
  mahoney: {
    name: "Mr. Mahoney",
    color: 0x8e44ad,
    picture: "mahoney.png", // optional cutout photo of him
    health: 275,
    speed: 0.15,
    // Weapon: phone burst
    burst: 3,
    damage: 10,
    fireDelay: 450, // ms between bursts (smaller = faster)
    spread: 0.07, // angle between each phone: bigger = wider fan
    // Q: dash
    dashCooldown: 5000,
    dashDistance: 6,
    // E: phone grenade
    grenadeCooldown: 10000,
    grenadeDamage: 125,
    grenadeRadius: 5,
    // Right click (hold): logo shield
    shieldBlock: 0.85, // blocks 85% of damage
    shieldSpeed: 0.6, // move at 60% speed while the shield is up
    // V: ban hammer (one shot kill)
    meleeCooldown: 30000, // 30 seconds
    meleeRange: 4.5,
    // X: ultimate "Balding"
    ultCost: 100, // charge needed
    ultStartCharge: 0, // set to 100 to test the ult right away
    ultPassivePerSec: 0.7, // charge from just playing (lower = harder to get)
    ultPerDamage: 0.07, // charge per point of damage dealt
    ultPerKill: 8, // charge per kill
    ultDamage: 150, // damage per beam
    ultBeams: 3,
  },
  applebee: {
    name: "Ms. Applebee",
    kind: "applebee",
    color: 0xc0392b,
    picture: "applebee.png", // optional cutout photo of her
    health: 200,
    speed: 0.17,
    // Weapon: 6 hitscan apples (like Jett's knives)
    fireDelay: 600, // ms between apples (0.6 seconds)
    apples: 6,
    appleDamage: 40,
    reloadMs: 2000, // reload if you used all 6 without a kill (a kill refills instantly)
    // Right click: bee gun (hitscan, medium explosion, then a sticky yellow zone)
    beeCooldown: 8000,
    beeDamage: 50,
    beeRadius: 3.5,
    zoneDamage: 15, // the zone's single tick of damage
    zoneSeconds: 5,
    // E: landmine
    grenadeCooldown: 6000,
    mineDamage: 75,
    maxMines: 3,
    // V: beehive (no cooldown, slows)
    meleeCooldown: 0,
    meleeRange: 3.5,
    meleeDamage: 50,
    slowMs: 2000,
    // no ult yet
    ultCost: 100,
    ultStartCharge: 0,
    ultPassivePerSec: 0.7,
    ultPerDamage: 0.07,
    ultPerKill: 8,
    desc:
      "Health: 200<br>Weapon: 6 Apples (40 dmg each, hitscan)<br>No kill with all 6 = 2s reload<br>" +
      "A kill = instant refill<br>Right Click: Bee Gun (50 dmg blast + sticky zone)<br>E: Apple Landmine (75 dmg, 6s)<br>V: Beehive (50 dmg + slow)<br>X: coming soon",
  },
};
let current = characters.mahoney;

// ================= CONSTANTS =================
const ONE_SHOT = 99999; // the ban hammer is the ONLY one-shot move in the game
const MELEE_TIME = 450; // ms the hammer swing lasts
const ULT_CUTSCENE_MS = 2600; // bald head close-up length
const ULT_AIM_MS = 10000; // max time to fire the beams
const ULT_BEAM_DELAY = 900; // ms between beams
const BEAM_HIT_RADIUS = 1.4;
const BEAM_LIFE = 45; // frames a beam stays visible
const PHONE_VIEW = { x: 0.38, y: -0.36, z: -0.8 }; // where the phone sits in first person
const NET_RATE = 50; // ms between position updates sent online (20 per second)
const SERVER_VERSION = 5; // must match server.js (used to warn you if the server is old)
const LAST_HIT_WINDOW = 10000; // ms: switching teachers gives the kill to whoever hit you in this time

// ----- BOT SETTINGS (change these to make bots easier or harder) -----
const BOT_COUNT = 5;
const BOT_HEALTH = 150;
const BOT_SPEED = 5.5; // units per second (you move about 9)
const BOT_AIM_ERROR = 0.1; // random aim miss in radians: bigger = worse aim
const BOT_REACTION = 0.5; // seconds a bot waits after spotting someone before shooting
const BOT_SHOTS = 3; // shots per burst
const BOT_SHOT_GAP = 0.12; // seconds between shots in a burst
const BOT_BURST_DELAY = 1.5; // seconds between bursts (a little random is added)
const BOT_DAMAGE = 8; // damage per bot shot
const BOT_BULLET_SPEED = 0.45; // you can dodge these
const BOT_VIEW = 45; // how far bots can see
const BOT_RESPAWN = 4; // seconds
const BOT_NAMES = ["Bot Alpha", "Bot Bravo", "Bot Charlie", "Bot Delta", "Bot Echo"];
const BOT_COLORS = [0xe74c3c, 0x3498db, 0xf39c12, 0x1abc9c, 0xe91e63];

// ================= STATE =================
let playing = false;
let paused = false; // true while the Esc menu is open
let pausedAt = 0;
let inMatch = false; // true once you have spawned in the current match
let lastAttacker = null; // bot mode: who hit you last
let lastAttackerTime = 0;
let dead = false;
let firstPerson = false;
let maxHealth = current.health;
let playerHealth = maxHealth;
let speed = current.speed;
let lastShot = -99999;
let lastDash = -99999;
let lastGrenade = -99999;
let lastMelee = -99999;
let yaw = 0;
let pitch = 0;
let mouseHeld = false;
let rightHeld = false;
let shieldUp = false;
let meleeStart = 0; // 0 = not swinging
let meleeHit = false;
let ultCharge = 0;
let ultPhase = 0; // 0 = not using, 1 = bald head close-up, 2 = aiming beams
let ultStart = 0;
let ultAimStart = 0;
let beamsLeft = 0;
let lastBeam = 0;
let viewKick = 0;
let throwAnim = 0;
let shake = 0;
let dashFxLevel = 0;
let dashFrames = 0;
let kills = 0;
let deaths = 0;
let bonusShield = 0; // blue bonus health from siphon
const BONUS_SHIELD = 50; // how much you get per elimination
let camDist = 8; // third person camera distance (scroll wheel changes it)
let camDistTarget = 8;
const CAM_MIN = 2.5; // closest zoom
const CAM_MAX = 18; // farthest zoom

// online
let mode = "bots"; // "bots" or "online"
let net = null; // { ws, id, code, ready, join, old }
let lastNetSend = 0;
const remotes = new Map(); // other online players

// Random name on purpose: no typing, so nobody can type something inappropriate
const NAME_A = ["Swift", "Brave", "Sneaky", "Mighty", "Lucky", "Clever", "Wild", "Silent"];
const NAME_B = ["Cougar", "Tiger", "Panther", "Falcon", "Wolf", "Bear", "Shark", "Eagle"];
const myName =
  NAME_A[Math.floor(Math.random() * NAME_A.length)] + " " +
  NAME_B[Math.floor(Math.random() * NAME_B.length)] + " " +
  (10 + Math.floor(Math.random() * 90));

// Asks the browser to capture the mouse (it can refuse right after Esc, so errors are ignored)
function lockPointer() {
  try {
    const r = renderer.domElement.requestPointerLock();
    if (r && r.catch) r.catch(() => {});
  } catch (e) {}
}

// ================= PLAYER LOOK (picture + camera mode) =================
const BODY_HEIGHT = 2.2; // height of the cutout picture
const bodySprite = new THREE.Sprite(new THREE.SpriteMaterial({ alphaTest: 0.05 }));
bodySprite.visible = false;
player.add(bodySprite);

// Swaps the purple box for a cutout picture, if the picture exists
function loadBodyPicture(file) {
  bodySprite.visible = false;
  player.material.visible = true;
  headMesh.visible = true;
  headLocalY = 1.4;
  headGlow.position.y = headLocalY;
  if (!file) return;
  texLoader.load(file, (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    bodySprite.material.map = t;
    bodySprite.material.needsUpdate = true;
    const aspect = t.image.width / t.image.height;
    bodySprite.scale.set(BODY_HEIGHT * aspect, BODY_HEIGHT, 1);
    bodySprite.position.y = BODY_HEIGHT / 2 - 1; // feet on the ground
    bodySprite.visible = true;
    player.material.visible = false;
    headMesh.visible = false;
    headLocalY = 0.95; // head is near the top of the picture
    headGlow.position.y = headLocalY;
  });
}

// First person is on during the ult aiming, off during the bald head close-up
function isFirstPerson() {
  if (ultPhase === 1) return false;
  if (ultPhase === 2) return true;
  return firstPerson;
}

// Hide your own body in first person or when dead
function showPlayerModel() {
  player.visible = !dead && !isFirstPerson();
}

// ================= FIRST-PERSON VIEW + HAMMER + SHIELD =================
const skinMat = new THREE.MeshStandardMaterial({ color: 0xf1c27d });
const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x8e44ad });

// Everything in viewRoot is attached to the camera (first person only)
const viewRoot = new THREE.Group();
viewRoot.visible = false;
camera.add(viewRoot);

// Hand holding the phone
const viewPhone = new THREE.Group();
const viewPhoneImg = new THREE.Mesh(phoneGeo, phoneMat);
viewPhoneImg.rotation.x = -0.9;
viewPhone.add(viewPhoneImg);
const viewHand = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 12), skinMat);
viewHand.position.set(0, -0.07, 0.1);
viewPhone.add(viewHand);
const viewArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.8), sleeveMat);
viewArm.position.set(0.05, -0.17, 0.5);
viewArm.rotation.x = 0.3;
viewPhone.add(viewArm);
viewPhone.position.set(PHONE_VIEW.x, PHONE_VIEW.y, PHONE_VIEW.z);
viewRoot.add(viewPhone);

// Ban hammer (a gavel). Pivot is at the handle bottom, so it swings from the hand.
function makeHammer() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b3f1d });
  const metal = new THREE.MeshStandardMaterial({ color: 0x2b2b2b });
  const red = new THREE.MeshStandardMaterial({ color: 0xc8102e });
  const gold = new THREE.MeshStandardMaterial({ color: 0xffd700 });

  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 1.5, 10), wood);
  handle.position.y = 0.75;
  g.add(handle);

  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), skinMat);
  hand.position.y = 0.15;
  g.add(hand);

  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 16), metal);
  head.rotation.z = Math.PI / 2;
  head.position.y = 1.5;
  g.add(head);

  for (const s of [-1, 1]) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.2, 16), red);
    cap.rotation.z = Math.PI / 2;
    cap.position.set(s * 0.5, 1.5, 0);
    g.add(cap);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.08, 16), gold);
    band.rotation.z = Math.PI / 2;
    band.position.set(s * 0.32, 1.5, 0);
    g.add(band);
  }
  g.visible = false;
  return g;
}

const hammerTP = makeHammer(); // third person: in his right hand
hammerTP.position.set(0.8, 0.1, -0.2);
player.add(hammerTP);

const hammerFP = makeHammer(); // first person: in front of the camera
hammerFP.scale.setScalar(0.5);
hammerFP.position.set(0.35, -0.5, -0.7);
viewRoot.add(hammerFP);

const shieldWorld = makeShield(1.5); // third person shield
scene.add(shieldWorld);
const shieldFP = makeShield(0.45); // first person shield (left side of the screen)
shieldFP.position.set(-0.5, -0.3, -1.0);
shieldFP.rotation.y = 0.35;
viewRoot.add(shieldFP);

// Hammer swing: raise it back, then smash forward
function swingAngle(t, rest, back, front) {
  if (t < 0.4) return rest + (back - rest) * (t / 0.4);
  if (t < 0.7) {
    const k = (t - 0.4) / 0.3;
    return back + (front - back) * k * k;
  }
  return front;
}

// ================= UI =================
const styleEl = document.createElement("style");
styleEl.textContent = `
@keyframes rainbowMove { to { background-position: 200% 0; } }
@keyframes pulse {
  0%, 100% { transform: translateX(-50%) scale(1); }
  50% { transform: translateX(-50%) scale(1.08); }
}
.rainbow {
  background: linear-gradient(90deg,#ff0000,#ff9900,#ffee00,#33dd33,#00ccff,#5a4dff,#c040ff,#ff0000);
  background-size: 200% 100%;
  animation: rainbowMove 1.2s linear infinite;
}
.rainbowText {
  -webkit-background-clip: text; background-clip: text;
  color: transparent; -webkit-text-fill-color: transparent;
}
.ultGold { background: #ffc107; }
`;
document.head.appendChild(styleEl);

const healthBox = document.createElement("div");
healthBox.style.cssText =
  "position:fixed;bottom:20px;left:20px;width:250px;height:24px;background:#333;border:2px solid #fff;";
const healthFill = document.createElement("div");
healthFill.style.cssText = "height:100%;width:100%;background:#2ecc40;";
const healthText = document.createElement("div");
healthText.style.cssText =
  "position:absolute;top:0;left:0;width:100%;text-align:center;font:bold 14px/24px sans-serif;color:#fff;text-shadow:1px 1px 2px #000;";
healthBox.appendChild(healthFill);
healthBox.appendChild(healthText);

// Blue bonus shield: a blue strip on top of the health bar + a blue bubble around you
const bonusFill = document.createElement("div");
bonusFill.style.cssText =
  "position:absolute;top:0;left:0;height:8px;width:0%;background:#2f8bff;box-shadow:0 0 8px #2f8bff;";
healthBox.appendChild(bonusFill);
const bonusBubble = new THREE.Mesh(
  new THREE.SphereGeometry(1.5, 16, 16),
  new THREE.MeshBasicMaterial({ color: 0x3a8bff, transparent: true, opacity: 0.22, depthWrite: false })
);
bonusBubble.position.y = 0.4;
bonusBubble.visible = false;
player.add(bonusBubble);

document.body.appendChild(healthBox);

const abilityHud = document.createElement("div");
abilityHud.style.cssText =
  "position:fixed;bottom:55px;left:20px;color:#fff;font:bold 16px sans-serif;text-shadow:1px 1px 2px #000;line-height:22px;";
document.body.appendChild(abilityHud);

// Kills / deaths (top left)
const statsHud = document.createElement("div");
statsHud.style.cssText =
  "position:fixed;top:10px;left:16px;color:#fff;font:bold 16px sans-serif;text-shadow:1px 1px 2px #000;";
document.body.appendChild(statsHud);
function updateStats() {
  statsHud.textContent = "Kills: " + kills + "   Deaths: " + deaths;
}
updateStats();

// Kill feed (top right)
const feed = document.createElement("div");
feed.style.cssText =
  "position:fixed;top:40px;right:16px;display:flex;flex-direction:column;align-items:flex-end;gap:4px;" +
  "pointer-events:none;z-index:5;font:bold 15px sans-serif;";
document.body.appendChild(feed);
function addFeed(killer, victim, how) {
  const verb = { banned: "BANNED", beam: "BALDED", apple: "APPLED", mine: "BLEW UP", hive: "BEEHIVED", bee: "STUNG" }[how] || "eliminated";
  const row = document.createElement("div");
  row.style.cssText =
    "background:rgba(0,0,0,0.6);color:#fff;padding:4px 10px;border-radius:4px;border-left:4px solid #ffd700;";
  row.textContent = killer + " " + verb + " " + victim;
  feed.appendChild(row);
  setTimeout(() => row.remove(), 4500);
  while (feed.children.length > 6) feed.firstChild.remove();
}
function addFeedText(text) {
  const row = document.createElement("div");
  row.style.cssText =
    "background:rgba(0,0,0,0.6);color:#fff;padding:4px 10px;border-radius:4px;border-left:4px solid #3498db;";
  row.textContent = text;
  feed.appendChild(row);
  setTimeout(() => row.remove(), 4500);
  while (feed.children.length > 6) feed.firstChild.remove();
}

// Ult charge bar (bottom center)
const ultBox = document.createElement("div");
ultBox.style.cssText =
  "position:fixed;bottom:20px;left:50%;transform:translateX(-50%);width:260px;height:26px;background:#222;border:2px solid #fff;border-radius:4px;overflow:hidden;";
const ultFill = document.createElement("div");
ultFill.className = "ultGold";
ultFill.style.cssText = "height:100%;width:0%;";
const ultLabel = document.createElement("div");
ultLabel.style.cssText =
  "position:absolute;top:0;left:0;width:100%;text-align:center;font:bold 14px/26px sans-serif;color:#fff;text-shadow:1px 1px 2px #000;";
ultBox.appendChild(ultFill);
ultBox.appendChild(ultLabel);
document.body.appendChild(ultBox);

const CROSS_NORMAL =
  "position:fixed;top:50%;left:50%;width:28px;height:28px;margin:-14px 0 0 -14px;pointer-events:none;z-index:5;filter:drop-shadow(0 0 1px #000) drop-shadow(0 0 1px #000);background:" +
  "linear-gradient(#fff,#fff) 13px 0/2px 9px no-repeat,linear-gradient(#fff,#fff) 13px 19px/2px 9px no-repeat," +
  "linear-gradient(#fff,#fff) 0 13px/9px 2px no-repeat,linear-gradient(#fff,#fff) 19px 13px/9px 2px no-repeat," +
  "radial-gradient(#fff 0 1.5px,transparent 2px) center/28px 28px no-repeat;";
const CROSS_ULT =
  "position:fixed;top:50%;left:50%;width:46px;height:46px;margin:-23px 0 0 -23px;border:3px solid #ffd54a;border-radius:50%;box-shadow:0 0 14px #ffd54a, inset 0 0 14px #ffd54a;";
const crosshair = document.createElement("div");
crosshair.style.cssText = CROSS_NORMAL;
document.body.appendChild(crosshair);

const deathMsg = document.createElement("div");
deathMsg.textContent = "YOU DIED - respawning...";
deathMsg.style.cssText =
  "position:fixed;top:40%;width:100%;text-align:center;font:bold 40px sans-serif;color:#fff;text-shadow:2px 2px 4px #000;display:none;";
document.body.appendChild(deathMsg);

const helpText = document.createElement("div");
helpText.style.cssText =
  "position:fixed;top:10px;width:100%;text-align:center;font:14px sans-serif;color:#fff;text-shadow:1px 1px 2px #000;";
document.body.appendChild(helpText);
function setHelp() {
  helpText.textContent =
    "7 camera | Scroll zoom";
}
setHelp();

// Room info (online only)
const roomHud = document.createElement("div");
roomHud.style.cssText =
  "position:fixed;top:34px;width:100%;text-align:center;font:bold 15px sans-serif;color:#ffd700;" +
  "text-shadow:1px 1px 2px #000;display:none;pointer-events:none;";
document.body.appendChild(roomHud);
function updateRoomHud() {
  if (mode !== "online" || !net) {
    roomHud.style.display = "none";
    return;
  }
  const where =
    net.code === "PUBLIC" ? "PUBLIC LOBBY" : "ROOM CODE: " + net.code + " (share it with friends)";
  roomHud.textContent =
    where + "   |   Players: " + (remotes.size + 1) +
    (net.old ? "   |   SERVER OUT OF DATE - redeploy it on Render" : "");
  roomHud.style.color = net.old ? "#ff6b6b" : "#ffd700";
  roomHud.style.display = "block";
}

// White flash (used for the ult and each beam)
const flashDiv = document.createElement("div");
flashDiv.style.cssText =
  "position:fixed;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:6;";
document.body.appendChild(flashDiv);
function flash(strength, ms) {
  flashDiv.style.transition = "none";
  flashDiv.style.opacity = strength;
  void flashDiv.offsetWidth; // forces the browser to apply it before fading
  flashDiv.style.transition = "opacity " + ms + "ms";
  flashDiv.style.opacity = 0;
}

// Red screen edges while dashing
const dashFx = document.createElement("div");
dashFx.style.cssText =
  "position:fixed;inset:0;pointer-events:none;opacity:0;z-index:3;" +
  "background:radial-gradient(ellipse at center, rgba(255,0,0,0) 45%, rgba(255,40,40,0.7) 100%);";
document.body.appendChild(dashFx);

// Golden screen while aiming the ult
const ultVignette = document.createElement("div");
ultVignette.style.cssText =
  "position:fixed;inset:0;pointer-events:none;display:none;z-index:4;" +
  "background:radial-gradient(ellipse at 50% -10%, rgba(255,240,150,0.6), rgba(255,240,150,0) 45%)," +
  "radial-gradient(ellipse at center, rgba(255,200,40,0) 50%, rgba(255,200,40,0.45) 100%);";
document.body.appendChild(ultVignette);

// "Balding" in rainbow
const ULT_TEXT_BASE =
  "position:fixed;left:50%;transform:translateX(-50%);font-family:sans-serif;font-weight:bold;" +
  "letter-spacing:6px;white-space:nowrap;pointer-events:none;z-index:7;" +
  "filter:drop-shadow(0 0 10px rgba(0,0,0,0.9));";
const ULT_TEXT_BIG =
  ULT_TEXT_BASE +
  "top:22%;font-size:120px;animation:rainbowMove 1.2s linear infinite, pulse 0.5s ease-in-out infinite;";
const ULT_TEXT_SMALL = ULT_TEXT_BASE + "top:6%;font-size:46px;";
const ultText = document.createElement("div");
ultText.className = "rainbow rainbowText";
ultText.textContent = "Balding";
ultText.style.cssText = ULT_TEXT_BASE + "display:none;";
document.body.appendChild(ultText);

const beamsHud = document.createElement("div");
beamsHud.style.cssText =
  "position:fixed;bottom:90px;left:50%;transform:translateX(-50%);display:none;pointer-events:none;" +
  "font:bold 24px sans-serif;color:#fff;text-shadow:0 0 8px #ffc107, 2px 2px 4px #000;z-index:5;";
document.body.appendChild(beamsHud);
function updateBeamsHud() {
  beamsHud.textContent =
    "BEAMS " + "●".repeat(beamsLeft) + "○".repeat(current.ultBeams - beamsLeft) + "  -  CLICK TO FIRE";
}

// ----- Kill banner (uses your cougar.png if you upload it) -----
const banner = document.createElement("div");
banner.style.cssText =
  "position:fixed;top:14%;left:50%;transform:translateX(-50%) scale(0.6);display:flex;align-items:center;gap:16px;" +
  "padding:10px 30px 10px 14px;background:linear-gradient(90deg," + END_COLOR + ",#b21f1f);" +
  "border:3px solid #ffd700;border-radius:8px;color:#fff;font-family:sans-serif;opacity:0;" +
  "transition:opacity 0.25s, transform 0.25s;pointer-events:none;z-index:5;";
banner.innerHTML =
  `<img src="cougar.png" style="height:70px;width:auto;" onerror="this.style.display='none'">` +
  `<div><div style="font-size:34px;font-weight:bold;letter-spacing:3px;">ELIMINATION</div>` +
  `<div id="bannerSub" style="font-size:16px;">Cougars win</div></div>`;
document.body.appendChild(banner);
const bannerSub = banner.querySelector("#bannerSub");
let bannerTimer;

function showKillBanner(victim, how) {
  if (how === "banned") bannerSub.textContent = victim + " got BANNED";
  else if (how === "beam") bannerSub.textContent = victim + " got BALDED";
  else if (how === "apple") bannerSub.textContent = victim + " got APPLED";
  else if (how === "mine") bannerSub.textContent = victim + " got BLOWN UP";
  else if (how === "hive") bannerSub.textContent = victim + " got BEEHIVED";
  else if (how === "bee") bannerSub.textContent = victim + " got STUNG";
  else bannerSub.textContent = victim + " eliminated";
  banner.style.opacity = "1";
  banner.style.transform = "translateX(-50%) scale(1)";
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => {
    banner.style.opacity = "0";
    banner.style.transform = "translateX(-50%) scale(0.6)";
  }, 2500);
}

function updateHealthBar() {
  healthFill.style.width = (playerHealth / maxHealth) * 100 + "%";
  bonusFill.style.width = (bonusShield / BONUS_SHIELD) * 100 + "%";
  bonusBubble.visible = bonusShield > 0;
  healthBox.style.borderColor = bonusShield > 0 ? "#2f8bff" : "#fff";
  healthText.textContent =
    Math.ceil(playerHealth) + " / " + maxHealth + (bonusShield > 0 ? "  +" + Math.ceil(bonusShield) : "");
}
updateHealthBar();

function cooldownText(label, key, last, cooldown) {
  const left = Math.ceil((cooldown - (performance.now() - last)) / 1000);
  return label + " (" + key + "): " + (left > 0 ? left + "s" : "READY");
}

// ================= MENUS =================
const MENU_STYLE =
  "position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:10;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:sans-serif;color:#fff;";
const BTN_STYLE =
  "padding:14px 30px;border:3px solid #fff;border-radius:10px;background:#222;font-size:20px;font-weight:bold;cursor:pointer;";

// ----- Mode select screen -----
const modeOverlay = document.createElement("div");
modeOverlay.style.cssText = MENU_STYLE;
modeOverlay.innerHTML = '<h1 style="margin:0 0 30px;font-size:42px;">CHOOSE A MODE</h1>';
const modeRow = document.createElement("div");
modeRow.style.cssText = "display:flex;gap:20px;";
modeOverlay.appendChild(modeRow);
const modeMsg = document.createElement("div");
modeMsg.style.cssText =
  "margin-top:22px;font-size:16px;color:#ff6b6b;min-height:20px;text-align:center;max-width:700px;";
modeOverlay.appendChild(modeMsg);
document.body.appendChild(modeOverlay);

function makeModeCard(title, desc, enabled, onClick) {
  const card = document.createElement("div");
  card.style.cssText =
    "width:240px;padding:24px;border:3px solid " + (enabled ? "#fff" : "#555") +
    ";border-radius:10px;background:#222;text-align:center;" +
    (enabled ? "cursor:pointer;" : "opacity:0.4;");
  card.innerHTML =
    '<div style="font-size:26px;font-weight:bold;margin-bottom:12px;">' + title + "</div>" +
    '<div style="font-size:14px;line-height:22px;">' + desc + "</div>";
  if (enabled) {
    card.addEventListener("mouseenter", () => (card.style.background = "#444"));
    card.addEventListener("mouseleave", () => (card.style.background = "#222"));
    card.addEventListener("click", onClick);
  }
  modeRow.appendChild(card);
}

// ----- Private room screen -----
const privateOverlay = document.createElement("div");
privateOverlay.style.cssText = MENU_STYLE;
privateOverlay.style.display = "none";
privateOverlay.innerHTML = '<h1 style="margin:0 0 26px;font-size:42px;">PRIVATE ROOM</h1>';

const createBtn = document.createElement("div");
createBtn.textContent = "CREATE A NEW ROOM";
createBtn.style.cssText = BTN_STYLE;
createBtn.addEventListener("mouseenter", () => (createBtn.style.background = "#444"));
createBtn.addEventListener("mouseleave", () => (createBtn.style.background = "#222"));
createBtn.addEventListener("click", () => startOnline({ create: true }));

const orText = document.createElement("div");
orText.textContent = "or join a friend's room with its 4-letter code:";
orText.style.cssText = "margin:26px 0 12px;font-size:16px;opacity:0.85;";

const joinRow = document.createElement("div");
joinRow.style.cssText = "display:flex;gap:12px;align-items:center;";
const codeInput = document.createElement("input");
codeInput.maxLength = 4;
codeInput.placeholder = "CODE";
codeInput.style.cssText =
  "width:130px;padding:12px;font-size:26px;font-weight:bold;text-align:center;letter-spacing:6px;" +
  "border:3px solid #fff;border-radius:10px;background:#111;color:#fff;outline:none;";
codeInput.addEventListener("input", () => {
  codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z]/g, "");
});
const joinBtn = document.createElement("div");
joinBtn.textContent = "JOIN";
joinBtn.style.cssText = BTN_STYLE;
joinBtn.addEventListener("mouseenter", () => (joinBtn.style.background = "#444"));
joinBtn.addEventListener("mouseleave", () => (joinBtn.style.background = "#222"));
joinBtn.addEventListener("click", () => {
  if (codeInput.value.length !== 4) {
    privMsg.textContent = "Type the 4-letter room code first.";
    return;
  }
  startOnline({ room: codeInput.value });
});
codeInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") joinBtn.click();
});
joinRow.appendChild(codeInput);
joinRow.appendChild(joinBtn);

const privMsg = document.createElement("div");
privMsg.style.cssText =
  "margin-top:20px;font-size:16px;color:#ff6b6b;min-height:20px;text-align:center;max-width:600px;";

const privBack = document.createElement("div");
privBack.textContent = "< Back to modes";
privBack.style.cssText =
  "margin-top:20px;font-size:16px;cursor:pointer;text-decoration:underline;opacity:0.8;";
privBack.addEventListener("click", () => {
  privateOverlay.style.display = "none";
  modeOverlay.style.display = "flex";
});

privateOverlay.appendChild(createBtn);
privateOverlay.appendChild(orText);
privateOverlay.appendChild(joinRow);
privateOverlay.appendChild(privMsg);
privateOverlay.appendChild(privBack);
document.body.appendChild(privateOverlay);

// ----- Connecting screen -----
const statusOverlay = document.createElement("div");
statusOverlay.style.cssText = MENU_STYLE + "z-index:12;";
statusOverlay.style.display = "none";
const statusText = document.createElement("div");
statusText.style.cssText = "font-size:24px;max-width:620px;text-align:center;line-height:34px;";
const statusCancel = document.createElement("div");
statusCancel.textContent = "Cancel";
statusCancel.style.cssText =
  "margin-top:26px;font-size:16px;cursor:pointer;text-decoration:underline;opacity:0.8;";
statusCancel.addEventListener("click", () => goToModes());
statusOverlay.appendChild(statusText);
statusOverlay.appendChild(statusCancel);
document.body.appendChild(statusOverlay);

function showStatus(text) {
  statusText.textContent = text;
  statusOverlay.style.display = "flex";
}

// ----- Pause menu (opens when you press Esc during a match) -----
const pauseOverlay = document.createElement("div");
pauseOverlay.style.cssText = MENU_STYLE + "z-index:11;";
pauseOverlay.style.display = "none";
pauseOverlay.innerHTML = '<h1 style="margin:0 0 14px;font-size:42px;">PAUSED</h1>';
const pauseInfo = document.createElement("div");
pauseInfo.style.cssText =
  "margin-bottom:26px;font-size:15px;opacity:0.85;text-align:center;max-width:640px;line-height:22px;";
pauseOverlay.appendChild(pauseInfo);

function makeMenuBtn(text, onClick) {
  const b = document.createElement("div");
  b.textContent = text;
  b.style.cssText = BTN_STYLE + "width:260px;text-align:center;margin-bottom:14px;";
  b.addEventListener("mouseenter", () => (b.style.background = "#444"));
  b.addEventListener("mouseleave", () => (b.style.background = "#222"));
  b.addEventListener("click", onClick);
  pauseOverlay.appendChild(b);
  return b;
}
const resumeBtn = makeMenuBtn("RESUME", () => resumeGame());
const teacherBtn = makeMenuBtn("CHOOSE TEACHER", () => {
  pauseOverlay.style.display = "none";
  showTeacherScreen();
});
const leaveBtn = makeMenuBtn("LEAVE GAME", () => goToModes());
document.body.appendChild(pauseOverlay);

function showPause() {
  if (!playing) return;
  paused = true;
  pausedAt = performance.now();
  rightHeld = false;
  mouseHeld = false;
  const note = "  |  The match keeps going while this menu is open";
  if (mode === "online" && net) {
    pauseInfo.textContent =
      (net.code === "PUBLIC" ? "Public lobby" : "Room code: " + net.code) +
      "  |  Players: " + (remotes.size + 1) + note;
  } else {
    pauseInfo.textContent = "Bot match" + note;
  }
  teacherBtn.style.display = dead ? "none" : "block"; // can't switch while waiting to respawn
  pauseOverlay.style.display = "flex";
}

function resumeGame() {
  paused = false;
  pauseOverlay.style.display = "none";
  overlay.style.display = "none";
  lockPointer();
}

// ----- Teacher select screen -----
const overlay = document.createElement("div");
overlay.style.cssText = MENU_STYLE;
overlay.style.display = "none";
overlay.innerHTML =
  '<h1 style="margin:0 0 30px;font-size:42px;">CHOOSE YOUR TEACHER</h1>';
const cardRow = document.createElement("div");
cardRow.style.cssText = "display:flex;gap:20px;";
overlay.appendChild(cardRow);

const backBtn = document.createElement("div");
backBtn.textContent = "< Back to modes";
backBtn.style.cssText = "margin-top:28px;font-size:16px;cursor:pointer;text-decoration:underline;opacity:0.8;";
backBtn.addEventListener("click", () => {
  if (inMatch) {
    overlay.style.display = "none";
    showPause();
  } else {
    goToModes();
  }
});
overlay.appendChild(backBtn);
document.body.appendChild(overlay);

function showTeacherScreen() {
  backBtn.textContent = inMatch ? "< Back to pause menu" : "< Back to modes";
  overlay.style.display = "flex";
}

function makeCard(html, locked) {
  const card = document.createElement("div");
  card.style.cssText =
    "width:240px;padding:20px;border:3px solid " +
    (locked ? "#555" : "#fff") +
    ";border-radius:10px;background:#222;text-align:center;" +
    (locked ? "opacity:0.4;" : "cursor:pointer;");
  card.innerHTML = html;
  cardRow.appendChild(card);
  return card;
}

for (const key in characters) {
  const c = characters[key];
  const card = makeCard(
    '<div style="font-size:24px;font-weight:bold;margin-bottom:10px;">' + c.name + "</div>" +
      '<div style="font-size:14px;line-height:22px;text-align:left;">' +
      (c.desc ? c.desc + '</div><div style="display:none;">' : "") +
      "Health: " + c.health + "<br>" +
      "Weapon: Phones (" + c.burst + " x " + c.damage + " dmg)<br>" +
      "Q: Dash<br>" +
      "E: Phone Grenade (" + c.grenadeDamage + " dmg)<br>" +
      "Right Click: Logo Shield (" + Math.round(c.shieldBlock * 100) + "% block)<br>" +
      "V: Ban Hammer (one shot, " + Math.round(c.meleeCooldown / 1000) + "s)<br>" +
      "X: ULT - Balding (" + c.ultBeams + " x " + c.ultDamage + " dmg)" +
      "</div>",
    false
  );

  // Picture on top of the card (falls back to a colored box if the picture is missing)
  const holder = document.createElement("div");
  holder.style.cssText =
    "height:140px;margin:0 auto 12px;display:flex;justify-content:center;align-items:center;";
  const fallback = document.createElement("div");
  fallback.style.cssText =
    "width:80px;height:120px;background:#" + c.color.toString(16).padStart(6, "0") + ";";
  holder.appendChild(fallback);
  if (c.picture) {
    const pic = document.createElement("img");
    pic.style.cssText = "max-height:140px;max-width:100%;display:none;";
    pic.onload = () => {
      pic.style.display = "block";
      fallback.style.display = "none";
    };
    pic.src = c.picture;
    holder.appendChild(pic);
  }
  card.prepend(holder);

  card.addEventListener("mouseenter", () => (card.style.background = "#444"));
  card.addEventListener("mouseleave", () => (card.style.background = "#222"));
  card.addEventListener("click", () => selectCharacter(key));
}
makeCard('<div style="font-size:24px;margin:80px 0;">Coming soon</div>', true);

// Bot mode: switching teachers counts as a respawn, so the last bot that hit you gets the kill
function creditSwitchKill() {
  if (lastAttacker && performance.now() - lastAttackerTime < LAST_HIT_WINDOW) {
    lastAttacker.kills++;
    deaths++;
    addFeed(lastAttacker.name, "You", "");
    updateStats();
  }
  lastAttacker = null;
}

function selectCharacter(key) {
  // can't switch while waiting to respawn: just close the menus and keep playing
  if (inMatch && dead) {
    overlay.style.display = "none";
    pauseOverlay.style.display = "none";
    paused = false;
    lockPointer();
    return;
  }
  const switching = inMatch;
  if (switching && mode === "bots") creditSwitchKill();
  lastAttacker = null;

  current = characters[key];
  player.material.color.setHex(current.color);
  loadBodyPicture(current.picture);
  maxHealth = current.health;
  playerHealth = maxHealth;
  speed = current.speed;
  lastShot = lastDash = lastGrenade = lastMelee = -99999;
  resetApples();
  bonusShield = 0;
  dashFrames = 0;
  meleeStart = 0;
  endUlt();
  ultCharge = current.ultStartCharge;
  dead = false;
  showPlayerModel();
  deathMsg.style.display = "none";
  if (mode === "bots") {
    const s = pickSpawn();
    player.position.set(s[0], 1, s[1]);
  } else if (!switching) {
    player.position.set(0, 1, 0); // online: the server sends your real spawn point
  }
  updateHealthBar();
  overlay.style.display = "none";
  pauseOverlay.style.display = "none";
  paused = false;
  playing = true;
  inMatch = true;
  if (mode === "online" && net) {
    if (net.ready) {
      netSend({ t: "switch", char: key }); // the server respawns you and credits your last attacker
    } else {
      net.ready = true;
      netSend({ t: "ready", char: key });
    }
  }
  lockPointer();
}

// Back to the mode screen from anywhere (closes the online connection too)
function goToModes(msg) {
  playing = false;
  paused = false;
  inMatch = false;
  lastAttacker = null;
  endUlt();
  meleeStart = 0;
  leaveOnline();
  clearBots();
  overlay.style.display = "none";
  pauseOverlay.style.display = "none";
  privateOverlay.style.display = "none";
  statusOverlay.style.display = "none";
  modeMsg.textContent = msg || "";
  modeOverlay.style.display = "flex";
  document.exitPointerLock();
}

// ================= PLAYER DAMAGE / RESPAWN (bot mode) =================
// Siphon: eliminating someone gives full health + a blue bonus shield
function siphon() {
  if (dead) return;
  playerHealth = maxHealth;
  bonusShield = BONUS_SHIELD;
  updateHealthBar();
  addFeedText("SIPHON: full health + " + BONUS_SHIELD + " blue shield");
}

function damagePlayer(amount, attacker) {
  if (dead || ultPhase !== 0) return; // can't be hurt while using the ult
  if (attacker && attacker.name) {
    lastAttacker = attacker; // remembered so switching teachers can credit the kill
    lastAttackerTime = performance.now();
  }
  if (shieldUp) amount *= 1 - current.shieldBlock; // shield blocks 85%
  // the blue bonus shield soaks damage first
  const soak = Math.min(bonusShield, amount);
  bonusShield -= soak;
  amount -= soak;
  playerHealth -= amount;
  if (playerHealth <= 0) {
    playerHealth = 0;
    dead = true;
    clearMines();
    lastAttacker = null;
    deaths++;
    updateStats();
    dashFrames = 0;
    if (attacker && attacker.name) {
      attacker.kills++;
      addFeed(attacker.name, "You", "");
      deathMsg.textContent = "ELIMINATED BY " + attacker.name.toUpperCase() + " - respawning...";
    } else {
      deathMsg.textContent = "YOU DIED - respawning...";
    }
    showPlayerModel();
    deathMsg.style.display = "block";
    setTimeout(() => {
      playerHealth = maxHealth;
      bonusShield = 0;
      dead = false;
      const s = pickSpawn();
      player.position.set(s[0], 1, s[1]);
      showPlayerModel();
      deathMsg.style.display = "none";
      updateHealthBar();
    }, 3000);
  }
  updateHealthBar();
}

// ================= INPUT =================
const keys = {};
addEventListener("keydown", (e) => {
  keys[e.code] = true;

  // Esc closes the pause menu (ignored for a moment so the Esc that opened it doesn't close it)
  if (
    e.code === "Escape" &&
    paused &&
    pauseOverlay.style.display === "flex" &&
    performance.now() - pausedAt > 400
  ) {
    resumeGame();
    return;
  }
  // Esc when the mouse is already free (for example a failed relock) also opens the menu
  if (
    e.code === "Escape" &&
    playing &&
    !paused &&
    !document.pointerLockElement &&
    overlay.style.display === "none"
  ) {
    showPause();
    return;
  }

  // 7 = switch between first person and third person
  if ((e.code === "Digit7" || e.code === "Numpad7") && !e.repeat && ultPhase === 0) {
    firstPerson = !firstPerson;
    showPlayerModel();
  }

  if (!playing || dead || paused || ultPhase !== 0 || e.repeat) return;
  if (e.code === "KeyQ" && current.kind !== "applebee") dash();
  if (e.code === "KeyE") throwGrenade();
  if (e.code === "KeyV") melee();
  if (e.code === "KeyX") startUlt();
});
addEventListener("keyup", (e) => (keys[e.code] = false));

// Scroll wheel zooms the third person camera (scroll up = closer, like Roblox)
addEventListener(
  "wheel",
  (e) => {
    if (!playing || paused || ultPhase !== 0) return;
    camDistTarget += Math.max(-2, Math.min(2, e.deltaY * 0.01));
    camDistTarget = Math.max(CAM_MIN, Math.min(CAM_MAX, camDistTarget));
  },
  { passive: true }
);

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

renderer.domElement.addEventListener("click", () => {
  if (playing && !paused) lockPointer();
});
addEventListener("mousemove", (e) => {
  if (document.pointerLockElement && ultPhase !== 1) {
    yaw -= e.movementX * 0.003;
    pitch -= e.movementY * 0.003;
    pitch = Math.max(-1, Math.min(1, pitch));
  }
});

// Left click = shoot (or fire a beam during the ult), right click (hold) = shield
addEventListener("mousedown", (e) => {
  if (!playing || dead || paused || !document.pointerLockElement) return;
  if (e.button === 2) {
    if (current.kind === "applebee") {
      fireBeeGun();
      return;
    }
    rightHeld = true;
    return;
  }
  if (e.button !== 0) return;
  if (ultPhase === 2) {
    fireBeam();
    return;
  }
  mouseHeld = true;
  tryShoot();
});
addEventListener("mouseup", (e) => {
  if (e.button === 2) rightHeld = false;
  if (e.button === 0) mouseHeld = false;
});
addEventListener("contextmenu", (e) => e.preventDefault());
document.addEventListener("pointerlockchange", () => {
  if (!document.pointerLockElement) {
    rightHeld = false;
    mouseHeld = false;
    // the mouse got released (Esc was pressed): open the pause menu
    if (playing && !paused && overlay.style.display === "none") showPause();
  }
});

// ================= ULT CHARGE =================
function addUltCharge(amount) {
  if (ultPhase !== 0) return; // no charging while using the ult
  ultCharge = Math.min(current.ultCost, ultCharge + amount);
}

// ================= BOTS =================
const bots = [];
const enemyBullets = [];
const enemyBulletGeo = new THREE.SphereGeometry(0.2);

// Picks a spawn point far away from everyone
function pickSpawn() {
  let best = SPAWNS[0];
  let bestD = -1;
  for (let k = 0; k < 6; k++) {
    const s = SPAWNS[Math.floor(Math.random() * SPAWNS.length)];
    let nearest = 999;
    if (playing && !dead) {
      nearest = Math.min(nearest, Math.hypot(s[0] - player.position.x, s[1] - player.position.z));
    }
    for (const b of bots) {
      if (b.alive) {
        nearest = Math.min(nearest, Math.hypot(s[0] - b.mesh.position.x, s[1] - b.mesh.position.z));
      }
    }
    if (nearest > bestD) {
      bestD = nearest;
      best = s;
    }
  }
  return best;
}

// Name + health bar above a head (one picture that gets redrawn)
function makeNameTag() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  spr.scale.set(2.6, 0.65, 1);
  return { spr, c, tex };
}

// Works for bots and for online players (anything with name, health, tagCanvas, tagTex)
function drawTag(bot) {
  const g = bot.tagCanvas.getContext("2d");
  g.clearRect(0, 0, 256, 64);
  g.font = "bold 26px sans-serif";
  g.textAlign = "center";
  g.textBaseline = "top";
  g.lineWidth = 5;
  g.strokeStyle = "#000";
  g.strokeText(bot.name, 128, 2);
  g.fillStyle = "#fff";
  g.fillText(bot.name, 128, 2);
  g.fillStyle = "#000";
  g.fillRect(28, 38, 200, 16);
  g.fillStyle = "#2ecc40";
  g.fillRect(30, 40, 196 * Math.max(0, bot.health / (bot.maxHealth || BOT_HEALTH)), 12);
  bot.tagTex.needsUpdate = true;
}

function makeBot(i) {
  const color = BOT_COLORS[i % BOT_COLORS.length];
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 2, 1),
    new THREE.MeshStandardMaterial({ color })
  );
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 12), skinMat);
  head.position.y = 1.4;
  mesh.add(head);
  const tag = makeNameTag();
  tag.spr.position.y = 1.9;
  mesh.add(tag.spr);
  scene.add(mesh);

  const bot = {
    name: BOT_NAMES[i % BOT_NAMES.length],
    color,
    mesh,
    tagCanvas: tag.c,
    tagTex: tag.tex,
    bulletMat: new THREE.MeshBasicMaterial({ color }),
    health: BOT_HEALTH,
    alive: false,
    kills: 0,
    target: null,
    canSee: false,
    retarget: Math.random() * 0.3,
    strafe: 1,
    strafeTimer: 1,
    seenFor: 0,
    nextBurst: 0,
    shotsLeft: 0,
    nextShot: 0,
    respawnAt: 0,
    flash: 0,
  };
  bots.push(bot);
  respawnBot(bot);
}

function respawnBot(bot) {
  const s = pickSpawn();
  bot.mesh.position.set(s[0], 1, s[1]);
  bot.health = BOT_HEALTH;
  bot.alive = true;
  bot.mesh.visible = true;
  bot.target = null;
  bot.canSee = false;
  bot.seenFor = 0;
  bot.shotsLeft = 0;
  bot.nextBurst = 0;
  drawTag(bot);
}

function clearBots() {
  for (const b of bots) scene.remove(b.mesh);
  bots.length = 0;
  for (const eb of enemyBullets) scene.remove(eb);
  enemyBullets.length = 0;
}

function startBotMode() {
  leaveOnline();
  clearBots();
  for (let i = 0; i < BOT_COUNT; i++) makeBot(i);
  kills = 0;
  deaths = 0;
  inMatch = false;
  paused = false;
  lastAttacker = null;
  updateStats();
  setHelp();
  modeOverlay.style.display = "none";
  showTeacherScreen();
}

makeModeCard(
  "FIGHT BOTS",
  BOT_COUNT + " bots roam the field. Everyone fights everyone, bots included.",
  true,
  startBotMode
);
makeModeCard(
  "PLAY ONLINE",
  "Everyone who joins fights on one map. Free for all.",
  true,
  () => startOnline({ room: "PUBLIC" })
);
makeModeCard(
  "PRIVATE ROOM",
  "Create a room and share the 4-letter code, or join a friend's room.",
  true,
  () => {
    privMsg.textContent = "";
    modeOverlay.style.display = "none";
    privateOverlay.style.display = "flex";
  }
);

// A target is either the player or a bot
function posOf(e) {
  return e === player ? player.position : e.mesh.position;
}
function isAlive(e) {
  return e === player ? !dead : e.alive;
}

// attacker = "player", a bot, or nothing. how = "banned", "beam", or nothing.
function damageBot(bot, amount, how, attacker) {
  if (!bot.alive) return;
  const dealt = Math.min(amount, bot.health);
  if (attacker === "player") {
    addUltCharge(dealt * current.ultPerDamage);
    if (dealt > 0) hitmarker(false);
  }
  bot.health -= amount;
  bot.flash = 0.08;
  if (bot.health <= 0) {
    bot.health = 0;
    bot.alive = false;
    bot.mesh.visible = false;
    bot.respawnAt = performance.now() / 1000 + BOT_RESPAWN;
    if (attacker === "player") {
      kills++;
      addUltCharge(current.ultPerKill);
      refillApples();
      hitmarker(true);
      siphon();
      showKillBanner(bot.name, how); // elimination banner
      addFeed("You", bot.name, how);
    } else if (attacker && attacker.name) {
      attacker.kills++;
      addFeed(attacker.name, bot.name, how);
    }
    updateStats();
  }
  drawTag(bot);
}

function botShoot(bot, dx, dz) {
  const e = (Math.random() - 0.5) * 2 * BOT_AIM_ERROR; // bots are not perfect
  const c = Math.cos(e);
  const s = Math.sin(e);
  const dir = new THREE.Vector3(dx * c - dz * s, 0, dx * s + dz * c);
  const b = new THREE.Mesh(enemyBulletGeo, bot.bulletMat);
  const p = bot.mesh.position;
  b.position.set(p.x + dir.x * 0.8, 1.5, p.z + dir.z * 0.8);
  b.userData = { dir, life: 130, owner: bot, damage: BOT_DAMAGE };
  scene.add(b);
  enemyBullets.push(b);
}

function updateBots(dt, t) {
  for (const bot of bots) {
    if (!bot.alive) {
      if (t >= bot.respawnAt) respawnBot(bot);
      continue;
    }
    const pos = bot.mesh.position;
    bot.flash = Math.max(0, bot.flash - dt);
    bot.mesh.material.color.setHex(bot.flash > 0 ? 0xffffff : bot.color);

    // forget a target that died
    if (bot.target && !isAlive(bot.target)) {
      bot.target = null;
      bot.canSee = false;
    }

    // look for the nearest enemy a few times per second
    bot.retarget -= dt;
    if (bot.retarget <= 0) {
      bot.retarget = 0.25 + Math.random() * 0.15;
      const list = [];
      if (!dead) list.push(player);
      for (const o of bots) if (o !== bot && o.alive) list.push(o);

      let seenBest = null;
      let seenD = 1e9;
      let anyBest = null;
      let anyD = 1e9;
      for (const e of list) {
        const p = posOf(e);
        const d = Math.hypot(p.x - pos.x, p.z - pos.z);
        if (d < anyD) {
          anyD = d;
          anyBest = e;
        }
        if (d < BOT_VIEW && d < seenD && hasLineOfSight(pos, p)) {
          seenD = d;
          seenBest = e;
        }
      }
      const newTarget = seenBest || anyBest;
      bot.canSee = !!seenBest;
      if (newTarget !== bot.target) {
        bot.target = newTarget;
        bot.seenFor = 0;
      }
    }

    const target = bot.target;
    if (!target) continue;

    const tp = posOf(target);
    let dx = tp.x - pos.x;
    let dz = tp.z - pos.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    dx /= dist;
    dz /= dist;
    bot.mesh.rotation.y = Math.atan2(-dx, -dz); // face the target

    // movement: chase if far or can't see, back off if too close, always strafe
    bot.strafeTimer -= dt;
    if (bot.strafeTimer <= 0) {
      bot.strafe = Math.random() < 0.5 ? -1 : 1;
      bot.strafeTimer = 0.7 + Math.random() * 1.3;
    }
    let mx = 0;
    let mz = 0;
    if (!bot.canSee || dist > 18) {
      mx += dx;
      mz += dz;
    } else if (dist < 8) {
      mx -= dx;
      mz -= dz;
    }
    mx += -dz * bot.strafe * 0.8;
    mz += dx * bot.strafe * 0.8;
    const len = Math.hypot(mx, mz) || 1;
    const bslow = bot.slowUntil > t ? 0.5 : 1;
    pos.x += (mx / len) * BOT_SPEED * dt * bslow;
    pos.z += (mz / len) * BOT_SPEED * dt * bslow;

    // don't stack on top of other bots
    for (const o of bots) {
      if (o === bot || !o.alive) continue;
      const ox = pos.x - o.mesh.position.x;
      const oz = pos.z - o.mesh.position.z;
      const od = Math.hypot(ox, oz);
      if (od < 1.4 && od > 0.001) {
        pos.x += (ox / od) * 0.05;
        pos.z += (oz / od) * 0.05;
      }
    }
    pos.x = Math.max(-48, Math.min(48, pos.x));
    pos.z = Math.max(-48, Math.min(48, pos.z));
    pushOutOfWalls(pos);

    // shooting: wait a moment after spotting someone, then fire bursts
    if (bot.canSee && dist < BOT_VIEW) {
      bot.seenFor += dt;
      if (bot.shotsLeft > 0) {
        if (t >= bot.nextShot) {
          botShoot(bot, dx, dz);
          bot.shotsLeft--;
          bot.nextShot = t + BOT_SHOT_GAP;
        }
      } else if (bot.seenFor > BOT_REACTION && t >= bot.nextBurst) {
        bot.shotsLeft = BOT_SHOTS;
        bot.nextShot = t;
        bot.nextBurst = t + BOT_BURST_DELAY + Math.random() * 0.8;
      }
    } else {
      bot.seenFor = 0;
      bot.shotsLeft = 0;
    }
  }
}

// ================= ONLINE =================
function netSend(obj) {
  if (net && net.ws && net.ws.readyState === 1) net.ws.send(JSON.stringify(obj));
}

// Tells the other players about an effect (their screens show it, damage is separate)
function netFx(k, a) {
  if (mode === "online") netSend({ t: "fx", k, a });
}

function nameOf(id) {
  if (net && id === net.id) return "You";
  const r = remotes.get(id);
  return r ? r.name : "Someone";
}

const REMOTE_COLORS = [0xe74c3c, 0x3498db, 0xf39c12, 0x1abc9c, 0xe91e63, 0x2ecc71, 0x9b59b6, 0xff7f50];

function addRemote(p) {
  removeRemote(p.id);
  const color = REMOTE_COLORS[p.id % REMOTE_COLORS.length];
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 2, 1),
    new THREE.MeshStandardMaterial({ color })
  );
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 12), skinMat);
  head.position.y = 1.4;
  mesh.add(head);
  const tag = makeNameTag();
  tag.spr.position.y = 1.9;
  mesh.add(tag.spr);
  const hammer = makeHammer();
  hammer.position.set(0.8, 0.1, -0.2);
  mesh.add(hammer);
  const hive = makeHive();
  hive.position.set(0.8, 0.1, -0.2);
  mesh.add(hive);
  const beeGun = makeBeeGun();
  mesh.add(beeGun);
  const shieldG = makeShield(1.5);
  scene.add(shieldG);
  mesh.position.set(p.x, p.y || 1, p.z);
  mesh.visible = p.alive !== false;
  scene.add(mesh);

  const r = {
    id: p.id,
    name: p.name,
    color,
    mesh,
    hammer,
    hive,
    beeGun,
    beeStart: 0,
    head,
    char: "mahoney",
    spr: null,
    ty: p.y || 1,
    shieldG,
    tagCanvas: tag.c,
    tagTex: tag.tex,
    health: p.hp,
    maxHealth: p.max,
    alive: p.alive !== false,
    tx: p.x,
    tz: p.z,
    yaw: p.yaw || 0,
    curYaw: p.yaw || 0,
    shield: false,
    flash: 0,
    swingStart: 0,
  };
  remotes.set(p.id, r);
  drawTag(r);

  setRemoteChar(r, p.char || "mahoney");
  updateRoomHud();
}

function setRemoteChar(r, key) {
  if (!characters[key]) key = "mahoney";
  r.char = key;
  if (r.spr) {
    r.mesh.remove(r.spr);
    r.spr = null;
  }
  r.mesh.material.visible = true;
  r.head.visible = true;
  texLoader.load(characters[key].picture, (t) => {
    if (remotes.get(r.id) !== r || r.char !== key) return;
    t.colorSpace = THREE.SRGBColorSpace;
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, alphaTest: 0.05 }));
    spr.scale.set(BODY_HEIGHT * (t.image.width / t.image.height), BODY_HEIGHT, 1);
    spr.position.y = BODY_HEIGHT / 2 - 1;
    r.mesh.add(spr);
    r.spr = spr;
    r.mesh.material.visible = false;
    r.head.visible = false;
  });
}

function removeRemote(id) {
  const r = remotes.get(id);
  if (!r) return;
  scene.remove(r.mesh);
  scene.remove(r.shieldG);
  clearRemoteMines(id);
  remotes.delete(id);
  updateRoomHud();
}

// Smoothly slides other players toward where the server says they are
function updateRemotes(dt, now) {
  const k = 1 - Math.exp(-dt * 14);
  for (const r of remotes.values()) {
    r.mesh.visible = r.alive;
    if (!r.alive) {
      r.shieldG.visible = false;
      continue;
    }
    const p = r.mesh.position;
    p.x += (r.tx - p.x) * k;
    p.z += (r.tz - p.z) * k;
    p.y += (r.ty - p.y) * k;
    let d = r.yaw - r.curYaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    r.curYaw += d * k;
    r.mesh.rotation.y = r.curYaw;

    r.flash = Math.max(0, r.flash - dt);
    r.mesh.material.color.setHex(r.flash > 0 ? 0xffffff : r.color);

    r.shieldG.visible = r.shield;
    if (r.shield) {
      r.shieldG.position.set(p.x - Math.sin(r.curYaw) * 1.6, 1.4, p.z - Math.cos(r.curYaw) * 1.6);
      r.shieldG.rotation.y = r.curYaw;
    }

    poseBeeGun(r.beeGun, r.beeStart > 0 ? (now - r.beeStart) / 650 : 2, 0.75, 0.2, -0.45);
    if (r.swingStart > 0) {
      const t = (now - r.swingStart) / MELEE_TIME;
      const tool = r.char === "applebee" ? r.hive : r.hammer;
      if (t >= 1) {
        r.swingStart = 0;
        r.hammer.visible = false;
        r.hive.visible = false;
      } else {
        tool.visible = true;
        tool.rotation.x = swingAngle(t, 0.2, 1.0, -1.9);
      }
    }
  }
}

function leaveOnline() {
  const n = net;
  net = null;
  mode = "bots";
  if (n && n.ws) {
    try {
      n.ws.close();
    } catch (e) {}
  }
  for (const r of remotes.values()) {
    scene.remove(r.mesh);
    scene.remove(r.shieldG);
  }
  remotes.clear();
  roomHud.style.display = "none";
  statusOverlay.style.display = "none";
  setHelp();
}

function failOnline(msg) {
  const j = net && net.join;
  goToModes();
  if (j && j.room && j.room !== "PUBLIC") {
    modeOverlay.style.display = "none";
    privateOverlay.style.display = "flex";
    privMsg.textContent = msg;
  } else {
    modeMsg.textContent = msg;
  }
}

function startOnline(join) {
  if (SERVER_URL.includes("YOUR-SERVER-NAME")) {
    const msg = "Online isn't set up yet: put your Render address into config.js.";
    modeMsg.textContent = msg;
    privMsg.textContent = msg;
    return;
  }
  leaveOnline();
  clearBots();
  mode = "online";
  setHelp();
  kills = 0;
  deaths = 0;
  inMatch = false;
  paused = false;
  lastAttacker = null;
  updateStats();
  modeOverlay.style.display = "none";
  privateOverlay.style.display = "none";

  const myNet = { ws: null, id: null, code: "", ready: false, join, old: false };
  net = myNet;
  let tries = 0;

  function attempt() {
    if (net !== myNet) return;
    tries++;
    showStatus(
      "Connecting to the server... (try " + tries + "). The free server falls asleep when nobody is playing, so waking it up can take about a minute."
    );
    let ws;
    try {
      ws = new WebSocket(SERVER_URL);
    } catch (e) {
      failOnline("The server address in config.js isn't valid.");
      return;
    }
    myNet.ws = ws;
    ws.onopen = () => ws.send(JSON.stringify(Object.assign({ t: "join", name: myName }, join)));
    ws.onmessage = (ev) => {
      if (net !== myNet) return;
      let m;
      try {
        m = JSON.parse(ev.data);
      } catch (e) {
        return;
      }
      handleNet(m);
    };
    ws.onclose = () => {
      if (net !== myNet) return;
      if (!myNet.id) {
        if (tries < 25) setTimeout(attempt, 3000); // server is probably still waking up
        else failOnline("Could not reach the server. Try again in a minute.");
      } else {
        failOnline("Lost connection to the server.");
      }
    };
    ws.onerror = () => {};
  }
  attempt();
}

function handleNet(m) {
  switch (m.t) {
    case "welcome": {
      net.id = m.id;
      net.code = m.code;
      net.old = m.v !== SERVER_VERSION; // the server is running an older server.js
      for (const p of m.players) addRemote(p);
      statusOverlay.style.display = "none";
      inMatch = false;
      showTeacherScreen(); // pick your teacher
      updateRoomHud();
      break;
    }
    case "joined": {
      addRemote(m.p);
      addFeedText(m.p.name + " joined");
      break;
    }
    case "left": {
      const r = remotes.get(m.id);
      if (r) addFeedText(r.name + " left");
      removeRemote(m.id);
      break;
    }
    case "st": {
      for (const s of m.p) {
        if (s.id === net.id) continue;
        const r = remotes.get(s.id);
        if (!r || !r.alive) continue;
        r.tx = s.x;
        r.tz = s.z;
        r.yaw = s.yaw;
        r.shield = !!s.sh;
        if (s.y !== undefined) r.ty = s.y;
      }
      break;
    }
    case "fx": {
      handleFx(m);
      break;
    }
    case "hp": {
      if (m.by === net.id) {
        addUltCharge(m.dealt * current.ultPerDamage);
        if (m.dealt > 0) hitmarker(false);
      }
      if (m.id === net.id) {
        playerHealth = m.hp;
        bonusShield = m.bonus || 0;
        maxHealth = m.max;
        updateHealthBar();
      } else {
        const r = remotes.get(m.id);
        if (r) {
          r.health = m.hp;
          r.maxHealth = m.max;
          if (m.dealt > 0) r.flash = 0.08;
          drawTag(r);
        }
      }
      break;
    }
    case "kill": {
      const kName = nameOf(m.killer);
      const vName = nameOf(m.victim);
      if (m.killer === net.id) {
        kills++;
        addUltCharge(current.ultPerKill);
        refillApples();
        hitmarker(true);
        showKillBanner(vName, m.how); // elimination banner
        addFeedText("SIPHON: full health + " + BONUS_SHIELD + " blue shield");
        addFeed("You", vName, m.how);
      } else if (m.victim === net.id) {
        deaths++;
        dead = true;
        clearMines();
        dashFrames = 0;
        addFeed(kName, "You", m.how);
        deathMsg.textContent = "ELIMINATED BY " + kName.toUpperCase() + " - respawning...";
        deathMsg.style.display = "block";
        showPlayerModel();
      } else {
        addFeed(kName, vName, m.how);
      }
      const rv = remotes.get(m.victim);
      if (rv) {
        rv.alive = false;
        rv.shield = false;
        clearRemoteMines(m.victim);
      }
      updateStats();
      break;
    }
    case "respawn": {
      if (m.id === net.id) {
        player.position.set(m.x, 1, m.z);
        playerHealth = m.hp;
        bonusShield = m.bonus || 0;
        maxHealth = m.max;
        dead = false;
        deathMsg.style.display = "none";
        showPlayerModel();
        updateHealthBar();
      } else {
        const r = remotes.get(m.id);
        if (r) {
          r.alive = true;
          r.health = m.hp;
          r.maxHealth = m.max;
          r.tx = m.x;
          r.tz = m.z;
          r.mesh.position.set(m.x, 1, m.z);
          r.ty = 1;
          if (m.char && r.char !== m.char) setRemoteChar(r, m.char);
          drawTag(r);
        }
      }
      break;
    }
    case "slow": {
      const nowS = performance.now();
      if (nowS >= slowUntil) addFeedText("SLOWED!");
      slowUntil = Math.max(slowUntil, nowS + (m.ms || 2000));
      break;
    }
    case "error": {
      failOnline(m.msg || "Could not join.");
      break;
    }
  }
}

// Shows other players' phones, grenades and beams on your screen (visual only)
function handleFx(m) {
  const r = remotes.get(m.id);
  if (!r) return;
  const a = m.a || [];
  if (m.k === "p") fireBurst(a[0], a[1], a[2], a[3], characters.mahoney, true, a[4] === undefined ? 1 : a[4]);
  else if (m.k === "g") spawnGrenade(a[0], a[1], a[2], a[3], a[4], a[5], true);
  else if (m.k === "b") spawnBeam(new THREE.Vector3(a[0], a[1], a[2]), new THREE.Vector3(a[3], a[4], a[5]));
  else if (m.k === "u") addFeedText(r.name + " is BALDING!");
  else if (m.k === "h") r.swingStart = performance.now();
  else if (m.k === "a") spawnAppleFx(new THREE.Vector3(a[0], a[1], a[2]), new THREE.Vector3(a[3], a[4], a[5]));
  else if (m.k === "m") {
    const arr = remoteMines.get(m.id) || [];
    arr.push(makeMineMesh(a[0], a[1], a[2]));
    if (arr.length > 3) scene.remove(arr.shift());
    remoteMines.set(m.id, arr);
  } else if (m.k === "x") {
    const arr = remoteMines.get(m.id) || [];
    let bi = -1, bd = 2;
    arr.forEach((g, i) => {
      const d = Math.hypot(g.position.x - a[0], g.position.z - a[2]);
      if (d < bd) { bd = d; bi = i; }
    });
    if (bi >= 0) {
      scene.remove(arr[bi]);
      arr.splice(bi, 1);
      boomAt(new THREE.Vector3(a[0], a[1] + 0.5, a[2]), 2.5);
    }
  } else if (m.k === "c") clearRemoteMines(m.id);
  else if (m.k === "v") {
    r.beeStart = performance.now();
    spawnBeeFx(new THREE.Vector3(a[0], a[1], a[2]), new THREE.Vector3(a[3], a[4], a[5]));
  } else if (m.k === "z") {
    addZone(a[0], a[1], a[2], a[3], a[4], false);
    boomAt(new THREE.Vector3(a[0], a[1] + 0.5, a[2]), a[3], 0xffd23f);
  }
}

// ================= MR. MAHONEY: PHONE BURST =================
const bullets = [];
const PHONE_SIZE = 0.9; // length of the flying phone
const PHONE_SPIN = 0.4; // spin speed: 0 = no spin

// fx = true means it is another player's phone: it flies but does no damage on your screen
function fireBurst(px, pz, yw, pt, ch, fx, py = 1) {
  for (let i = 0; i < ch.burst; i++) {
    // Even spread: the phones fan out with the same gap every time
    const offset = (i - (ch.burst - 1) / 2) * ch.spread;
    const angle = yw + offset;

    const dir = new THREE.Vector3(
      -Math.sin(angle) * Math.cos(pt),
      Math.sin(pt),
      -Math.cos(angle) * Math.cos(pt)
    );

    const b = new THREE.Mesh(phoneGeo, phoneMat);
    b.scale.set(PHONE_SIZE * phoneAspect, PHONE_SIZE, 1);
    b.position.set(px + dir.x * 0.7, py + 0.5 + dir.y * 0.7, pz + dir.z * 0.7);
    // Lay the phone flat like a thrown card
    b.rotation.set(-Math.PI / 2 + pt, angle, 0, "YXZ");

    b.userData.dir = dir;
    b.userData.damage = ch.damage;
    b.userData.fx = !!fx;
    b.userData.life = 100;
    scene.add(b);
    bullets.push(b);
  }
}

// Where the crosshair is really pointing (in third person the camera is behind and above you,
// so shots must be aimed at the spot the camera ray hits, not just where your body faces)
function aimDirection(eye) {
  const o = camera.getWorldPosition(new THREE.Vector3());
  const f = camera.getWorldDirection(new THREE.Vector3());
  let dist = 120;
  const p = new THREE.Vector3();
  for (let d = 0.5; d < 120; d += 0.5) {
    p.copy(o).addScaledVector(f, d);
    if (p.y < 0 || insideWall(p)) { dist = d; break; }
  }
  const test = (pos) => {
    const v = new THREE.Vector3().subVectors(pos, o);
    const t = v.dot(f);
    if (t > 0 && t < dist && o.clone().addScaledVector(f, t).distanceTo(pos) < 1.2) dist = t;
  };
  for (const bot of bots) if (bot.alive) test(bot.mesh.position);
  for (const r of remotes.values()) if (r.alive) test(r.mesh.position);
  const aim = o.clone().addScaledVector(f, dist);
  const dir = aim.sub(eye);
  if (dir.length() < 1.5) return f;
  return dir.normalize();
}

function shoot() {
  viewKick = 1; // hand recoil in first person
  const eye = new THREE.Vector3(player.position.x, player.position.y + 0.7, player.position.z);
  const ad = aimDirection(eye);
  const ay = Math.atan2(-ad.x, -ad.z);
  const ap = Math.asin(Math.max(-1, Math.min(1, ad.y)));
  fireBurst(player.position.x, player.position.z, ay, ap, current, false, player.position.y);
  netFx("p", [player.position.x, player.position.z, ay, ap, player.position.y]);
}

function tryShoot() {
  if (!playing || dead || paused || ultPhase !== 0 || shieldUp || meleeStart > 0) return;
  if (!document.pointerLockElement) return;
  const now = performance.now();
  if (now - lastShot < current.fireDelay) return;
  if (current.kind === "applebee") {
    if (appleReload > 0 || appleAmmo <= 0) return;
    lastShot = now;
    fireApple();
    return;
  }
  lastShot = now;
  shoot();
}

// ================= MR. MAHONEY: DASH (Q) =================
const DASH_FRAMES = 8; // how many frames the dash lasts
const dashDir = new THREE.Vector3();

const trails = [];
const trailGeo = new THREE.SphereGeometry(0.45, 8, 8);
function addTrailPuff(pos) {
  const m = new THREE.Mesh(
    trailGeo,
    new THREE.MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0.7 })
  );
  m.position.set(pos.x, 1, pos.z);
  m.userData.life = 30;
  scene.add(m);
  trails.push(m);
}

function dash() {
  if (performance.now() - lastDash < current.dashCooldown) return;
  lastDash = performance.now();

  // Dash the way you are MOVING (not where you look)
  const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  dashDir.set(0, 0, 0);
  if (keys.KeyW) dashDir.add(forward);
  if (keys.KeyS) dashDir.sub(forward);
  if (keys.KeyD) dashDir.add(right);
  if (keys.KeyA) dashDir.sub(right);
  if (dashDir.lengthSq() === 0) dashDir.copy(forward); // standing still: dash the way you face
  dashDir.normalize();
  dashFrames = DASH_FRAMES;
}

// ================= MR. MAHONEY: PHONE GRENADE (E) =================
const grenades = [];
const GRENADE_SIZE = 1.4; // size of the thrown phone

function spawnGrenade(x, y, z, vx, vy, vz, fx) {
  const g = new THREE.Mesh(phoneGeo, phoneMat);
  g.scale.set(GRENADE_SIZE * phoneAspect, GRENADE_SIZE, 1);
  g.position.set(x, y, z);
  g.userData.vel = new THREE.Vector3(vx, vy, vz);
  g.userData.fx = !!fx;
  scene.add(g);
  grenades.push(g);
}

function throwGrenade() {
  if (performance.now() - lastGrenade < current.grenadeCooldown) return;
  lastGrenade = performance.now();
  if (current.kind === "applebee") {
    placeMine();
    return;
  }
  throwAnim = 1; // arm throw in first person
  const x = player.position.x - Math.sin(yaw) * 0.8;
  const z = player.position.z - Math.cos(yaw) * 0.8;
  // look up = throws farther, look down = throws shorter
  const vx = -Math.sin(yaw) * 0.3;
  const vy = 0.2 + pitch * 0.25;
  const vz = -Math.cos(yaw) * 0.3;
  const gy = player.position.y + 0.8;
  spawnGrenade(x, gy, z, vx, vy, vz, false);
  netFx("g", [x, gy, z, vx, vy, vz]);
}

function explode(pos, fx) {
  const boom = new THREE.Mesh(
    new THREE.SphereGeometry(current.grenadeRadius, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.5 })
  );
  boom.position.copy(pos);
  scene.add(boom);
  setTimeout(() => scene.remove(boom), 250);
  if (fx) return; // another player's grenade: just the picture, they send the damage

  for (const bot of bots) {
    if (!bot.alive) continue;
    const dx = bot.mesh.position.x - pos.x;
    const dz = bot.mesh.position.z - pos.z;
    if (Math.hypot(dx, dz) < current.grenadeRadius + 0.5) {
      damageBot(bot, current.grenadeDamage, undefined, "player");
    }
  }
  for (const r of remotes.values()) {
    if (!r.alive) continue;
    const dx = r.mesh.position.x - pos.x;
    const dz = r.mesh.position.z - pos.z;
    if (Math.hypot(dx, dz) < current.grenadeRadius + 0.5) {
      netSend({ t: "hit", target: r.id, k: "grenade" });
    }
  }
}

// ================= MR. MAHONEY: BAN HAMMER (V) =================
function melee() {
  const now = performance.now();
  if (now - lastMelee < current.meleeCooldown || meleeStart > 0) return;
  lastMelee = now;
  meleeStart = now;
  meleeHit = false;
  netFx("h", []);
}

// Called in the middle of the swing: one shots anything in front of him
function meleeStrike() {
  const hv = current.kind === "applebee";
  for (const bot of bots) {
    if (!bot.alive) continue;
    const dx = bot.mesh.position.x - player.position.x;
    const dz = bot.mesh.position.z - player.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > current.meleeRange) continue;
    const dot = (dx * -Math.sin(yaw) + dz * -Math.cos(yaw)) / Math.max(dist, 0.001);
    if (dist > 1.0 && dot < 0.4) continue; // must be in front of you
    damageBot(bot, hv ? current.meleeDamage : ONE_SHOT, hv ? "hive" : "banned", "player");
    if (hv) bot.slowUntil = performance.now() / 1000 + current.slowMs / 1000;
  }
  for (const r of remotes.values()) {
    if (!r.alive) continue;
    const dx = r.mesh.position.x - player.position.x;
    const dz = r.mesh.position.z - player.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > current.meleeRange) continue;
    const dot = (dx * -Math.sin(yaw) + dz * -Math.cos(yaw)) / Math.max(dist, 0.001);
    if (dist > 1.0 && dot < 0.4) continue;
    netSend({ t: "hit", target: r.id, k: hv ? "hive" : "hammer" });
  }
}

// ================= MR. MAHONEY: ULT "BALDING" (X) =================
const beams = [];
const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 12, 1, true);

function startUlt() {
  if (current.kind === "applebee") {
    addFeedText("Ms. Applebee has no ult yet");
    return;
  }
  if (ultPhase !== 0 || ultCharge < current.ultCost) return;
  ultPhase = 1; // bald head close-up
  ultStart = performance.now();
  beamsLeft = current.ultBeams;
  dashFrames = 0;
  mouseHeld = false;
  rightHeld = false;
  meleeStart = 0;
  showPlayerModel();
  crosshair.style.display = "none";
  ultText.style.cssText = ULT_TEXT_BIG; // "Balding" in rainbow
  headGlow.visible = true;
  flash(0.7, 600);
  netFx("u", []);
}

function beginAiming() {
  ultPhase = 2; // first person, ready to fire
  ultAimStart = performance.now();
  lastBeam = performance.now() - ULT_BEAM_DELAY + 600; // short wait before the first beam
  showPlayerModel();
  headGlow.visible = false;
  crosshair.style.cssText = CROSS_ULT;
  crosshair.style.display = "block";
  ultText.style.cssText = ULT_TEXT_SMALL;
  ultVignette.style.display = "block";
  beamsHud.style.display = "block";
  updateBeamsHud();
  flash(0.9, 500);
}

function endUlt() {
  ultPhase = 0;
  ultCharge = 0;
  showPlayerModel();
  headGlow.visible = false;
  crosshair.style.cssText = CROSS_NORMAL;
  crosshair.style.display = "block";
  ultText.style.display = "none";
  ultVignette.style.display = "none";
  beamsHud.style.display = "none";
}

function spawnBeam(origin, target) {
  const dir = new THREE.Vector3().subVectors(target, origin);
  const len = dir.length();
  dir.normalize();
  const g = new THREE.Group();
  const outer = new THREE.Mesh(
    beamGeo,
    new THREE.MeshBasicMaterial({
      color: 0xffe27a, transparent: true, opacity: 0.6,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    })
  );
  outer.scale.set(0.25, len, 0.25);
  const core = new THREE.Mesh(
    beamGeo,
    new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 1,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    })
  );
  core.scale.set(0.1, len, 0.1);
  g.add(outer, core);
  g.position.copy(origin).addScaledVector(dir, len / 2);
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  g.userData.life = BEAM_LIFE;
  scene.add(g);
  beams.push(g);
}

// Fires one beam from his head along where you are aiming (goes through walls, like Sova's ult)
function fireBeam() {
  const now = performance.now();
  if (ultPhase !== 2 || beamsLeft <= 0 || now - lastBeam < ULT_BEAM_DELAY) return;
  lastBeam = now;
  beamsLeft--;
  updateBeamsHud();

  const f = new THREE.Vector3(
    -Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    -Math.cos(yaw) * Math.cos(pitch)
  );
  const up = new THREE.Vector3(
    Math.sin(yaw) * Math.sin(pitch),
    Math.cos(pitch),
    Math.cos(yaw) * Math.sin(pitch)
  );
  const eye = new THREE.Vector3(player.position.x, player.position.y + 0.7, player.position.z);
  const target = eye.clone().addScaledVector(f, 90);
  // beam starts above your eyes (his head) and lines up on the crosshair
  const origin = eye.clone().addScaledVector(up, 0.5).addScaledVector(f, 1.0);
  spawnBeam(origin, target);
  netFx("b", [origin.x, origin.y, origin.z, target.x, target.y, target.z]);

  // damage everything on the line
  for (const bot of bots) {
    if (!bot.alive) continue;
    const v = new THREE.Vector3().subVectors(bot.mesh.position, eye);
    const t = v.dot(f);
    if (t > 0 && t < 90) {
      const closest = eye.clone().addScaledVector(f, t);
      if (closest.distanceTo(bot.mesh.position) < BEAM_HIT_RADIUS) {
        damageBot(bot, current.ultDamage, "beam", "player");
      }
    }
  }
  for (const r of remotes.values()) {
    if (!r.alive) continue;
    const v = new THREE.Vector3().subVectors(r.mesh.position, eye);
    const t = v.dot(f);
    if (t > 0 && t < 90) {
      const closest = eye.clone().addScaledVector(f, t);
      if (closest.distanceTo(r.mesh.position) < BEAM_HIT_RADIUS) {
        netSend({ t: "hit", target: r.id, k: "beam" });
      }
    }
  }
  flash(0.45, 250);
  shake = 1;
}

// ================= MS. APPLEBEE =================
let appleAspect = 1;
function makeAppleCanvas() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = "#d62828";
  g.beginPath(); g.arc(64, 72, 46, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#ff7b7b";
  g.beginPath(); g.arc(48, 56, 12, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#5a3a1a"; g.fillRect(61, 16, 6, 18);
  g.fillStyle = "#3a9d23";
  g.beginPath(); g.ellipse(82, 24, 18, 8, -0.5, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const appleSprMat = new THREE.SpriteMaterial({ map: makeAppleCanvas(), transparent: true });
const appleMeshMat = new THREE.MeshBasicMaterial({ map: appleSprMat.map, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide });
texLoader.load("apple.png", (t) => {
  t.colorSpace = THREE.SRGBColorSpace;
  appleAspect = t.image.width / t.image.height;
  appleSprMat.map = t; appleSprMat.needsUpdate = true;
  appleMeshMat.map = t; appleMeshMat.needsUpdate = true;
});

let appleAmmo = 6;
let appleReload = 0; // 0 = not reloading, otherwise the time the reload ends
let slowUntil = 0;

// 6 apples circling her (third person)
const orbitApples = [];
for (let i = 0; i < 6; i++) {
  const sp = new THREE.Sprite(appleSprMat);
  sp.visible = false;
  player.add(sp);
  orbitApples.push(sp);
}

// Beehive (melee)
function makeHive() {
  const g = new THREE.Group();
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.0, 8), new THREE.MeshStandardMaterial({ color: 0x6b3f1d }));
  rope.position.y = 0.5;
  g.add(rope);
  const radii = [0.35, 0.5, 0.45, 0.3];
  for (let i = 0; i < 4; i++) {
    const seg = new THREE.Mesh(
      new THREE.SphereGeometry(radii[i], 14, 10),
      new THREE.MeshStandardMaterial({ color: i % 2 ? 0x5a3a10 : 0xe0a526 })
    );
    seg.scale.y = 0.65;
    seg.position.y = 1.0 + i * 0.3;
    g.add(seg);
  }
  const hole = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), new THREE.MeshStandardMaterial({ color: 0x111111 }));
  hole.position.set(0, 1.35, -0.42);
  g.add(hole);
  g.visible = false;
  return g;
}
const hiveTP = makeHive();
hiveTP.position.set(0.8, 0.1, -0.2);
player.add(hiveTP);
const hiveFP = makeHive();
hiveFP.scale.setScalar(0.5);
hiveFP.position.set(0.35, -0.5, -0.7);
viewRoot.add(hiveFP);

function resetApples() {
  appleAmmo = current.apples || 6;
  appleReload = 0;
  slowUntil = 0;
  lastBee = -99999;
  beeAnimStart = 0;
  clearMines();
  clearZones();
  viewPhoneImg.material = current.kind === "applebee" ? appleMeshMat : phoneMat;
}
function refillApples() {
  if (current.kind !== "applebee") return;
  appleAmmo = current.apples;
  appleReload = 0;
}

// Apple flying to where the shot landed (the hit itself is instant)
const appleFx = [];
function spawnAppleFx(from, to) {
  const sp = new THREE.Sprite(appleSprMat);
  sp.scale.set(0.6 * appleAspect, 0.6, 1);
  sp.position.copy(from);
  scene.add(sp);
  appleFx.push({ sp, from, to, t0: performance.now() });
}

function fireApple() {
  const now = performance.now();
  appleAmmo--;
  viewKick = 1;
  const eye = new THREE.Vector3(player.position.x, player.position.y + 0.7, player.position.z);
  const f = aimDirection(eye);
  let wall = 120;
  const p = new THREE.Vector3();
  for (let d = 0.5; d < 120; d += 0.5) {
    p.copy(eye).addScaledVector(f, d);
    if (p.y < 0 || insideWall(p)) { wall = d; break; }
  }
  const cand = [];
  for (const bot of bots) if (bot.alive) cand.push({ bot, pos: bot.mesh.position });
  for (const r of remotes.values()) if (r.alive) cand.push({ r, pos: r.mesh.position });
  let best = null;
  let bestT = wall;
  for (const c of cand) {
    const v = new THREE.Vector3().subVectors(c.pos, eye);
    const t = v.dot(f);
    if (t <= 0 || t >= bestT) continue;
    if (eye.clone().addScaledVector(f, t).distanceTo(c.pos) < 1.1) { best = c; bestT = t; }
  }
  const end = eye.clone().addScaledVector(f, bestT);
  const origin = eye.clone().addScaledVector(f, 0.8);
  spawnAppleFx(origin, end);
  netFx("a", [origin.x, origin.y, origin.z, end.x, end.y, end.z]);
  if (best) playAppleHit();
  if (best && best.bot) damageBot(best.bot, current.appleDamage, "apple", "player");
  else if (best && best.r) netSend({ t: "hit", target: best.r.id, k: "apple" });
  if (appleAmmo <= 0 && appleReload === 0) appleReload = now + current.reloadMs;
}

// Landmines
const mines = [];
const remoteMines = new Map();
function makeMineMesh(x, y, z) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.7, 1.1, 24),
    new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.6, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;
  g.add(ring);
  const sp = new THREE.Sprite(appleSprMat);
  sp.scale.set(0.7 * appleAspect, 0.7, 1);
  sp.position.y = 0.45;
  g.add(sp);
  g.position.set(x, y, z);
  scene.add(g);
  return g;
}
function boomAt(pos, radius, color = 0xff3b3b) {
  const boom = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 16, 16),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5 })
  );
  boom.position.copy(pos);
  scene.add(boom);
  setTimeout(() => scene.remove(boom), 250);
}
function placeMine() {
  let x = player.position.x - Math.sin(yaw) * 1.2;
  let z = player.position.z - Math.cos(yaw) * 1.2;
  const feet = player.position.y - 1;
  if (insideWall({ x, y: feet + 0.5, z })) { x = player.position.x; z = player.position.z; }
  const y = groundAt(x, z, feet);
  while (mines.length >= current.maxMines) {
    const old = mines.shift();
    scene.remove(old.g);
    netFx("x", [old.x, old.y, old.z]);
  }
  mines.push({ g: makeMineMesh(x, y, z), x, y, z, armAt: performance.now() + 700 });
  netFx("m", [x, y, z]);
}
function clearMines() {
  if (mines.length === 0) return;
  for (const m of mines) scene.remove(m.g);
  mines.length = 0;
  netFx("c", []);
}
function clearRemoteMines(id) {
  const arr = remoteMines.get(id);
  if (arr) for (const g of arr) scene.remove(g);
  remoteMines.delete(id);
}
function checkMines(now) {
  if (!playing || dead || current.kind !== "applebee") return;
  for (let i = mines.length - 1; i >= 0; i--) {
    const m = mines[i];
    if (now < m.armAt) continue;
    const near = (p, r) => Math.hypot(p.x - m.x, p.z - m.z) < r && Math.abs(p.y - 1 - m.y) < 1.8;
    let trig = false;
    for (const bot of bots) if (bot.alive && near(bot.mesh.position, 1.4)) trig = true;
    for (const r of remotes.values()) if (r.alive && near(r.mesh.position, 1.4)) trig = true;
    if (!trig) continue;
    mines.splice(i, 1);
    scene.remove(m.g);
    boomAt(new THREE.Vector3(m.x, m.y + 0.5, m.z), 2.5);
    netFx("x", [m.x, m.y, m.z]);
    for (const bot of bots) if (bot.alive && near(bot.mesh.position, 2.5)) damageBot(bot, current.mineDamage, "mine", "player");
    for (const r of remotes.values()) if (r.alive && near(r.mesh.position, 2.5)) netSend({ t: "hit", target: r.id, k: "mine" });
  }
}

// ----- Bee gun (right click) + sticky yellow zone -----
let lastBee = -99999;
const beeShotGeo = new THREE.SphereGeometry(0.22, 8, 8);
const beeShotMat = new THREE.MeshBasicMaterial({ color: 0xffd23f });
const beeSwarm = [];
const beeBodyGeo = new THREE.SphereGeometry(0.11, 6, 6);
const beeDarkMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
// A swarm of little bees spirals along the shot, with a glowing core in the middle
function spawnBeeFx(from, to) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = dir.length();
  dir.normalize();
  const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0));
  if (right.lengthSq() < 0.01) right.set(1, 0, 0);
  right.normalize();
  const up = new THREE.Vector3().crossVectors(right, dir).normalize();
  const bees = [];
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(beeBodyGeo, i % 2 ? beeDarkMat : beeShotMat);
    scene.add(m);
    bees.push(m);
  }
  beeSwarm.push({ bees, from, to, right, up, t0: performance.now(), dur: Math.max(140, Math.min(320, len * 5)) });
  const core = new THREE.Mesh(beeShotGeo, beeShotMat);
  core.scale.setScalar(1.3);
  core.position.copy(from);
  scene.add(core);
  appleFx.push({ sp: core, from, to, t0: performance.now() });
}

// ----- Bee gun model + animation (first person, third person, other players) -----
let beeAnimStart = 0;
function makeBeeGun() {
  const g = new THREE.Group();
  const yellow = new THREE.MeshStandardMaterial({ color: 0xf5c518 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2a2a });
  const amber = new THREE.MeshStandardMaterial({ color: 0xe0a526 });
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.9, 12), yellow);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = -0.35;
  g.add(barrel);
  for (const z of [-0.1, -0.35, -0.6]) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.07, 12), dark);
    band.rotation.x = Math.PI / 2;
    band.position.z = z;
    g.add(band);
  }
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.08, 0.15, 12), dark);
  nozzle.rotation.x = Math.PI / 2;
  nozzle.position.z = -0.85;
  g.add(nozzle);
  const radii = [0.2, 0.17, 0.12];
  for (let i = 0; i < 3; i++) {
    const seg = new THREE.Mesh(new THREE.SphereGeometry(radii[i], 10, 8), i % 2 ? dark : amber);
    seg.scale.y = 0.7;
    seg.position.set(0, 0.18 + i * 0.15, -0.1);
    g.add(seg);
  }
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.28, 0.1), dark);
  grip.position.set(0, -0.2, 0.05);
  g.add(grip);
  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), skinMat);
  hand.position.set(0, -0.32, 0.05);
  g.add(hand);
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.85 })
  );
  flash.position.z = -1.0;
  flash.visible = false;
  g.add(flash);
  g.userData.flash = flash;
  g.visible = false;
  return g;
}
// p = 0..1 progress of the animation: gun pops up, kicks back with a muzzle flash, lowers away
function poseBeeGun(gun, p, bx, by, bz) {
  if (p < 0 || p >= 1) {
    gun.visible = false;
    return;
  }
  const e = p < 0.1 ? p / 0.1 : p > 0.75 ? (1 - p) / 0.25 : 1;
  const kick = Math.max(0, 1 - p / 0.35);
  const rc = kick * kick;
  gun.visible = true;
  gun.position.set(bx, by - (1 - e) * 0.5, bz + rc * 0.18);
  gun.rotation.x = -(1 - e) * 0.9 + rc * 0.35;
  const fl = gun.userData.flash;
  fl.visible = p < 0.14;
  fl.scale.setScalar(0.6 + (1 - p / 0.14) * 0.9);
}
const beeGunTP = makeBeeGun();
player.add(beeGunTP);
const beeGunFP = makeBeeGun();
beeGunFP.scale.setScalar(0.6);
viewRoot.add(beeGunFP);

const zones = [];
function makeZoneMesh(x, y, z, r) {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(r, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd400, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false })
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.06;
  g.add(disc);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(r - 0.25, r, 32),
    new THREE.MeshBasicMaterial({ color: 0xff9d00, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.07;
  g.add(ring);
  g.position.set(x, y, z);
  g.userData.disc = disc;
  scene.add(g);
  return g;
}
function addZone(x, y, z, r, durMs, owner) {
  zones.push({ g: makeZoneMesh(x, y, z, r), x, y, z, r, until: performance.now() + durMs, owner, hit: new Set(), nextSlow: 0 });
}
function clearZones() {
  for (const zn of zones) if (zn.owner) { scene.remove(zn.g); }
  for (let i = zones.length - 1; i >= 0; i--) if (zones[i].owner) zones.splice(i, 1);
}
function updateZones(now) {
  const active = playing && !dead && current.kind === "applebee";
  for (let i = zones.length - 1; i >= 0; i--) {
    const zn = zones[i];
    const left = zn.until - now;
    if (left <= 0) {
      scene.remove(zn.g);
      zones.splice(i, 1);
      continue;
    }
    zn.g.userData.disc.material.opacity = Math.min(0.45, (left / 1000) * 0.45) * (0.85 + 0.15 * Math.sin(now / 150));
    if (!zn.owner || !active) continue;
    const inside = (p) => Math.hypot(p.x - zn.x, p.z - zn.z) < zn.r && Math.abs(p.y - 1 - zn.y) < 2;
    const doSlow = now >= zn.nextSlow;
    if (doSlow) zn.nextSlow = now + 300;
    for (const bot of bots) {
      if (!bot.alive || !inside(bot.mesh.position)) continue;
      bot.slowUntil = now / 1000 + 0.6;
      if (!zn.hit.has(bot)) {
        zn.hit.add(bot);
        damageBot(bot, current.zoneDamage, "bee", "player"); // the zone's one tick of damage
      }
    }
    for (const r of remotes.values()) {
      if (!r.alive || !inside(r.mesh.position)) continue;
      if (!zn.hit.has(r.id)) {
        zn.hit.add(r.id);
        netSend({ t: "hit", target: r.id, k: "beezone" });
      } else if (doSlow) netSend({ t: "hit", target: r.id, k: "beeslow" });
    }
  }
}

function fireBeeGun() {
  const now = performance.now();
  if (now - lastBee < current.beeCooldown) return;
  lastBee = now;
  beeAnimStart = now;
  viewKick = 1;
  const eye = new THREE.Vector3(player.position.x, player.position.y + 0.7, player.position.z);
  const f = aimDirection(eye);
  let wall = 120;
  const p = new THREE.Vector3();
  for (let d = 0.5; d < 120; d += 0.5) {
    p.copy(eye).addScaledVector(f, d);
    if (p.y < 0 || insideWall(p)) { wall = d; break; }
  }
  const cand = [];
  for (const bot of bots) if (bot.alive) cand.push({ bot, pos: bot.mesh.position });
  for (const r of remotes.values()) if (r.alive) cand.push({ r, pos: r.mesh.position });
  let bestT = wall;
  let hitTarget = false;
  for (const c of cand) {
    const t = new THREE.Vector3().subVectors(c.pos, eye).dot(f);
    if (t <= 0 || t >= bestT) continue;
    if (eye.clone().addScaledVector(f, t).distanceTo(c.pos) < 1.1) { bestT = t; hitTarget = true; }
  }
  if (!hitTarget) bestT = Math.max(1, bestT - 0.4); // stop just in front of a wall / the ground
  const end = eye.clone().addScaledVector(f, bestT);
  end.y = Math.max(0.2, end.y);
  const origin = eye.clone().addScaledVector(f, 0.8);
  spawnBeeFx(origin, end);
  netFx("v", [origin.x, origin.y, origin.z, end.x, end.y, end.z]);
  playBeeShot();

  const gy = groundAt(end.x, end.z, end.y);
  boomAt(end, current.beeRadius, 0xffd23f);
  addZone(end.x, gy, end.z, current.beeRadius, current.zoneSeconds * 1000, true);
  netFx("z", [end.x, gy, end.z, current.beeRadius, current.zoneSeconds * 1000]);

  // medium explosion: everyone close to where it landed takes the full 50
  for (const bot of bots) {
    if (bot.alive && bot.mesh.position.distanceTo(end) < current.beeRadius + 0.8) {
      damageBot(bot, current.beeDamage, "bee", "player");
    }
  }
  for (const r of remotes.values()) {
    if (r.alive && r.mesh.position.distanceTo(end) < current.beeRadius + 0.8) {
      netSend({ t: "hit", target: r.id, k: "bee" });
    }
  }
}

// Per-frame: reload timer, circling apples, flying apple pictures
function updateApples(now) {
  if (appleReload > 0 && now >= appleReload) {
    appleAmmo = current.apples || 6;
    appleReload = 0;
  }
  const on = current.kind === "applebee" && !dead && !isFirstPerson();
  for (let i = 0; i < 6; i++) {
    const sp = orbitApples[i];
    sp.visible = on && i < appleAmmo;
    const a = now / 700 + (i * Math.PI * 2) / 6;
    sp.position.set(Math.cos(a) * 1.3, 0.1 + Math.sin(now / 400 + i) * 0.1, Math.sin(a) * 1.3);
    sp.scale.set(0.55 * appleAspect, 0.55, 1);
  }
  for (let i = beeSwarm.length - 1; i >= 0; i--) {
    const sw = beeSwarm[i];
    const t = (now - sw.t0) / sw.dur;
    if (t >= 1) {
      for (const b of sw.bees) scene.remove(b);
      beeSwarm.splice(i, 1);
      continue;
    }
    sw.bees.forEach((b, k) => {
      const tt = Math.max(0, t - k * 0.012);
      b.position.lerpVectors(sw.from, sw.to, tt);
      const a = tt * 14 + k * 0.9;
      const rad = 0.35 + 0.25 * Math.sin(k + tt * 20);
      b.position.addScaledVector(sw.right, Math.cos(a) * rad).addScaledVector(sw.up, Math.sin(a) * rad);
    });
  }
  for (let i = appleFx.length - 1; i >= 0; i--) {
    const f = appleFx[i];
    const t = (now - f.t0) / 130;
    if (t >= 1) {
      scene.remove(f.sp);
      appleFx.splice(i, 1);
    } else f.sp.position.lerpVectors(f.from, f.to, t);
  }
}

// ================= CROSSHAIR, HITMARKERS, SOUNDS =================
const hitMark = document.createElement("div");
hitMark.style.cssText = "position:fixed;left:50%;top:50%;width:0;height:0;z-index:6;pointer-events:none;opacity:0;";
const hitBars = [];
for (const ang of [45, 135, 225, 315]) {
  // four diagonal ticks around the crosshair = an X with the middle left open
  const bar = document.createElement("div");
  bar.style.cssText =
    "position:absolute;left:0;top:0;width:11px;height:3px;transform-origin:0 0;transform:rotate(" + ang + "deg) translate(10px,-1.5px);box-shadow:0 0 0 1px #000;";
  hitMark.appendChild(bar);
  hitBars.push(bar);
}
document.body.appendChild(hitMark);
let hitMarkTimer = 0;
function hitmarker(kill) {
  const col = kill ? "#ff1e1e" : "#ffffff";
  for (const b of hitBars) b.style.background = col;
  const sc = kill ? 2.6 : 1;
  hitMark.style.transition = "none";
  hitMark.style.transform = "scale(" + sc * 1.3 + ")";
  hitMark.style.opacity = "1";
  void hitMark.offsetWidth;
  hitMark.style.transition = "opacity 0.35s, transform 0.2s";
  hitMark.style.transform = "scale(" + sc + ")";
  clearTimeout(hitMarkTimer);
  hitMarkTimer = setTimeout(() => (hitMark.style.opacity = "0"), kill ? 450 : 150);
  if (kill) playKillSound();
}
function updateCrosshair() {
  if (ultPhase === 2) return; // the ult has its own gold ring
  crosshair.style.display = playing && !dead && !paused && ultPhase === 0 ? "block" : "none";
}

// Little synthesized sounds (no sound files needed)
let audioCtx = null;
function getAudio() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
  } catch (e) { return null; }
  return audioCtx;
}
function tone(freq, freq2, dur, type, vol, delay) {
  const ac = getAudio();
  if (!ac) return;
  const t = ac.currentTime + (delay || 0);
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(freq2, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g);
  g.connect(ac.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}
// Mr. Mahoney: a card landing on someone ("thwip" + bright double ding)
let lastCardSound = 0;
function playCardHit() {
  const now = performance.now();
  if (now - lastCardSound < 50) return; // three cards at once = one sound
  lastCardSound = now;
  tone(900, 300, 0.07, "square", 0.08, 0);
  tone(1568, 1568, 0.18, "triangle", 0.14, 0.01);
  tone(2093, 2093, 0.22, "triangle", 0.1, 0.07);
}
// Ms. Applebee: a sharp, crisp "tick-ting" when an apple lands (short noise snap + high ping)
function playAppleHit() {
  const ac = getAudio();
  if (!ac) return;
  const n = Math.floor(ac.sampleRate * 0.025);
  const buf = ac.createBuffer(1, n, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const hp = ac.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 3000;
  const g = ac.createGain();
  g.gain.value = 0.5;
  src.connect(hp);
  hp.connect(g);
  g.connect(ac.destination);
  src.start();
  tone(3400, 2600, 0.07, "triangle", 0.16, 0);
  tone(5200, 4400, 0.05, "sine", 0.09, 0.004);
}
function playBeeShot() {
  tone(150, 70, 0.28, "sawtooth", 0.12, 0);
  tone(520, 180, 0.14, "square", 0.05, 0.02);
  tone(95, 60, 0.35, "sawtooth", 0.1, 0.12);
}
function playKillSound() {
  tone(220, 80, 0.25, "sawtooth", 0.14, 0);
  tone(1318, 1318, 0.3, "triangle", 0.12, 0.05);
}

// ================= GAME LOOP =================
let lastFrame = performance.now();

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;

  // Ult charges up just by playing
  if (playing && !dead && ultPhase === 0) addUltCharge(current.ultPassivePerSec * dt);

  // Ult phases
  if (ultPhase === 1 && now - ultStart >= ULT_CUTSCENE_MS) beginAiming();
  if (
    ultPhase === 2 &&
    (now - ultAimStart > ULT_AIM_MS || (beamsLeft <= 0 && now - lastBeam > 900))
  ) {
    endUlt();
  }

  // Shield is up while you hold right click
  shieldUp =
    playing && !dead && !paused && current.shieldBlock > 0 && ultPhase === 0 && rightHeld && meleeStart === 0 && !!document.pointerLockElement;

  // Movement (not while the Esc menu is open)
  if (playing && !dead && !paused && ultPhase === 0) {
    const moveSpeed = (shieldUp ? speed * current.shieldSpeed : speed) * (now < slowUntil ? 0.5 : 1);
    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    if (keys.KeyW) player.position.addScaledVector(forward, moveSpeed);
    if (keys.KeyS) player.position.addScaledVector(forward, -moveSpeed);
    if (keys.KeyD) player.position.addScaledVector(right, moveSpeed);
    if (keys.KeyA) player.position.addScaledVector(right, -moveSpeed);

    // Dash glide + red trail
    if (dashFrames > 0) {
      dashFrames--;
      player.position.addScaledVector(dashDir, current.dashDistance / DASH_FRAMES);
      addTrailPuff({
        x: player.position.x - dashDir.x * 0.6,
        z: player.position.z - dashDir.z * 0.6,
      });
    }

    player.position.x = Math.max(-48, Math.min(48, player.position.x));
    player.position.z = Math.max(-48, Math.min(48, player.position.z));

    // Hold the mouse to keep shooting
    if (mouseHeld) tryShoot();
  }
  pushOutOfWalls(player.position, player.position.y - 1, STEP_HEIGHT);
  physicsStep(dt, playing && !dead && !paused && ultPhase === 0);
  checkPads(now);
  player.rotation.y = yaw;

  // Online: tell the server where you are (20 times a second)
  if (mode === "online" && net && net.ready && playing && !dead && now - lastNetSend > NET_RATE) {
    lastNetSend = now;
    netSend({
      t: "st",
      x: +player.position.x.toFixed(2),
      z: +player.position.z.toFixed(2),
      y: +player.position.y.toFixed(2),
      yaw: +yaw.toFixed(3),
      pitch: +pitch.toFixed(3),
      sh: shieldUp ? 1 : 0,
      inv: ultPhase !== 0 ? 1 : 0,
    });
  }

  // Bots think and move (only while you are in the match)
  if (playing) updateBots(dt, now / 1000);

  // Other online players
  updateRemotes(dt, now);
  updateApples(now);
  updateZones(now);
  updateCrosshair();
  checkMines(now);

  // Ban hammer swing
  if (meleeStart > 0) {
    const t = (now - meleeStart) / MELEE_TIME;
    if (!meleeHit && t >= 0.55) {
      meleeHit = true;
      meleeStrike();
    }
    if (t >= 1) {
      meleeStart = 0;
    } else {
      const hvA = current.kind === "applebee";
      (hvA ? hiveTP : hammerTP).rotation.x = swingAngle(t, 0.2, 1.0, -1.9);
      (hvA ? hiveFP : hammerFP).rotation.x = swingAngle(t, 0.1, 0.5, -1.4);
    }
  }
  const swinging = meleeStart > 0;
  const hvB = current.kind === "applebee";
  hammerTP.visible = swinging && !hvB;
  hammerFP.visible = swinging && !hvB;
  hiveTP.visible = swinging && hvB;
  hiveFP.visible = swinging && hvB;
  const beeP = beeAnimStart > 0 ? (now - beeAnimStart) / 650 : 2;
  const fpB = isFirstPerson();
  poseBeeGun(beeGunFP, fpB ? beeP : 2, 0.32, -0.3, -0.6);
  poseBeeGun(beeGunTP, fpB ? 2 : beeP, 0.75, 0.2, -0.45);

  // First person hands / shield
  const fp = isFirstPerson();
  viewRoot.visible = playing && !dead && fp;
  viewPhone.visible = ultPhase === 0 && !swinging && !(beeP < 1);
  shieldFP.visible = shieldUp;
  shieldWorld.visible = shieldUp && !fp;
  shieldDiscMat.opacity = 0.3 + 0.08 * Math.sin(now / 120);
  if (shieldUp && !fp) {
    shieldWorld.position.set(
      player.position.x - Math.sin(yaw) * 1.6,
      player.position.y + 0.4,
      player.position.z - Math.cos(yaw) * 1.6
    );
    shieldWorld.rotation.y = yaw;
  }

  // Phone in his hand: recoil when shooting, arm swing when throwing
  viewKick *= 0.8;
  throwAnim *= 0.88;
  viewPhone.position.set(
    PHONE_VIEW.x,
    PHONE_VIEW.y + throwAnim * 0.25,
    PHONE_VIEW.z + viewKick * 0.1 - throwAnim * 0.1
  );
  viewPhone.rotation.x = throwAnim * 0.9 + viewKick * 0.15;
  viewPhoneImg.scale.set(0.34 * (current.kind === "applebee" ? appleAspect : phoneAspect), 0.34, 1);

  // Fade out the dash trail
  for (let i = trails.length - 1; i >= 0; i--) {
    const t = trails[i];
    t.userData.life--;
    const k = t.userData.life / 30;
    t.material.opacity = 0.7 * k;
    t.scale.setScalar(0.4 + k * 0.6);
    if (t.userData.life <= 0) {
      scene.remove(t);
      t.material.dispose();
      trails.splice(i, 1);
    }
  }

  // Fade out ult beams
  for (let i = beams.length - 1; i >= 0; i--) {
    const g = beams[i];
    g.userData.life--;
    const k = g.userData.life / BEAM_LIFE;
    g.children[0].material.opacity = 0.6 * k;
    g.children[1].material.opacity = k;
    const w = 0.3 + 0.7 * k;
    g.children[0].scale.x = g.children[0].scale.z = 0.25 * w;
    g.children[1].scale.x = g.children[1].scale.z = 0.1 * w;
    if (g.userData.life <= 0) {
      scene.remove(g);
      g.children[0].material.dispose();
      g.children[1].material.dispose();
      beams.splice(i, 1);
    }
  }

  // Phones (yours do damage, other players' phones are just for show)
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.position.addScaledVector(b.userData.dir, 0.8);
    b.rotation.z += PHONE_SPIN; // card spin

    if (!b.userData.fx) {
      let hitBot = null;
      for (const bot of bots) {
        if (bot.alive && b.position.distanceTo(bot.mesh.position) < 1.2) {
          hitBot = bot;
          break;
        }
      }
      if (hitBot) {
        playCardHit();
        damageBot(hitBot, b.userData.damage, undefined, "player");
        scene.remove(b);
        bullets.splice(i, 1);
        continue;
      }

      let hitRemote = null;
      for (const r of remotes.values()) {
        if (r.alive && b.position.distanceTo(r.mesh.position) < 1.2) {
          hitRemote = r;
          break;
        }
      }
      if (hitRemote) {
        playCardHit();
        netSend({ t: "hit", target: hitRemote.id, k: "phone" });
        scene.remove(b);
        bullets.splice(i, 1);
        continue;
      }
    }

    b.userData.life--;
    if (b.userData.life <= 0 || b.position.y < 0 || insideWall(b.position)) {
      scene.remove(b);
      bullets.splice(i, 1);
    }
  }

  // Grenades (explode on a player, a wall, or the ground)
  for (let i = grenades.length - 1; i >= 0; i--) {
    const g = grenades[i];
    g.userData.vel.y -= 0.012;
    g.position.add(g.userData.vel);
    g.rotation.x += 0.25;
    g.rotation.z += 0.2;
    let hitSomething = false;
    if (!g.userData.fx) {
      for (const bot of bots) {
        if (bot.alive && g.position.distanceTo(bot.mesh.position) < 1.4) {
          hitSomething = true;
          break;
        }
      }
      if (!hitSomething) {
        for (const r of remotes.values()) {
          if (r.alive && g.position.distanceTo(r.mesh.position) < 1.4) {
            hitSomething = true;
            break;
          }
        }
      }
    }
    if (hitSomething || g.position.y <= 0.2 || insideWall(g.position)) {
      explode(g.position, g.userData.fx);
      scene.remove(g);
      grenades.splice(i, 1);
    }
  }

  // Bot bullets (they can hit you and other bots)
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const eb = enemyBullets[i];
    eb.position.addScaledVector(eb.userData.dir, BOT_BULLET_SPEED);

    let used = false;
    if (playing && !dead && eb.position.distanceTo(player.position) < 1.2) {
      damagePlayer(eb.userData.damage, eb.userData.owner);
      used = true;
    } else {
      for (const bot of bots) {
        if (
          bot.alive &&
          bot !== eb.userData.owner &&
          eb.position.distanceTo(bot.mesh.position) < 1.2
        ) {
          damageBot(bot, eb.userData.damage, undefined, eb.userData.owner);
          used = true;
          break;
        }
      }
    }
    if (used) {
      scene.remove(eb);
      enemyBullets.splice(i, 1);
      continue;
    }

    eb.userData.life--;
    if (eb.userData.life <= 0 || insideWall(eb.position)) {
      scene.remove(eb);
      enemyBullets.splice(i, 1);
    }
  }

  // Ability text
  if (current.kind === "applebee") {
    abilityHud.innerHTML =
      (appleReload > 0
        ? "RELOADING " + Math.max(0, (appleReload - now) / 1000).toFixed(1) + "s"
        : "Apples: " + appleAmmo + "/" + current.apples) +
      "<br>" +
      cooldownText("Bee Gun", "Right Click", lastBee, current.beeCooldown) +
      "<br>" +
      cooldownText("Landmine", "E", lastGrenade, current.grenadeCooldown) +
      " [" + mines.length + "/" + current.maxMines + " placed]" +
      "<br>Beehive (V): READY" +
      (now < slowUntil ? "<br>SLOWED!" : "");
  } else
  abilityHud.innerHTML =
    cooldownText("Dash", "Q", lastDash, current.dashCooldown) +
    "<br>" +
    cooldownText("Grenade", "E", lastGrenade, current.grenadeCooldown) +
    "<br>" +
    "Shield (Right Click): " + (shieldUp ? "UP" : "hold") +
    "<br>" +
    cooldownText("Ban Hammer", "V", lastMelee, current.meleeCooldown);

  // Ult bar
  const ultPct = Math.floor((ultCharge / current.ultCost) * 100);
  const ultReady = ultPct >= 100;
  ultFill.style.width = ultPct + "%";
  ultFill.className = ultReady || ultPhase !== 0 ? "rainbow" : "ultGold";
  if (current.kind === "applebee") ultLabel.textContent = "ULT: coming soon";
  else if (ultPhase !== 0) ultLabel.textContent = "BALDING!";
  else if (ultReady) ultLabel.textContent = "ULT READY - PRESS X";
  else ultLabel.textContent = "ULT " + ultPct + "%";

  // Red screen edges while dashing
  dashFxLevel = dashFrames > 0 ? 1 : dashFxLevel * 0.85;
  dashFx.style.opacity = dashFxLevel;

  // Camera
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  if (ultPhase === 1) {
    // 2nd person: camera in front of him, pushing in on his bald head
    const t = Math.min(1, (now - ultStart) / ULT_CUTSCENE_MS);
    const ease = t * t * (3 - 2 * t);
    const headY = player.position.y + headLocalY;
    const p = new THREE.Vector3();
    for (let dist = 4.2 - 2.0 * ease; dist > 1.2; dist -= 0.4) {
      p.set(
        player.position.x - Math.sin(yaw) * dist,
        headY + 0.1,
        player.position.z - Math.cos(yaw) * dist
      );
      if (!insideWall(p)) break; // pull the camera in if a wall is in the way
    }
    camera.position.copy(p);
    camera.lookAt(player.position.x, headY, player.position.z);
    const s = 0.6 + 4.5 * ease + 0.25 * Math.sin(now / 60);
    headGlow.scale.set(s, s, 1);
  } else if (fp) {
    // first person: camera at his eyes
    shake *= 0.85;
    camera.position.set(
      player.position.x + (Math.random() - 0.5) * shake * 0.08,
      player.position.y + 0.7 + (Math.random() - 0.5) * shake * 0.08,
      player.position.z
    );
    camera.lookAt(
      camera.position.x - Math.sin(yaw) * cp * 20,
      camera.position.y + sp * 20,
      camera.position.z - Math.cos(yaw) * cp * 20
    );
  } else {
    // third person: camera sits behind the player (scroll wheel zooms)
    camDist += (camDistTarget - camDist) * 0.15;
    const aimY = player.position.y + 0.5;
    const cpos = new THREE.Vector3();
    for (let d = camDist; d > 1.5; d -= 0.5) {
      cpos.set(
        player.position.x + Math.sin(yaw) * cp * d,
        Math.max(0.5, aimY + 1.5 - sp * d),
        player.position.z + Math.cos(yaw) * cp * d
      );
      if (!insideWall(cpos)) break; // slide the camera forward if a wall is behind you
    }
    camera.position.copy(cpos);
    camera.lookAt(
      player.position.x - Math.sin(yaw) * cp * 20,
      aimY + sp * 20,
      player.position.z - Math.cos(yaw) * cp * 20
    );
  }

  // Zoom: wider when dashing, tighter during the ult
  let fovTarget = 75;
  if (ultPhase === 1) fovTarget = 50;
  else if (ultPhase === 2) fovTarget = 60;
  else if (dashFrames > 0) fovTarget = 95;
  if (Math.abs(camera.fov - fovTarget) > 0.1) {
    camera.fov += (fovTarget - camera.fov) * 0.2;
    camera.updateProjectionMatrix();
  }

  renderer.render(scene, camera);
}
animate();
