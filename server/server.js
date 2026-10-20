// Multiplayer server for the Canyon High game
const http = require("http");
const { WebSocketServer } = require("ws");

const SERVER_VERSION = 22; // protocol version; differing versions do not imply a stale deployment
// Shared arena dimensions: keep game.js and server.js in sync.
const MAP = { halfX: 74, halfZ: 88, limitX: 72, limitZ: 86 };
// Shared procedural Roundabout geometry. X=east, Z=south; north is -Z.
function createRoundaboutLayout() {
  const blocks = [], floors = [], chains = [], cones = [], arrows = [], signs = [], spawns = [];
  const rotate = (x, z, q) => q === 0 ? { x, z } : q === 1 ? { x: -z, z: x } : q === 2 ? { x: -x, z: -z } : { x: z, z: -x };
  function block(x,z,w,d,y0,h,color,kind='wall',q=0) {
    const p=rotate(x,z,q); blocks.push({x:p.x,z:p.z,w:q%2?d:w,d:q%2?w:d,y0,h,color,kind});
  }
  function floor(x,z,w,d,q=0) { const p=rotate(x,z,q);floors.push({x:p.x,z:p.z,w:q%2?d:w,d:q%2?w:d}); }
  function chain(a,b) {
    chains.push({a,b}); const length=Math.hypot(b.x-a.x,b.z-a.z), n=Math.ceil(length/0.35);
    for(let i=0;i<n;i++) {
      const t=(i+0.5)/n;
      // Visible chain corridor barrier: two chains, anchored by cones.
      block(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t,Math.abs(b.x-a.x)/n+0.09,Math.abs(b.z-a.z)/n+0.09,0,1.15,0x6d7880,'chain');
    }
  }
  function cone(x,z) {cones.push({x,z});block(x,z,0.55,0.55,0,1.15,0xff701f,'cone');}
  function arrow(x,z,dx,dz,q=0) {const p=rotate(x,z,q),dir=rotate(dx,dz,q);arrows.push({...p,dx:dir.x,dz:dir.z});}
  floor(0,0,24,24);
  const names=['NORTH','EAST','SOUTH','WEST'];
  for(let q=0;q<4;q++) {
    floor(0,-27,12,30,q); floor(15,-27,18,18,q);
    block(-6,-27,0.4,30,0,6.4,0xe5e1d8,'wall',q);
    block(6,-35.5,0.4,13,0,6.4,0xe5e1d8,'wall',q);
    block(6,-18.5,0.4,13,0,6.4,0xe5e1d8,'wall',q);
    block(6,-27,0.4,4,3.5,6.4,0xe5e1d8,'wall',q); // 4m open doorway
    block(0,-42,12.4,0.4,0,6.4,0xe5e1d8,'wall',q);
    for(const x of [-9,9]) block(x,-12,6,0.4,0,6.4,0xe5e1d8,'wall',q);
    block(24,-27,0.4,18.4,0,6.4,0xe5e1d8,'wall',q);
    block(15,-36,18,0.4,0,6.4,0xe5e1d8,'wall',q);
    block(15,-18,18,0.4,0,6.4,0xe5e1d8,'wall',q);
    block(8,-29.05,4,0.14,0,3.4,0x955c36,'door',q); // door leaf swung fully into room
    // Low red wall stripe, rendered separately so it adds no invisible collision.
    for(const z of [-38,-35,-32,-20,-17]) block(-5.45,z,0.7,1.6,0,2.6,0xa71930,'locker',q);
    for(const z of [-31.5,-21.5]) for(const x of [11,16,21]) {
      block(x,z,1.8,1.2,0.95,1.1,0xd0a46f,'desk',q);
      for(const dx of [-0.7,0.7]) for(const dz of [-0.43,0.43]) block(x+dx,z+dz,0.09,0.09,0,0.95,0x3e4651,'leg',q);
      block(x-1.4,z,0.65,0.7,0,0.55,0x3b566a,'chair',q);
      block(x-1.68,z,0.12,0.7,0.55,1.05,0x3b566a,'chair',q);
    }
    block(21,-27,2.2,3.2,0,1.15,0x9f704b,'teacherdesk',q);
    block(9,-34.9,3.5,1,0,2.5,0x8a603f,'bookshelf',q);
    for(const x of [-2.7,2.7]) {const p=rotate(x,-38,q);spawns.push([p.x,p.z]);}
    const roomSpawn=rotate(15,-27,q);spawns.push([roomSpawn.x,roomSpawn.z]);
    const sign=rotate(0,-40.9,q);signs.push({...sign,q,title:names[q]+' HALL',room:'CLASSROOM '+(101+q)});
    // Right-hand traffic: north-bound entry example runs south on x=-2.7.
    for(const z of [-35,-29,-23,-17,-11]) {arrow(-2.7,z,0,1,q);arrow(2.7,z,0,-1,q);}
    arrow(-3,-8.5,-0.45,1,q);arrow(3,-8.5,0,-1,q);
    let prev=null;
    for(const z of [-39,-34,-29,-24,-19,-14,-9]) {
      const p=rotate(0,z,q);cone(p.x,p.z);if(prev)chain(prev,p);prev=p;
    }
  }
  // A trashcan island with a small cone-and-chain ring very close around it.
  block(0,0,1.55,1.55,0,1.7,0x37434c,'trashcan');
  for(let i=0;i<12;i++) {
    const a=i*Math.PI/6,b=(i+1)*Math.PI/6;
    const p={x:2.5*Math.cos(a),z:-2.5*Math.sin(a)},t={x:2.5*Math.cos(b),z:-2.5*Math.sin(b)};
    cone(p.x,p.z);chain(p,t);
    // Tangent (-sin,-cos) is counterclockwise in a north-up overhead view.
    arrow(4.7*Math.cos(a),-4.7*Math.sin(a),-Math.sin(a),-Math.cos(a));
  }
  // Outer guide arcs leave wide openings aligned with each hallway.
  for(let q=0;q<4;q++) {
    let prev=null;
    for(const deg of [35,45,55]) {
      const a=(deg+q*90)*Math.PI/180,p={x:7.5*Math.cos(a),z:-7.5*Math.sin(a)};
      cone(p.x,p.z);if(prev)chain(prev,p);prev=p;
    }
  }
  // Ceilings have collision too; camera stays inside rather than looking through walls.
  for(const f of floors) block(f.x,f.z,f.w,f.d,6.4,6.6,0xf4f1e9,'ceiling');
  const wallBoxes=blocks.map(b=>({minX:b.x-b.w/2,maxX:b.x+b.w/2,minZ:b.z-b.d/2,maxZ:b.z+b.d/2,y0:b.y0,h:b.h}));
  return {blocks,floors,chains,cones,arrows,signs,spawns,wallBoxes,limits:{halfX:44,halfZ:44,limitX:41.2,limitZ:41.2}};
}

const PORT = process.env.PORT || 3000;
const MAX_PLAYERS = 30;
const RESPAWN_MS = 3000;
const CHARS = { mahoney: { health: 275 }, applebee: { health: 200 }, land: { health: 225 } };

// The SERVER decides damage, so players can't edit their own numbers
const RULES = {
  cleetusfield: { dmg: 20, range: 1000 },
  cleetusorb: { dmg: 10, range: 1000 }, // internal server orb ticks only
  landbeam: { dmg: 38, range: 20 }, // damage per second; server-timed channel only
  landblast: { dmg: 52, range: 20 },
  phone: { dmg: 10, range: 95 },
  grenade: { dmg: 75, range: 70 },
  beam: { dmg: 150, range: 110 },
  hammer: { dmg: 99999, range: 10 }, // the only one-shot move
  apple: { dmg: 55, range: 125 }, // Ms. Applebee hitscan apple
  mine: { dmg: 75, range: 90 }, // Ms. Applebee landmine
  hive: { dmg: 50, range: 10, slow: 2000 }, // Ms. Applebee beehive (slows for 2s)
  bee: { dmg: 50, range: 125 }, // Ms. Applebee bee gun blast
  beast: { dmg: 65, range: 160 }, // Ms. Applebee ult: grab
  beasttick: { dmg: 5, range: 160 }, // ult: 5 every half second = 10/s while held
  beastend: { dmg: 65, range: 160 }, // ult: final hit when it lets go
  beezone: { dmg: 15, range: 125, slow: 1500 }, // repeated sticky damage + slow, rate limited per target
  beeslow: { dmg: 0, range: 125, slow: 600 }, // standing in the zone keeps you slowed
};
const SHIELD_BLOCK = 0.85;
const BONUS_SHIELD = 50; // blue bonus shield a player gets from siphon (keep the same as game.js)
const HAMMER_COOLDOWN = 25000; // a bit under the real 30s to allow for lag
const LAST_HIT_WINDOW = 10000; // ms: switching teachers gives the kill to whoever hit you in this time

const SPAWNS = [
  [-15, -35], [15, -35], [-15, 35], [15, 35], [0, -30],
  [0, 30], [-6, -12], [6, 12], [-6, 12], [6, -12],
];

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Game server is running (version " + SERVER_VERSION + ")");
});
const wss = new WebSocketServer({ server });

// ---------- rooms ----------
const rooms = new Map(); // code -> { code, players: Map(id -> player) }
function newRoom(code, map = "football") {
  const room = { code, map, players: new Map() };
  rooms.set(code, room);
  return room;
}
newRoom("PUBLIC", "football");
newRoom("ROUND", "roundabout");

const LETTERS = "BCDFGHJKLMNPQRSTVWXZ"; // no vowels, so codes never spell words
function makeCode() {
  let code;
  do {
    code = "";
    for (let i = 0; i < 4; i++) code += LETTERS[Math.floor(Math.random() * LETTERS.length)];
  } while (rooms.has(code));
  return code;
}

let nextId = 1;

function send(p, obj) {
  if (p.ws.readyState === 1) p.ws.send(JSON.stringify(obj));
}
function broadcast(room, obj, exceptId) {
  const text = JSON.stringify(obj);
  for (const p of room.players.values()) {
    if (p.id !== exceptId && p.ws.readyState === 1) p.ws.send(text);
  }
}
function num(v, lo, hi, d) {
  v = Number(v);
  return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d;
}
function pub(p) {
  return { id: p.id, name: p.name, char: p.char, y: p.y, x: p.x, z: p.z, yaw: p.yaw, hp: p.hp, max: p.max, alive: p.alive, bonus: p.bonus || 0, ultShield: p.ultShield || 0, balding: !!p.balding, sprint: !!p.sprint, cleetus: !!p.cleetus };
}

function pickSpawn(room) {
  const spawns = room.map === "roundabout" ? roundaboutMap.spawns : SPAWNS;
  let best = spawns[0];
  let bestD = -1;
  for (let k = 0; k < 6; k++) {
    const s = spawns[Math.floor(Math.random() * spawns.length)];
    let nearest = 999;
    for (const o of room.players.values()) {
      if (o.ready && o.alive) nearest = Math.min(nearest, Math.hypot(s[0] - o.x, s[1] - o.z));
    }
    if (nearest > bestD) {
      bestD = nearest;
      best = s;
    }
  }
  return best;
}

// basic bad-word filter for player names (the game checks too, this stops edited clients)
const BAD_WORDS = ["fuck", "shit", "bitch", "cunt", "dick", "cock", "pussy", "nigg", "fagg", "slut", "whore", "rape", "nazi", "hitler", "porn", "penis", "vagina", "asshole", "bastard"];
function nameLooksBad(n) {
  const map = { 0: "o", 1: "i", 3: "e", 4: "a", 5: "s", 7: "t" };
  const squashed = n.toLowerCase().replace(/[013457 ]/g, (c) => map[c] || "").replace(/[^a-z]/g, "");
  return BAD_WORDS.some((w) => squashed.includes(w));
}

// ---------- joining and leaving ----------
function join(p, m) {
  if (p.room) return;
  p.name =
    String(m.name || "").replace(/[^A-Za-z0-9 ]/g, "").replace(/\s+/g, " ").trim().slice(0, 16) || "Player" + p.id;
  if (nameLooksBad(p.name)) p.name = "Player" + p.id;

  let room;
  if (m.create) {
    room = newRoom(makeCode(), m.map === "roundabout" ? "roundabout" : "football");
  } else {
    let code = String(m.room || "PUBLIC").toUpperCase().slice(0, 8);
    if (code === "PUBLIC" && m.map === "roundabout") code = "ROUND";
    room = rooms.get(code);
    if (!room) return send(p, { t: "error", msg: "Room not found. Check the code and try again." });
  }
  if (room.players.size >= MAX_PLAYERS) {
    return send(p, { t: "error", msg: "That room is full (" + MAX_PLAYERS + " players max)." });
  }
  room.players.set(p.id, p);
  p.room = room;
  const list = [];
  for (const o of room.players.values()) if (o.ready && o !== p) list.push(pub(o));
  send(p, { t: "welcome", v: SERVER_VERSION, id: p.id, code: room.code, map: room.map, players: list });
}

function leave(p) {
  clearTimeout(p.respawnTimer);
  const room = p.room;
  if (!room) return;
  p.room = null;
  room.players.delete(p.id);
  broadcast(room, { t: "left", id: p.id });
  if (room.players.size === 0 && room.code !== "PUBLIC" && room.code !== "ROUND") rooms.delete(room.code);
}

function sendShieldState(p) {
  broadcast(p.room, { t: "hp", id: p.id, hp: p.hp, max: p.max, bonus: p.bonus, ultShield: p.ultShield || 0, balding: !!p.balding, by: 0, dealt: 0 });
}
function endBalding(p) {
  if (!p.balding && !p.ultShield) return;
  p.balding = false;
  p.ultShield = 0;
  sendShieldState(p);
}

// ---------- combat ----------
function respawn(p, preserveField = false) {
  if (!p.room) return;
  const s = pickSpawn(p.room);
  p.x = s[0];
  p.z = s[1];
  p.hp = p.max;
  p.bonus = 0;
  p.ultShield = 0;
  p.balding = false;
  p.sprint = false;
  p.alive = true;
  if (!preserveField) { p.orbs = []; p.fields = []; }
  p.landTarget = 0;
  p.stunnedUntil = 0;
  p.sh = 0;
  p.inv = 0;
  p.y = 1;
  p.lastHitBy = 0;
  broadcast(p.room, { t: "respawn", id: p.id, char: p.char, cleetus: !!p.cleetus, x: p.x, z: p.z, hp: p.hp, max: p.max, bonus: 0 });
}

// Gives a player full health + the blue bonus shield
function siphonPlayer(room, a) {
  a.hp = a.max;
  a.bonus = BONUS_SHIELD;
  broadcast(room, { t: "hp", id: a.id, hp: a.hp, max: a.max, bonus: a.bonus, ultShield: a.ultShield || 0, balding: !!a.balding, by: 0, dealt: 0 });
}

function hit(a, m, channelSeconds = 0, blastAuthorized = false, orbAuthorized = false) {
  if (!orbAuthorized && Date.now() < (a.stunnedUntil || 0)) return;
  const room = a.room;
  const rule = RULES[m.k];
  const t = room.players.get(m.target);
  if (!rule || !t || t === a) return;
  if (!a.ready || !a.alive || !t.ready || !t.alive) return;
  if ((m.k === "cleetusorb" || m.k === "cleetusfield") && (!orbAuthorized || channelSeconds <= 0)) return;
  if (m.k === "landbeam" && a.cleetus) return;
  // Land can only damage through the server-timed primary channel.
  if (m.k === "landbeam" && (a.char !== "land" || channelSeconds <= 0)) return;
  if (m.k === "landblast" && (a.char !== "land" || !blastAuthorized)) return;
  if (a.char === "land" && m.k !== "landbeam" && m.k !== "landblast" && m.k !== "cleetusorb" && m.k !== "cleetusfield") return;
  if (Math.hypot(a.x - t.x, a.z - t.z) > rule.range) return;
  if (m.k === "hammer") {
    const now = Date.now();
    if (now - a.hammerAt > HAMMER_COOLDOWN) {
      a.hammerAt = now;
      a.hammerHit = new Set();
    } else if (now - a.hammerAt > 1000 || a.hammerHit.has(t.id)) {
      return; // still on cooldown
    }
    a.hammerHit.add(t.id);
  }
  if (m.k === "bee") {
    // one bee gun shot per ~4s (a blast can hit several players at the same moment)
    const nowB = Date.now();
    if (nowB - (a.beeAt || 0) > 4000) {
      a.beeAt = nowB;
      a.beeHit = new Set();
    } else if (nowB - a.beeAt > 500 || (a.beeHit && a.beeHit.has(t.id))) {
      return;
    }
    a.beeHit.add(t.id);
  }
  if (m.k === "beast" || m.k === "beasttick" || m.k === "beastend") {
    // the beast can grab someone once per ult, then tick, then let go once
    const nowG = Date.now();
    a.grabs = a.grabs || new Map();
    const g = a.grabs.get(t.id);
    if (m.k === "beast") {
      if (g && nowG - g.at < 8000) return;
      a.grabs.set(t.id, { at: nowG, ended: false, tickAt: 0 });
    } else {
      if (!g || g.ended || nowG - g.at > 12000) return;
      if (m.k === "beastend") g.ended = true;
      else {
        if (nowG - g.tickAt < 300) return;
        g.tickAt = nowG;
      }
    }
  }
  // Balding is damageable; its temporary shield absorbs damage first.
  if (rule.dmg === 0) {
    if (rule.slow) send(t, { t: "slow", ms: rule.slow });
    return;
  }
  if (m.k === "beezone") {
    a.zoneTicks = a.zoneTicks || new Map();
    const now = Date.now();
    if (now - (a.zoneTicks.get(t.id) ?? -Infinity) < 950) return;
    a.zoneTicks.set(t.id,now);
  }
  if (m.k === "apple") {
    const nowA = Date.now();
    if (nowA - (a.appleAt || 0) < 120) return; // apples can't be spammed faster than a real fire rate
    a.appleAt = nowA;
  }

  let dmg = rule.dmg * ((m.k === "landbeam" || m.k === "cleetusorb" || m.k === "cleetusfield") ? Math.min(0.1, channelSeconds) : 1);
  if (!orbAuthorized && a.char === "applebee" && a.dmgBoostUntil && Date.now() < a.dmgBoostUntil) dmg *= 1.2; // the bees' +20% from Honey Choice
  if (t.sh) dmg *= 1 - SHIELD_BLOCK;
  const dealt = Math.min(dmg, t.hp + t.bonus + (t.ultShield || 0));
  const ultSoak = Math.min(t.ultShield || 0, dmg);
  t.ultShield = (t.ultShield || 0) - ultSoak;
  dmg -= ultSoak;
  // the blue bonus shield soaks damage first
  const soak = Math.min(t.bonus, dmg);
  t.bonus -= soak;
  t.hp -= dmg - soak;
  if (rule.slow && t.hp > 0) send(t, { t: "slow", ms: rule.slow });
  t.lastHitBy = a.id; // remembered so switching teachers can credit the kill
  t.lastHitAt = Date.now();
  broadcast(room, {
    t: "hp", id: t.id, hp: Math.max(0, +t.hp.toFixed(1)), max: t.max,
    bonus: +t.bonus.toFixed(1), ultShield: t.ultShield || 0, balding: !!t.balding, by: a.id, dealt,
  });


  if (t.hp <= 0) {
    t.hp = 0;
    t.bonus = 0;
    t.ultShield = 0;
    t.balding = false;
    t.sprint = false;
    t.alive = false;
    t.lastHitBy = 0;
    t.deaths++;
    a.kills++;
    const how = { hammer: "banned", beam: "beam", apple: "apple", mine: "mine", hive: "hive", bee: "bee", beezone: "bee", beast: "beast", beasttick: "beast", beastend: "beast" }[m.k] || "";
    broadcast(room, { t: "kill", killer: a.id, victim: t.id, how });
    // siphon: the killer gets full health plus a 50 blue bonus shield
    if (m.k !== "cleetusorb") siphonPlayer(room, a);
    t.orbs = [];
    t.respawnTimer = setTimeout(() => respawn(t), RESPAWN_MS);
  }
  return dealt;
}

// A player picked a teacher from the Esc menu. It counts as a respawn,
// so whoever hit them last (within the window) gets the kill and the siphon.
function switchTeacher(p, m) {
  const room = p.room;
  const key = CHARS[m.char] ? m.char : "mahoney";
  const ch = CHARS[key];
  p.char = key;
  p.cleetus = false;
  const killer = room.players.get(p.lastHitBy);
  if (killer && killer !== p && killer.ready && Date.now() - p.lastHitAt < LAST_HIT_WINDOW) {
    p.deaths++;
    killer.kills++;
    broadcast(room, { t: "kill", killer: killer.id, victim: p.id, how: "" });
    if (killer.alive) siphonPlayer(room, killer);
  }
  p.max = ch.health;
  respawn(p, true); // preserve already-fired Land/Cleetus effects
}

// ---------- messages ----------
function onMessage(p, m) {
  if (!m || typeof m.t !== "string") return;
  if (m.t === "population") {
    const now = Date.now();
    if (p.lastPopulationAt != null && now - p.lastPopulationAt < 1000) return;
    p.lastPopulationAt = now;
    const counts = {football:0, roundabout:0};
    counts.football = rooms.get("PUBLIC")?.players.size || 0;
    counts.roundabout = rooms.get("ROUND")?.players.size || 0;
    send(p, {t:"population", counts});
    return;
  }
  if (m.t === "join") return join(p, m);
  const room = p.room;
  if (!room) return;
  const limits = mapForRoom(room).limits;

  if (m.t === "ready") {
    if (p.ready) return;
    const key = CHARS[m.char] ? m.char : "mahoney";
    const ch = CHARS[key];
    p.char = key;
    const s = pickSpawn(room);
    p.x = s[0];
    p.z = s[1];
    p.max = ch.health;
    p.hp = p.max;
    p.bonus = 0;
  p.ultShield = 0;
  p.balding = false;
  p.sprint = false;
    p.lastHitBy = 0;
    p.alive = true;
    p.ready = true;
    send(p, { t: "respawn", id: p.id, char: p.char, cleetus: !!p.cleetus, x: p.x, z: p.z, hp: p.hp, max: p.max, bonus: 0 });
    broadcast(room, { t: "joined", p: pub(p) }, p.id);
    return;
  }

  if (m.t === "chat") {
    if (!p.ready || typeof m.text !== "string") return;
    const text = m.text.replace(/[\x00-\x1f\x7f]/g, " ").trim().slice(0, 200);
    if (!text) return;
    const now = Date.now();
    if (p.lastChatAt != null && now - p.lastChatAt < 1000) {
      send(p, {t:"chatNotice", text:"Please wait a second between messages."});
      return;
    }
    p.lastChatAt = now;
    broadcast(room, {t:"chat", id:p.id, name:p.name, text});
    return;
  }
  if (!p.ready || !p.alive) return;

  if (m.t === "balding" && m.active === false) { endBalding(p); return; }
  if (Date.now() < (p.stunnedUntil || 0)) return;
  if (m.t === "balding") {
    if (p.char !== "mahoney" || m.active !== true || p.balding || Date.now() < (p.nextBaldingAt || 0)) return;
    p.balding = true;
    p.ultShield = 250;
    p.baldingUntil = Date.now() + 12600;
    p.nextBaldingAt = p.baldingUntil; // cannot toggle the channel to refill shield
    sendShieldState(p);
    return;
  }
  if (m.t === "cleetus") {
    if (p.char !== "land" || typeof m.active !== "boolean") return;
    p.cleetus = m.active;
    p.landTarget = 0;
    broadcast(room, {t:"cleetus", id:p.id, active:p.cleetus});
    return;
  }
  if (m.t === "cleetusfire" || m.t === "cleetusburst") { fireCleetusOrb(p, m); return; }
  if (m.t === "landblast") { fireLandBlastServer(p, m); return; }
  if (m.t === "landlock") {
    if (p.char !== "land" || p.cleetus) return;
    const target = Number.isInteger(m.target) ? m.target : 0;
    if (!p.landTarget || p.landTarget !== target) p.landTickAt = Date.now();
    p.landTarget = target;
    p.landLockAt = Date.now();
    if (!target) broadcast(room, { t: "fx", id: p.id, k: "lb", a: [0] }, p.id);
    return;
  }
  if (m.t === "st") {
    p.x = num(m.x, -limits.limitX, limits.limitX, p.x);
    p.z = num(m.z, -limits.limitZ, limits.limitZ, p.z);
    p.yaw = num(m.yaw, -1000, 1000, p.yaw);
    p.pitch = num(m.pitch, -2, 2, p.pitch);
    p.sh = p.char !== "land" && m.sh ? 1 : 0;
    p.inv = 0; // no teacher gains invincibility from client state
    p.sprint = p.char === "land" && !!m.sprint;
    p.y = num(m.y, -2, 30, p.y);
  } else if (m.t === "fx") {
    if (p.char === "land" || (m.k === "lb" || m.k === "ls")) return; // channel effects are server-owned
    // visual effects (phones, grenades, beams) just get passed on to everyone else
    const a = Array.isArray(m.a) ? m.a.slice(0, 8) : [];
    if (!a.every((v) => typeof v === "number" && Number.isFinite(v))) return;
    broadcast(room, { t: "fx", id: p.id, k: String(m.k).slice(0, 2), a }, p.id);
  } else if (m.t === "hold") {
    if (p.char === "land") return;
    // the beast owner says where the grabbed players are; tell each grabbed player to move there
    const ids = Array.isArray(m.ids) ? m.ids.slice(0, 11) : [];
    const hx = num(m.x, -limits.limitX, limits.limitX, 0), hy = num(m.y, -2, 30, 1), hz = num(m.z, -limits.limitZ, limits.limitZ, 0);
    const nowH = Date.now();
    for (const id of ids) {
      const t = room.players.get(id);
      const g = p.grabs && p.grabs.get(id);
      if (t && t !== p && t.alive && !t.inv && g && !g.ended && nowH - g.at < 12000) send(t, { t: "hold", x: hx, y: hy, z: hz });
    }
  } else if (m.t === "hit") {
    hit(p, m);
  } else if (m.t === "switch") {
    switchTeacher(p, m);
  } else if (m.t === "honey") {
    if (p.char !== "applebee") return;
    // Ms. Applebee's Q: the apple heals (sent as one +20 chunk, then ten +3 ticks), the bees boost her damage
    if (!p.room || !p.ready || !p.alive) return;
    const now = Date.now();
    if (m.k === "heal") {
      if (typeof m.amt !== "number" || m.amt <= 0 || m.amt > 20) return;
      if (now - p.honeyAt < 900) return; // keeps the once-a-second ticks from being spammed
      p.honeyAt = now;
      p.hp = Math.min(p.max, p.hp + m.amt);
      broadcast(p.room, { t: "hp", id: p.id, hp: +p.hp.toFixed(1), max: p.max, bonus: +p.bonus.toFixed(1), ultShield: p.ultShield || 0, balding: !!p.balding, by: 0, dealt: 0 });
    } else if (m.k === "boost") {
      if (now - p.lastHoney < 14000) return; // matches her 15s cooldown, minus a little slack for lag
      p.lastHoney = now;
      p.dmgBoostUntil = now + 5000;
    }
  }
}

wss.on("connection", (ws) => {
  const p = {
    id: nextId++, ws, room: null, name: "Player", ready: false, alive: false,
    x: 0, z: 0, y: 1, char: "mahoney", yaw: 0, pitch: 0, sh: 0, inv: 0, bonus: 0, hp: 275, max: 275,
    lastHitBy: 0, lastHitAt: 0,
    kills: 0, deaths: 0, hammerAt: 0, hammerHit: new Set(), respawnTimer: null,
    honeyAt: 0, lastHoney: 0, dmgBoostUntil: 0,
  };
  ws.isAlive = true;
  ws.on("pong", () => (ws.isAlive = true));
  ws.on("message", (raw, isBinary) => {
    if (isBinary) {
      // voice chat: a raw 16kHz mono PCM chunk from push-to-talk, relayed to everyone else in the room
      if (raw.length > 4000 || !p.room || !p.ready) return;
      const packet = Buffer.allocUnsafe(4 + raw.length);
      packet.writeUInt32LE(p.id, 0);
      raw.copy(packet, 4);
      for (const o of p.room.players.values()) {
        if (o.id !== p.id && o.ws.readyState === 1) o.ws.send(packet);
      }
      return;
    }
    if (raw.length > 2000) return;
    let m;
    try {
      m = JSON.parse(raw.toString());
    } catch (e) {
      return;
    }
    onMessage(p, m);
  });
  ws.on("close", () => leave(p));
  ws.on("error", () => {});
});

// Collision map mirrors game.js; update both when editing arena geometry.
const walls = [
  // cover (equipment and benches)
  { x: -10, z: -22, w: 5, d: 2, h: 3, color: 0xb5122a },
  { x: 10, z: -22, w: 5, d: 2, h: 3, color: 0xb5122a },
  { x: -10, z: 22, w: 5, d: 2, h: 3, color: 0xb5122a },
  { x: 10, z: 22, w: 5, d: 2, h: 3, color: 0xb5122a },
  { x: -14, z: 0, w: 2, d: 6, h: 3, color: 0x24262b },
  { x: 14, z: 0, w: 2, d: 6, h: 3, color: 0x24262b },
];

// ===== walkable bleachers, announcer room, stairs =====
// No field-side fences: players can cross freely onto the track.
const bleacherStart = walls.length;
for (const side of [-1, 1]) {
  for (let i = 0; i < 8; i++) {
    const top = 0.5 * (i + 1);
    walls.push({ x: side * (24.8 + i * 1.6), z: 0, w: 1.6, d: 60, y0: i < 4 ? 0 : top - 0.3, h: top, color: i % 2 ? 0xb5122a : 0xd9dde0 });
  }
  walls.push({ x: side * 37, z: 0, w: 0.4, d: 60, h: 4.6, color: 0x555555 });
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
// Move both bleacher banks and the announcer building 20m toward the map edges.
for (let i = bleacherStart; i < walls.length; i++) walls[i].x += Math.sign(walls[i].x) * 20;
// Fence only the expanded outer perimeter, beyond the track and bleachers.
walls.push(
  { x: 0, z: -MAP.halfZ, w: MAP.halfX * 2, d: 1, h: 3, color: 0x444444 },
  { x: 0, z: MAP.halfZ, w: MAP.halfX * 2, d: 1, h: 3, color: 0x444444 },
  { x: -MAP.halfX, z: 0, w: 1, d: MAP.halfZ * 2, h: 3, color: 0x444444 },
  { x: MAP.halfX, z: 0, w: 1, d: MAP.halfZ * 2, h: 3, color: 0x444444 }
);

// ================= CANYON COUGARS STADIUM PROPS =================
// Every solid piece goes through walls, so movement and attack collision agree.
function stadiumBlock(x, z, w, d, y0, h, color) {
  walls.push({ x, z, w, d, y0, h, color });
}
const concession = { x: 54, z: -49 };
// Concession booth: counter, serving window, back wall and striped canopy.
stadiumBlock(54, -52.8, 14, 0.4, 0, 5, 0xb5122a);
stadiumBlock(47.2, -49, 0.4, 8, 0, 5, 0xb5122a);
stadiumBlock(60.8, -49, 0.4, 8, 0, 5, 0xb5122a);
stadiumBlock(54, -45.2, 14, 0.4, 0, 1.15, 0xb5122a);
stadiumBlock(54, -44.9, 14.6, 1.1, 1.15, 1.3, 0xe6e7e9);
stadiumBlock(54, -45.2, 14, 0.4, 4.4, 5, 0x202126);
stadiumBlock(54, -49, 15, 9, 5, 5.25, 0x202126);
for (let stripe = 0; stripe < 14; stripe++) {
  stadiumBlock(47.5 + stripe, -44.4, 1, 2.2, 4.4, 4.55, stripe % 2 ? 0xffffff : 0xb5122a);
}
// Picnic tables: jumpable tabletop and two low benches.
const picnicSpots = [[53, -36], [65, -36], [63, 35]];
for (const [x, z] of picnicSpots) {
  stadiumBlock(x, z, 4, 1.5, 0.9, 1.1, 0xb5122a);
  for (const side of [-1, 1]) {
    stadiumBlock(x, z + side * 1.25, 4, 0.5, 0.4, 0.55, 0xd9dde0);
    stadiumBlock(x + side * 1.3, z, 0.18, 2.8, 0, 0.9, 0x292b30);
  }
}
// Sideline benches and water coolers, entirely inside the track's inner edge.
const sidelineSpots = [[22.5, -23], [-22.5, 23]];
for (const [x, z] of sidelineSpots) {
  stadiumBlock(x, z, 1.2, 7, 0.5, 0.7, 0xd9dde0);
  stadiumBlock(x + Math.sign(x) * 0.5, z, 0.15, 7, 0.7, 1.45, 0xb5122a);
  for (const dz of [-2.6, 2.6]) stadiumBlock(x, z + dz, 0.8, 0.15, 0, 0.5, 0x292b30);
  stadiumBlock(x, z + 4.8, 1.2, 1.2, 0, 1.25, 0xb5122a);
}
// Blocking sleds / padded tackling stations; players can flank each end.
const sledSpots = [[-19, -9], [19, 9], [-48, 43], [48, 43]];
for (const [x, z] of sledSpots) {
  stadiumBlock(x, z, 3.8, 2, 0, 0.2, 0x24262b);
  for (const dx of [-1.2, 0, 1.2]) {
    stadiumBlock(x + dx, z, 0.22, 0.25, 0.2, 1, 0xd9dde0);
    stadiumBlock(x + dx, z, 0.8, 0.65, 0.7, 2.1, 0xb5122a);
  }
}
const crateSpots = [[-51, -43], [-55, -43], [48, 55], [52, 55], [-48, 55]];
for (const [x, z] of crateSpots) stadiumBlock(x, z, 2.8, 2.4, 0, 1.7, 0x373a40);
// North-end stadium board, outside the oval. No false live score display.
for (const x of [-5.5, 5.5]) stadiumBlock(x, -84, 0.5, 0.5, 0, 8, 0x292b30);
stadiumBlock(0, -84, 17, 0.8, 5.5, 10.5, 0x202126);
// Banner uprights beyond the bleacher ends.
for (const side of [-1, 1]) for (const z of [-34, 34]) {
  stadiumBlock(side * 46, z, 0.18, 0.18, 0, 6, 0xd9dde0);
}

const wallBoxes = walls.map(w => ({ minX: w.x-w.w/2, maxX: w.x+w.w/2, minZ: w.z-w.d/2, maxZ: w.z+w.d/2, y0: w.y0 || 0, h: w.h || 6 }));
const roundaboutMap = createRoundaboutLayout();
function mapForRoom(room) {
  return room && room.map === "roundabout" ? roundaboutMap : { wallBoxes, limits: MAP, spawns: SPAWNS };
}
function landLineClear(a, b, boxes = wallBoxes) {
  for (const box of boxes) {
    let lo = 0, hi = 1;
    for (const [axis, min, max] of [["x", box.minX, box.maxX], ["y", box.y0, box.h], ["z", box.minZ, box.maxZ]]) {
      const d = b[axis] - a[axis];
      if (Math.abs(d) < 1e-8) {
        if (a[axis] < min || a[axis] > max) { lo = 2; break; }
      } else {
        const t1 = (min - a[axis]) / d, t2 = (max - a[axis]) / d;
        lo = Math.max(lo, Math.min(t1, t2));
        hi = Math.min(hi, Math.max(t1, t2));
      }
    }
    if (lo <= hi && hi > 0 && lo < 1) return false;
  }
  return true;
}

function landShotTarget(origin, dir, targets, range, boxes = wallBoxes) {
  let best = null, bestDistance = range;
  for (const target of targets) {
    if (!target.alive) continue;
    const dx = target.x - origin.x, dy = target.y + 0.5 - origin.y, dz = target.z - origin.z;
    if (Math.hypot(dx, dy, dz) > range) continue;
    const along = dx * dir.x + dy * dir.y + dz * dir.z;
    if (along < 0 || along > bestDistance) continue;
    const off = dx * dx + dy * dy + dz * dz - along * along;
    if (off > 0.85 * 0.85) continue;
    if (!landLineClear(origin, { x: target.x, y: target.y + 0.5, z: target.z }, boxes)) continue;
    best = target;
    bestDistance = along;
  }
  return best;
}
function landKnockback(from, target) {
  const { wallBoxes: boxes, limits } = mapForRoom(from.room);
  const dx = target.x - from.x, dz = target.z - from.z;
  const length = Math.hypot(dx, dz);
  const ux = length > 0.001 ? dx / length : -Math.sin(from.yaw || 0);
  const uz = length > 0.001 ? dz / length : -Math.cos(from.yaw || 0);
  const out = { x: target.x, y: target.y, z: target.z };
  for (let step = 1; step <= 30; step++) {
    const x = target.x + ux * step * 0.1, z = target.z + uz * step * 0.1;
    if (Math.abs(x) > limits.limitX || Math.abs(z) > limits.limitZ) break;
    if (boxes.some(b => target.y - 1 < b.h && target.y + 1 > b.y0 &&
      x > b.minX - 0.6 && x < b.maxX + 0.6 && z > b.minZ - 0.6 && z < b.maxZ + 0.6)) break;
    out.x = x; out.z = z;
  }
  return out;
}

function fireLandBlastServer(p, m) {
  const now = Date.now();
  if (p.char !== "land" || now < (p.stunnedUntil || 0) || now - (p.lastLandBlast ?? -Infinity) < 7000) return;
  if (![m.dx, m.dy, m.dz].every(v => typeof v === "number" && Number.isFinite(v))) return;
  const length = Math.hypot(m.dx, m.dy, m.dz);
  if (length < 0.9 || length > 1.1) return;
  const dir = { x: m.dx / length, y: m.dy / length, z: m.dz / length };
  p.lastLandBlast = now; // misses also consume the cooldown
  const origin = { x: p.x, y: p.y + 0.5, z: p.z };
  const targets = [...p.room.players.values()].filter(t => t !== p && t.ready);
  const boxes = mapForRoom(p.room).wallBoxes;
  const target = landShotTarget(origin, dir, targets, 20, boxes);
  let end = { x: origin.x + dir.x * 20, y: origin.y + dir.y * 20, z: origin.z + dir.z * 20 };
  if (target) end = { x: target.x, y: target.y + 0.5, z: target.z };
  else for (let d = 0.1; d <= 20; d += 0.1) {
    const point = { x: origin.x + dir.x * d, y: origin.y + dir.y * d, z: origin.z + dir.z * d };
    if (!landLineClear(origin, point, boxes)) { end = point; break; }
  }
  broadcast(p.room, { t: "fx", id: p.id, k: "ls", a: [origin.x, origin.y, origin.z, end.x, end.y, end.z] });
  if (!target || !(hit(p, { k: "landblast", target: target.id }, 0, true) > 0)) return;
  p.bonus = Math.min(BONUS_SHIELD, p.bonus + 30);
  broadcast(p.room, { t: "hp", id: p.id, hp: p.hp, max: p.max, bonus: p.bonus, ultShield: p.ultShield || 0, balding: !!p.balding, by: 0, dealt: 0 });
  if (target.alive) {
    const pos = landKnockback(p, target);
    target.x = pos.x; target.z = pos.z;
    target.stunnedUntil = now + 1000;
    target.landTarget = 0;
    target.sh = 0;
    target.sprint = false;
    send(target, { t: "landstun", x: pos.x, y: pos.y, z: pos.z, ms: 1000 });
  }
}

function updateLandChannel(p, now) {
  if (!p.landTarget) return;
  const t = p.room.players.get(p.landTarget);
  const dx = t ? t.x - p.x : 0, dy = t ? t.y - p.y : 0, dz = t ? t.z - p.z : 0;
  const distance = Math.hypot(dx, dy, dz);
  const facing = distance < 0.001 ? 1 : (-Math.sin(p.yaw) * Math.cos(p.pitch) * dx + Math.sin(p.pitch) * dy - Math.cos(p.yaw) * Math.cos(p.pitch) * dz) / distance;
  if (now < (p.stunnedUntil || 0) || p.char !== "land" || p.cleetus || !p.alive || !p.ready || !t || t === p || !t.alive || !t.ready ||
      now - p.landLockAt > 250 || distance > 20 || facing < Math.cos(Math.PI / 4) ||
      !landLineClear({ x: p.x, y: p.y + 0.5, z: p.z }, { x: t.x, y: t.y + 0.5, z: t.z }, mapForRoom(p.room).wallBoxes)) {
    p.landTarget = 0;
    broadcast(p.room, { t: "fx", id: p.id, k: "lb", a: [0] }, p.id);
    return;
  }
  const seconds = Math.max(0, Math.min(0.1, (now - p.landTickAt) / 1000));
  p.landTickAt = now;
  hit(p, { k: "landbeam", target: t.id }, seconds);
  broadcast(p.room, { t: "fx", id: p.id, k: "lb", a: [t.alive ? t.id : 0] }, p.id);
}

// Shared deterministic orb movement: slow floating spheres bounce off solid surfaces.
// Small movement steps prevent fast projectiles tunneling through thin walls.
function stepCleetusOrb(o, dt, boxes, limits, entities = []) {
  if (o.detonate) return false;
  o.life -= dt;
  const steps = Math.max(1, Math.ceil(dt / 0.008));
  for (let n = 0; n < steps; n++) {
    const nearby = entities.some(p => Math.hypot(o.x-p.x,o.y-(p.y+0.45),o.z-p.z) < 4.5);
    const speed = o.kind === 'burst' ? 48 : (o.bounces > 0 || nearby ? 4 : 32);
    const length = Math.hypot(o.vx,o.vy,o.vz) || 1;
    o.vx=o.vx/length*speed; o.vy=o.vy/length*speed; o.vz=o.vz/length*speed;
    for (const axis of ['x','y','z']) {
      const velocity='v'+axis, old=o[axis];
      if (!o[velocity]) continue;
      o[axis]+=o[velocity]*dt/steps;
      const r=o.kind==='burst' ? .85 : .55;
      const blocked=o.y<r || o.y>28 || Math.abs(o.x)>limits.limitX || Math.abs(o.z)>limits.limitZ || boxes.some(b=>
        o.x>b.minX-r && o.x<b.maxX+r && o.z>b.minZ-r && o.z<b.maxZ+r && o.y>b.y0-r && o.y<b.h+r);
      if (blocked) {o[axis]=old;o[velocity]*=-1;o.bounces++; if(o.kind==='burst') return false;}
    }
    if(o.kind==='burst' && entities.some(p=>Math.hypot(o.x-p.x,o.y-(p.y+.45),o.z-p.z)<2.2)) return false;
  }
  return o.life>0;
}

let orbSequence = 0;
function fireCleetusOrb(p, m) {
  const now = Date.now();
  const burst = m.t === "cleetusburst";
  if (p.char !== "land" || !p.cleetus) return;
  const pending = burst && (p.orbs || []).find(o => o.kind === "burst");
  if (pending) { pending.detonate = true; return; }
  const clock = burst ? "lastBurstAt" : "lastOrbAt";
  if (p.char !== "land" || !p.cleetus || now - (p[clock] ?? -Infinity) < (burst ? 10000 : 700)) return;
  if (![m.dx,m.dy,m.dz].every(Number.isFinite)) return;
  const length = Math.hypot(m.dx,m.dy,m.dz);
  if (length < 0.9 || length > 1.1) return;
  p[clock] = now;
  const o = {id:++orbSequence, owner:p.id, kind:burst ? "burst" : "life", x:p.x, y:p.y+0.45, z:p.z,
    vx:m.dx/length*6, vy:m.dy/length*6, vz:m.dz/length*6, life:30, bounces:0};
  p.orbs = p.orbs || []; p.orbs.push(o);
}
function updateCleetusOrbs(p, now) {
  const dt = Math.max(0, Math.min(0.1, (now - (p.orbTickAt ?? now)) / 1000));
  p.orbTickAt = now;
  if (!p.ready || !p.alive) { p.orbs = []; p.fields=[]; return; }
  const map=mapForRoom(p.room), targets=[...p.room.players.values()].filter(t=>t!==p&&t.ready&&t.alive);
  p.fields=(p.fields||[]).filter(f=>now<f.until);
  p.orbs=(p.orbs||[]).filter(o=>{
    const live=stepCleetusOrb(o,dt,map.wallBoxes,map.limits,targets);
    if(!live && o.kind==='burst') p.fields.push({id:o.id,owner:p.id,x:o.x,y:o.y,z:o.z,until:now+5000,nextPulse:now});
    return live;
  });
  if(dt<=0) return;
  let healed=0;
  for(const target of targets) {
    const center={x:target.x,y:target.y+.45,z:target.z};
    if(p.orbs.some(o=>o.kind!=='burst'&&Math.hypot(o.x-center.x,o.y-center.y,o.z-center.z)<=3.5&&landLineClear(o,center,map.wallBoxes)))
      healed+=hit(p,{k:'cleetusorb',target:target.id},dt,false,true)||0;
    for(const f of p.fields) {
      if(Math.hypot(f.x-center.x,f.y-center.y,f.z-center.z)>5 || !landLineClear(f,center,map.wallBoxes)) continue;
      hit(p,{k:'cleetusfield',target:target.id},dt,false,true);
      if(target.alive && now>=f.nextPulse) {
        target.stunnedUntil=Math.max(target.stunnedUntil||0,now+250);
        send(target,{t:'landstun',x:target.x,y:target.y,z:target.z,ms:250});
      }
    }
  }
  for(const f of p.fields) if(now>=f.nextPulse) f.nextPulse=now+1000;
  if(healed>0&&p.hp<p.max){p.hp=Math.min(p.max,p.hp+healed);sendShieldState(p);}
}

// send everyone's position 20 times a second
setInterval(() => {
  for (const room of rooms.values()) {
    for (const p of room.players.values()) {
      if (p.balding && Date.now() >= p.baldingUntil) endBalding(p);
      updateLandChannel(p, Date.now());
      updateCleetusOrbs(p, Date.now());
    }
    const orbs = [], fields = [];
    for (const p of room.players.values()) for (const f of p.fields || []) fields.push(f);
    for (const p of room.players.values()) for (const o of p.orbs || []) orbs.push({id:o.id,owner:o.owner,kind:o.kind,x:o.x,y:o.y,z:o.z});
    if (orbs.length || fields.length || room.hadOrbs) broadcast(room, {t:"orbs", orbs, fields});
    room.hadOrbs = orbs.length + fields.length > 0;
    if (room.players.size < 2) continue;
    const list = [];
    for (const p of room.players.values()) {
      if (p.ready && p.alive) {
        list.push({
          id: p.id, x: +p.x.toFixed(2), z: +p.z.toFixed(2),
          y: +p.y.toFixed(2), yaw: +p.yaw.toFixed(3), pitch: +p.pitch.toFixed(3), hp: p.hp, bonus: p.bonus || 0, ultShield: p.ultShield || 0, sh: p.sh, inv: 0, balding: !!p.balding, sprint: !!p.sprint, cleetus: !!p.cleetus,
        });
      }
    }
    if (list.length) broadcast(room, { t: "st", p: list });
  }
}, 50);

// drop dead connections
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);

server.listen(PORT, () => console.log("Game server v" + SERVER_VERSION + " running on port " + PORT));
