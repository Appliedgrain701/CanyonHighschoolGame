// Multiplayer server for the Canyon High game
const http = require("http");
const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || 3000;
const MAX_PLAYERS = 12;
const RESPAWN_MS = 3000;
const CHARS = { mahoney: { health: 275 } };

// The SERVER decides damage, so players can't edit their own numbers
const RULES = {
  phone: { dmg: 10, range: 95 },
  grenade: { dmg: 125, range: 70 },
  beam: { dmg: 150, range: 110 },
  hammer: { dmg: 99999, range: 10 }, // the only one-shot move
};
const SHIELD_BLOCK = 0.85;
const HAMMER_COOLDOWN = 25000; // a bit under the real 30s to allow for lag

const SPAWNS = [
  [-15, -35], [15, -35], [-15, 35], [15, 35], [0, -30],
  [0, 30], [-6, -12], [6, 12], [-6, 12], [6, -12],
];

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Game server is running");
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
  return { id: p.id, name: p.name, x: p.x, z: p.z, yaw: p.yaw, hp: p.hp, max: p.max, alive: p.alive };
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

// ---------- joining and leaving ----------
function join(p, m) {
  if (p.room) return;
  p.name =
    String(m.name || "").replace(/[^A-Za-z0-9 ]/g, "").trim().slice(0, 20) || "Player" + p.id;

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
  send(p, { t: "welcome", id: p.id, code: room.code, players: list });
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
  p.alive = true;
  p.sh = 0;
  p.inv = 0;
  broadcast(p.room, { t: "respawn", id: p.id, x: p.x, z: p.z, hp: p.hp, max: p.max });
}

function hit(a, m) {
  const room = a.room;
  const rule = RULES[m.k];
  const t = room.players.get(m.target);
  if (!rule || !t || t === a) return;
  if (!a.ready || !a.alive || !t.ready || !t.alive) return;
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
  if (t.inv) return; // can't be hurt during the ult

  let dmg = rule.dmg;
  if (t.sh) dmg *= 1 - SHIELD_BLOCK;
  const dealt = Math.min(dmg, t.hp);
  t.hp -= dmg;
  broadcast(room, {
    t: "hp", id: t.id, hp: Math.max(0, +t.hp.toFixed(1)), max: t.max, by: a.id, dealt,
  });

  if (t.hp <= 0) {
    t.hp = 0;
    t.alive = false;
    t.deaths++;
    a.kills++;
    const how = m.k === "hammer" ? "banned" : m.k === "beam" ? "beam" : "";
    broadcast(room, { t: "kill", killer: a.id, victim: t.id, how });
    t.respawnTimer = setTimeout(() => respawn(t), RESPAWN_MS);
  }
}

// ---------- messages ----------
function onMessage(p, m) {
  if (!m || typeof m.t !== "string") return;
  if (m.t === "join") return join(p, m);
  const room = p.room;
  if (!room) return;

  if (m.t === "ready") {
    if (p.ready) return;
    const ch = CHARS[m.char] || CHARS.mahoney;
    const s = pickSpawn(room);
    p.x = s[0];
    p.z = s[1];
    p.max = ch.health;
    p.hp = p.max;
    p.alive = true;
    p.ready = true;
    send(p, { t: "respawn", id: p.id, x: p.x, z: p.z, hp: p.hp, max: p.max });
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
  } else if (m.t === "fx") {
    // visual effects (phones, grenades, beams) just get passed on to everyone else
    const a = Array.isArray(m.a) ? m.a.slice(0, 8) : [];
    if (!a.every((v) => typeof v === "number" && Number.isFinite(v))) return;
    broadcast(room, { t: "fx", id: p.id, k: String(m.k).slice(0, 2), a }, p.id);
  } else if (m.t === "hit") {
    hit(p, m);
  }
}

wss.on("connection", (ws) => {
  const p = {
    id: nextId++, ws, room: null, name: "Player", ready: false, alive: false,
    x: 0, z: 0, yaw: 0, pitch: 0, sh: 0, inv: 0, hp: 275, max: 275,
    kills: 0, deaths: 0, hammerAt: 0, hammerHit: new Set(), respawnTimer: null,
  };
  ws.isAlive = true;
  ws.on("pong", () => (ws.isAlive = true));
  ws.on("message", (raw) => {
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
          yaw: +p.yaw.toFixed(3), pitch: +p.pitch.toFixed(3), sh: p.sh, inv: p.inv,
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

server.listen(PORT, () => console.log("Game server running on port " + PORT));
