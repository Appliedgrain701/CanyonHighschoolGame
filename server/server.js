// Multiplayer server for the Canyon High game
const http = require("http");
const { WebSocketServer } = require("ws");

const SERVER_VERSION = 10; // protocol version; differing versions do not imply a stale deployment
const PORT = process.env.PORT || 3000;
const MAX_PLAYERS = 30;
const RESPAWN_MS = 3000;
const CHARS = { mahoney: { health: 275 }, applebee: { health: 200 }, land: { health: 225 }, cleetus: { health: 225 } };

// The SERVER decides damage, so players can't edit their own numbers
const RULES = {
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
  beezone: { dmg: 15, range: 125, slow: 1500 }, // the sticky zone's one tick of damage + slow
  beeslow: { dmg: 0, range: 125, slow: 600 }, // standing in the zone keeps you slowed
  landphone: { dmg: 2, range: 10 }, // Mr. Land/Cleetus beam: 2 damage every 100ms = 20 damage per second
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
function newRoom(code) {
  const room = { code, players: new Map() };
  rooms.set(code, room);
  return room;
}
newRoom("PUBLIC"); // the free-for-all lobby

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
  return { id: p.id, name: p.name, char: p.char, y: p.y, x: p.x, z: p.z, yaw: p.yaw, hp: p.hp, max: p.max, alive: p.alive };
}

function pickSpawn(room) {
  let best = SPAWNS[0];
  let bestD = -1;
  for (let k = 0; k < 6; k++) {
    const s = SPAWNS[Math.floor(Math.random() * SPAWNS.length)];
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
    room = newRoom(makeCode());
  } else {
    const code = String(m.room || "PUBLIC").toUpperCase().slice(0, 8);
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
  send(p, { t: "welcome", v: SERVER_VERSION, id: p.id, code: room.code, players: list });
}

function leave(p) {
  clearTimeout(p.respawnTimer);
  const room = p.room;
  if (!room) return;
  p.room = null;
  room.players.delete(p.id);
  broadcast(room, { t: "left", id: p.id });
  if (room.players.size === 0 && room.code !== "PUBLIC") rooms.delete(room.code);
}

// ---------- combat ----------
function respawn(p) {
  if (!p.room) return;
  const s = pickSpawn(p.room);
  p.x = s[0];
  p.z = s[1];
  p.hp = p.max;
  p.bonus = 0;
  p.alive = true;
  p.sh = 0;
  p.inv = 0;
  p.y = 1;
  p.lastHitBy = 0;
  broadcast(p.room, { t: "respawn", id: p.id, char: p.char, x: p.x, z: p.z, hp: p.hp, max: p.max, bonus: 0 });
}

// Gives a player full health + the blue bonus shield
function siphonPlayer(room, a) {
  a.hp = a.max;
  a.bonus = BONUS_SHIELD;
  broadcast(room, { t: "hp", id: a.id, hp: a.hp, max: a.max, bonus: a.bonus, by: 0, dealt: 0 });
}

function hit(a, m) {
  const room = a.room;
  const rule = RULES[m.k];
  const t = room.players.get(m.target);
  if (!rule || !t || t === a) return;
  if (!a.ready || !a.alive || !t.ready || !t.alive) return;
  if ((a.char === "land" || a.char === "cleetus") && m.k !== "landphone") return;
  if (m.k === "landphone" && a.char !== "land" && a.char !== "cleetus") return;
  if (Math.hypot(a.x - t.x, a.z - t.z) > rule.range) return;
  const nowHit = Date.now();
  if (m.k === "landphone") {
    if (a.char !== "land" && a.char !== "cleetus") return;
    if (nowHit - (a.landPhoneAt || 0) < 95) return;
    a.landPhoneAt = nowHit;
  }
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
  if (t.inv) return; // can't be hurt during the ult
  if (rule.dmg === 0) {
    if (rule.slow) send(t, { t: "slow", ms: rule.slow });
    return;
  }
  if (m.k === "apple") {
    const nowA = Date.now();
    if (nowA - (a.appleAt || 0) < 120) return; // apples can't be spammed faster than a real fire rate
    a.appleAt = nowA;
  }

  let dmg = rule.dmg;
  if (a.dmgBoostUntil && Date.now() < a.dmgBoostUntil) dmg *= 1.2; // the bees' +20% from Honey Choice
  if (t.sh) dmg *= 1 - SHIELD_BLOCK;
  const dealt = Math.min(dmg, t.hp + t.bonus);
  // the blue bonus shield soaks damage first
  const soak = Math.min(t.bonus, dmg);
  t.bonus -= soak;
  t.hp -= dmg - soak;
  if (rule.slow && t.hp > 0) send(t, { t: "slow", ms: rule.slow });
  t.lastHitBy = a.id; // remembered so switching teachers can credit the kill
  t.lastHitAt = Date.now();
  broadcast(room, {
    t: "hp", id: t.id, hp: Math.max(0, +t.hp.toFixed(1)), max: t.max,
    bonus: +t.bonus.toFixed(1), by: a.id, dealt,
  });


  if (t.hp <= 0) {
    t.hp = 0;
    t.bonus = 0;
    t.alive = false;
    t.lastHitBy = 0;
    t.deaths++;
    a.kills++;
    const how = { hammer: "banned", beam: "beam", apple: "apple", mine: "mine", hive: "hive", bee: "bee", beezone: "bee", beast: "beast", beasttick: "beast", beastend: "beast" }[m.k] || "";
    broadcast(room, { t: "kill", killer: a.id, victim: t.id, how });
    // siphon: the killer gets full health plus a 50 blue bonus shield
    siphonPlayer(room, a);
    t.respawnTimer = setTimeout(() => respawn(t), RESPAWN_MS);
  }
}

// A player picked a teacher from the Esc menu. It counts as a respawn,
// so whoever hit them last (within the window) gets the kill and the siphon.
function switchTeacher(p, m) {
  const room = p.room;
  const key = CHARS[m.char] ? m.char : "mahoney";
  const ch = CHARS[key];
  p.char = key;
  const killer = room.players.get(p.lastHitBy);
  if (killer && killer !== p && killer.ready && Date.now() - p.lastHitAt < LAST_HIT_WINDOW) {
    p.deaths++;
    killer.kills++;
    broadcast(room, { t: "kill", killer: killer.id, victim: p.id, how: "" });
    if (killer.alive) siphonPlayer(room, killer);
  }
  p.max = ch.health;
  respawn(p); // instant respawn with the new teacher
}

// ---------- messages ----------
function onMessage(p, m) {
  if (!m || typeof m.t !== "string") return;
  if (m.t === "join") return join(p, m);
  const room = p.room;
  if (!room) return;

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
    p.lastHitBy = 0;
    p.alive = true;
    p.ready = true;
    send(p, { t: "respawn", id: p.id, char: p.char, x: p.x, z: p.z, hp: p.hp, max: p.max, bonus: 0 });
    broadcast(room, { t: "joined", p: pub(p) }, p.id);
    return;
  }

  if (!p.ready || !p.alive) return;

  if (m.t === "st") {
    p.x = num(m.x, -50, 50, p.x);
    p.z = num(m.z, -50, 50, p.z);
    p.yaw = num(m.yaw, -1000, 1000, p.yaw);
    p.pitch = num(m.pitch, -2, 2, p.pitch);
    p.sh = m.sh ? 1 : 0;
    p.inv = m.inv ? 1 : 0;
    p.y = num(m.y, -2, 30, p.y);
  } else if (m.t === "fx") {
    // visual effects (phones, grenades, beams) just get passed on to everyone else
    const a = Array.isArray(m.a) ? m.a.slice(0, 8) : [];
    if (!a.every((v) => typeof v === "number" && Number.isFinite(v))) return;
    broadcast(room, { t: "fx", id: p.id, k: String(m.k).slice(0, 2), a }, p.id);
  } else if (m.t === "hold") {
    // the beast owner says where the grabbed players are; tell each grabbed player to move there
    const ids = Array.isArray(m.ids) ? m.ids.slice(0, 11) : [];
    const hx = num(m.x, -50, 50, 0), hy = num(m.y, -2, 30, 1), hz = num(m.z, -50, 50, 0);
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
    // Ms. Applebee's Q: the apple heals (sent as one +20 chunk, then ten +3 ticks), the bees boost her damage
    if (!p.room || !p.ready || !p.alive) return;
    const now = Date.now();
    if (m.k === "heal") {
      if (typeof m.amt !== "number" || m.amt <= 0 || m.amt > 20) return;
      if (now - p.honeyAt < 900) return; // keeps the once-a-second ticks from being spammed
      p.honeyAt = now;
      p.hp = Math.min(p.max, p.hp + m.amt);
      broadcast(p.room, { t: "hp", id: p.id, hp: +p.hp.toFixed(1), max: p.max, bonus: +p.bonus.toFixed(1), by: 0, dealt: 0 });
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
    honeyAt: 0, lastHoney: 0, dmgBoostUntil: 0, landPhoneAt: 0, // primary beam throttle
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

// send everyone's position 20 times a second
setInterval(() => {
  for (const room of rooms.values()) {
    if (room.players.size < 2) continue;
    const list = [];
    for (const p of room.players.values()) {
      if (p.ready && p.alive) {
        list.push({
          id: p.id, x: +p.x.toFixed(2), z: +p.z.toFixed(2),
          y: +p.y.toFixed(2), yaw: +p.yaw.toFixed(3), pitch: +p.pitch.toFixed(3), sh: p.sh, inv: p.inv,
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
