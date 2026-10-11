import * as THREE from "three";
//==================Online settingsJews=====
const SERVER_URL = "wss://my-game.onrender.com";
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

// ----- Bleachers (decoration, outside the side fences) -----
const bleacherColors = [0x9aa3ad, 0x7b858f];
function makeBleachers(side) {
  // side: -1 = left, 1 = right
  for (let i = 0; i < 8; i++) {
    const h = 1.2 * (i + 1); // each row is taller than the one before
    const row = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, h, 60),
      new THREE.MeshStandardMaterial({ color: bleacherColors[i % 2] })
    );
    row.position.set(side * (24.8 + i * 1.6), h / 2, 0);
    scene.add(row);
  }
}
makeBleachers(-1);
makeBleachers(1);

// ----- Walls and cover -----
// x/z = center, w = width, d = depth, h = height (default 6), color = hex
// Add  photo: "hall.jpg"  to any wall to put a photo on it.
const walls = [
  // fences around the field (side fences are low so you can see the bleachers)
  { x: -23, z: 0, w: 2, d: 96, h: 2.5, color: 0x444444 },
  { x: 23, z: 0, w: 2, d: 96, h: 2.5, color: 0x444444 },
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

const wallBoxes = [];
for (const wall of walls) {
  const h = wall.h || 6;
  const mat = new THREE.MeshStandardMaterial({ color: wall.color || 0xd8d0c0 });
  if (wall.photo) addPhoto(mat, wall.photo, 1, 1);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(wall.w, h, wall.d), mat);
  mesh.position.set(wall.x, h / 2, wall.z);
  scene.add(mesh);
  wallBoxes.push({
    minX: wall.x - wall.w / 2,
    maxX: wall.x + wall.w / 2,
    minZ: wall.z - wall.d / 2,
    maxZ: wall.z + wall.d / 2,
    h: h,
  });
}

// Stops players and bots from walking through walls
function pushOutOfWalls(pos) {
  const r = 0.6;
  for (const b of wallBoxes) {
    if (pos.x > b.minX - r && pos.x < b.maxX + r && pos.z > b.minZ - r && pos.z < b.maxZ + r) {
      const left = pos.x - (b.minX - r);
      const right = b.maxX + r - pos.x;
      const up = pos.z - (b.minZ - r);
      const down = b.maxZ + r - pos.z;
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
    if (p.x > b.minX && p.x < b.maxX && p.z > b.minZ && p.z < b.maxZ && p.y < b.h) return true;
  }
  return false;
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
    ultPassivePerSec: 1, // charge from just playing
    ultPerDamage: 0.1, // charge per point of damage dealt
    ultPerKill: 10, // charge per kill
    ultDamage: 150, // damage per beam
    ultBeams: 3,
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
  const verb = how === "banned" ? "BANNED" : how === "beam" ? "BALDED" : "eliminated";
  const row = document.createElement("div");
  row.style.cssText =
    "background:rgba(0,0,0,0.6);color:#fff;padding:4px 10px;border-radius:4px;border-left:4px solid #ffd700;";
  row.textContent = killer + " " + verb + " " + victim;
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
  "position:fixed;top:50%;left:50%;width:8px;height:8px;margin:-4px 0 0 -4px;background:#fff;border:1px solid #000;border-radius:50%;";
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
helpText.textContent =
  "WASD move | Click shoot | Right-click shield | Q dash | E grenade | V hammer | X ult | 7 camera | C teacher";
helpText.style.cssText =
  "position:fixed;top:10px;width:100%;text-align:center;font:14px sans-serif;color:#fff;text-shadow:1px 1px 2px #000;";
document.body.appendChild(helpText);

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
  healthText.textContent = Math.ceil(playerHealth) + " / " + maxHealth;
}
updateHealthBar();

function cooldownText(label, key, last, cooldown) {
  const left = Math.ceil((cooldown - (performance.now() - last)) / 1000);
  return label + " (" + key + "): " + (left > 0 ? left + "s" : "READY");
}

// ================= MENUS =================
const MENU_STYLE =
  "position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:10;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:sans-serif;color:#fff;";

// ----- Mode select screen -----
const modeOverlay = document.createElement("div");
modeOverlay.style.cssText = MENU_STYLE;
modeOverlay.innerHTML = '<h1 style="margin:0 0 30px;font-size:42px;">CHOOSE A MODE</h1>';
const modeRow = document.createElement("div");
modeRow.style.cssText = "display:flex;gap:20px;";
modeOverlay.appendChild(modeRow);
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
  playing = false;
  clearBots();
  overlay.style.display = "none";
  modeOverlay.style.display = "flex";
  document.exitPointerLock();
});
overlay.appendChild(backBtn);
document.body.appendChild(overlay);

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
makeCard('<div style="font-size:24px;margin:80px 0;">Coming soon</div>', true);

function selectCharacter(key) {
  current = characters[key];
  player.material.color.setHex(current.color);
  loadBodyPicture(current.picture);
  maxHealth = current.health;
  playerHealth = maxHealth;
  speed = current.speed;
  lastShot = lastDash = lastGrenade = lastMelee = -99999;
  dashFrames = 0;
  meleeStart = 0;
  endUlt();
  ultCharge = current.ultStartCharge;
  dead = false;
  showPlayerModel();
  deathMsg.style.display = "none";
  player.position.set(0, 1, 0);
  updateHealthBar();
  overlay.style.display = "none";
  playing = true;
  renderer.domElement.requestPointerLock();
}

function openSelectScreen() {
  playing = false;
  overlay.style.display = "flex";
  document.exitPointerLock();
}

// ================= PLAYER DAMAGE / RESPAWN =================
function damagePlayer(amount, attacker) {
  if (dead || ultPhase !== 0) return; // can't be hurt while using the ult
  if (shieldUp) amount *= 1 - current.shieldBlock; // shield blocks 85%
  playerHealth -= amount;
  if (playerHealth <= 0) {
    playerHealth = 0;
    dead = true;
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

  // 7 = switch between first person and third person
  if ((e.code === "Digit7" || e.code === "Numpad7") && !e.repeat && ultPhase === 0) {
    firstPerson = !firstPerson;
    showPlayerModel();
  }

  if (!playing || dead || ultPhase !== 0 || e.repeat) return;
  if (e.code === "KeyQ") dash();
  if (e.code === "KeyE") throwGrenade();
  if (e.code === "KeyV") melee();
  if (e.code === "KeyX") startUlt();
  if (e.code === "KeyC") openSelectScreen();
});
addEventListener("keyup", (e) => (keys[e.code] = false));

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

renderer.domElement.addEventListener("click", () => {
  if (playing) renderer.domElement.requestPointerLock();
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
  if (!playing || dead || !document.pointerLockElement) return;
  if (e.button === 2) {
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

// Name + health bar above a bot's head (one picture that gets redrawn)
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
  g.fillRect(30, 40, 196 * Math.max(0, bot.health / BOT_HEALTH), 12);
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
  clearBots();
  for (let i = 0; i < BOT_COUNT; i++) makeBot(i);
  kills = 0;
  deaths = 0;
  updateStats();
  modeOverlay.style.display = "none";
  overlay.style.display = "flex";
}

makeModeCard(
  "FIGHT BOTS",
  BOT_COUNT + " bots roam the field. Everyone fights everyone, bots included.",
  true,
  startBotMode
);
makeModeCard(
  "PLAY ONLINE",
  "Everyone who joins fights on one map.<br><br><b>Coming next</b>",
  false
);
makeModeCard(
  "PRIVATE ROOM",
  "Join friends with a room code.<br><br><b>Coming next</b>",
  false
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
  if (attacker === "player") addUltCharge(dealt * current.ultPerDamage);
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
    pos.x += (mx / len) * BOT_SPEED * dt;
    pos.z += (mz / len) * BOT_SPEED * dt;

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

// ================= MR. MAHONEY: PHONE BURST =================
const bullets = [];
const PHONE_SIZE = 0.9; // length of the flying phone
const PHONE_SPIN = 0.4; // spin speed: 0 = no spin

function shoot() {
  viewKick = 1; // hand recoil in first person
  for (let i = 0; i < current.burst; i++) {
    // Even spread: the phones fan out with the same gap every time
    const offset = (i - (current.burst - 1) / 2) * current.spread;
    const angle = yaw + offset;

    const dir = new THREE.Vector3(
      -Math.sin(angle) * Math.cos(pitch),
      Math.sin(pitch),
      -Math.cos(angle) * Math.cos(pitch)
    );

    const b = new THREE.Mesh(phoneGeo, phoneMat);
    b.scale.set(PHONE_SIZE * phoneAspect, PHONE_SIZE, 1);
    b.position.set(
      player.position.x + dir.x * 0.7,
      1.5 + dir.y * 0.7,
      player.position.z + dir.z * 0.7
    );
    // Lay the phone flat like a thrown card
    b.rotation.set(-Math.PI / 2 + pitch, angle, 0, "YXZ");

    b.userData.dir = dir;
    b.userData.damage = current.damage;
    b.userData.life = 100;
    scene.add(b);
    bullets.push(b);
  }
}

function tryShoot() {
  if (!playing || dead || ultPhase !== 0 || shieldUp || meleeStart > 0) return;
  if (!document.pointerLockElement) return;
  const now = performance.now();
  if (now - lastShot < current.fireDelay) return;
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

function throwGrenade() {
  if (performance.now() - lastGrenade < current.grenadeCooldown) return;
  lastGrenade = performance.now();
  throwAnim = 1; // arm throw in first person
  const g = new THREE.Mesh(phoneGeo, phoneMat);
  g.scale.set(GRENADE_SIZE * phoneAspect, GRENADE_SIZE, 1);
  g.position.set(
    player.position.x - Math.sin(yaw) * 0.8,
    1.8,
    player.position.z - Math.cos(yaw) * 0.8
  );
  // look up = throws farther, look down = throws shorter
  g.userData.vel = new THREE.Vector3(
    -Math.sin(yaw) * 0.3,
    0.2 + pitch * 0.25,
    -Math.cos(yaw) * 0.3
  );
  scene.add(g);
  grenades.push(g);
}

function explode(pos) {
  const boom = new THREE.Mesh(
    new THREE.SphereGeometry(current.grenadeRadius, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.5 })
  );
  boom.position.copy(pos);
  scene.add(boom);
  setTimeout(() => scene.remove(boom), 250);

  for (const bot of bots) {
    if (!bot.alive) continue;
    const dx = bot.mesh.position.x - pos.x;
    const dz = bot.mesh.position.z - pos.z;
    if (Math.hypot(dx, dz) < current.grenadeRadius + 0.5) {
      damageBot(bot, current.grenadeDamage, undefined, "player");
    }
  }
}

// ================= MR. MAHONEY: BAN HAMMER (V) =================
function melee() {
  const now = performance.now();
  if (now - lastMelee < current.meleeCooldown) return;
  lastMelee = now;
  meleeStart = now;
  meleeHit = false;
}

// Called in the middle of the swing: one shots anything in front of him
function meleeStrike() {
  for (const bot of bots) {
    if (!bot.alive) continue;
    const dx = bot.mesh.position.x - player.position.x;
    const dz = bot.mesh.position.z - player.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > current.meleeRange) continue;
    const dot = (dx * -Math.sin(yaw) + dz * -Math.cos(yaw)) / Math.max(dist, 0.001);
    if (dist > 1.0 && dot < 0.4) continue; // must be in front of you
    damageBot(bot, ONE_SHOT, "banned", "player");
  }
}

// ================= MR. MAHONEY: ULT "BALDING" (X) =================
const beams = [];
const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 12, 1, true);

function startUlt() {
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
  flash(0.45, 250);
  shake = 1;
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
    playing && !dead && ultPhase === 0 && rightHeld && meleeStart === 0 && !!document.pointerLockElement;

  // Movement
  if (playing && !dead && ultPhase === 0) {
    const moveSpeed = shieldUp ? speed * current.shieldSpeed : speed;
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
  pushOutOfWalls(player.position);
  player.rotation.y = yaw;

  // Bots think and move (only while you are in the match)
  if (playing) updateBots(dt, now / 1000);

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
      hammerTP.rotation.x = swingAngle(t, 0.2, 1.0, -1.9);
      hammerFP.rotation.x = swingAngle(t, 0.1, 0.5, -1.4);
    }
  }
  const swinging = meleeStart > 0;
  hammerTP.visible = swinging;
  hammerFP.visible = swinging;

  // First person hands / shield
  const fp = isFirstPerson();
  viewRoot.visible = playing && !dead && fp;
  viewPhone.visible = ultPhase === 0 && !swinging;
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
  viewPhoneImg.scale.set(0.34 * phoneAspect, 0.34, 1);

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

  // Your phones
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.position.addScaledVector(b.userData.dir, 0.8);
    b.rotation.z += PHONE_SPIN; // card spin

    let hitBot = null;
    for (const bot of bots) {
      if (bot.alive && b.position.distanceTo(bot.mesh.position) < 1.2) {
        hitBot = bot;
        break;
      }
    }
    if (hitBot) {
      damageBot(hitBot, b.userData.damage, undefined, "player");
      scene.remove(b);
      bullets.splice(i, 1);
      continue;
    }

    b.userData.life--;
    if (b.userData.life <= 0 || b.position.y < 0 || insideWall(b.position)) {
      scene.remove(b);
      bullets.splice(i, 1);
    }
  }

  // Your grenades (explode on a bot, a wall, or the ground)
  for (let i = grenades.length - 1; i >= 0; i--) {
    const g = grenades[i];
    g.userData.vel.y -= 0.012;
    g.position.add(g.userData.vel);
    g.rotation.x += 0.25;
    g.rotation.z += 0.2;
    let hitBot = false;
    for (const bot of bots) {
      if (bot.alive && g.position.distanceTo(bot.mesh.position) < 1.4) {
        hitBot = true;
        break;
      }
    }
    if (hitBot || g.position.y <= 0.2 || insideWall(g.position)) {
      explode(g.position);
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
  if (ultPhase !== 0) ultLabel.textContent = "BALDING!";
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
    // third person: camera sits behind the player
    const aimY = player.position.y + 0.5;
    camera.position.set(
      player.position.x + Math.sin(yaw) * cp * 8,
      Math.max(0.5, aimY + 1.5 - sp * 8),
      player.position.z + Math.cos(yaw) * cp * 8
    );
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
