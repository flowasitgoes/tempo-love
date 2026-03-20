const http = require("http");
const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || 3001;
const TEMPO = 90;
const BEAT_INTERVAL_MS = Math.round(60000 / TEMPO);
const START_DELAY_MS = 2000;
const MAX_ROOM_SIZE = 2;

const rooms = new Map();

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      clients: new Set(),
      tempo: TEMPO,
      beatIntervalMs: BEAT_INTERVAL_MS,
      sessionStartAt: Date.now() + START_DELAY_MS,
      ambientEnabled: false,
      lastAmbientScheduledBeatIndex: null,
      tickerIntervalId: null,
    });

    // Per-room lightweight ticker: the server stays the single clock source for ambient.
    const room = rooms.get(roomId);
    const tickMs = Math.max(60, Math.round(room.beatIntervalMs / 6));
    room.tickerIntervalId = setInterval(() => {
      if (!rooms.has(roomId)) return;
      if (!room.ambientEnabled) return;

      const now = Date.now();
      const scheduledAt = nearestFutureBeat(now + 80, room.sessionStartAt, room.beatIntervalMs);
      const scheduledBeatIndex = Math.max(
        0,
        Math.round((scheduledAt - room.sessionStartAt) / room.beatIntervalMs),
      );

      if (room.lastAmbientScheduledBeatIndex === scheduledBeatIndex) return;
      room.lastAmbientScheduledBeatIndex = scheduledBeatIndex;

      // Breathing calm: ambient every other beat.
      if (scheduledBeatIndex % 2 === 0) {
        broadcast(room, {
          type: "trigger_scheduled",
          eventName: "ambient",
          from: "server",
          scheduledAt,
          serverNow: now,
        });
      }
    }, tickMs);
  }
  return rooms.get(roomId);
}

function send(ws, payload) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcast(room, payload) {
  for (const client of room.clients) {
    send(client, payload);
  }
}

function nearestFutureBeat(now, sessionStartAt, beatIntervalMs) {
  if (now <= sessionStartAt) return sessionStartAt;
  const elapsed = now - sessionStartAt;
  const beatsPassed = Math.ceil(elapsed / beatIntervalMs);
  return sessionStartAt + beatsPassed * beatIntervalMs;
}

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  ws.userId = Math.random().toString(36).slice(2, 8);
  ws.roomId = null;

  send(ws, { type: "welcome", serverNow: Date.now(), userId: ws.userId });

  ws.on("message", (raw) => {
    let data;
    try {
      data = JSON.parse(raw.toString());
    } catch {
      send(ws, { type: "error", message: "Invalid payload." });
      return;
    }

    if (data.type === "sync_ping") {
      send(ws, { type: "sync_pong", clientSentAt: data.clientSentAt, serverNow: Date.now() });
      return;
    }

    if (data.type === "join_room") {
      const roomId = String(data.roomId || "").trim().toLowerCase();
      if (!roomId) {
        send(ws, { type: "error", message: "Room id is required." });
        return;
      }
      const room = getOrCreateRoom(roomId);
      if (room.clients.size >= MAX_ROOM_SIZE) {
        send(ws, { type: "room_full", roomId });
        return;
      }

      ws.roomId = roomId;
      room.clients.add(ws);

      send(ws, {
        type: "joined_room",
        roomId,
        members: room.clients.size,
        tempo: room.tempo,
        beatIntervalMs: room.beatIntervalMs,
        sessionStartAt: room.sessionStartAt,
        ambientEnabled: room.ambientEnabled,
        serverNow: Date.now(),
      });

      broadcast(room, {
        type: "presence_update",
        roomId,
        members: room.clients.size,
        serverNow: Date.now(),
      });
      return;
    }

    if (data.type === "trigger") {
      if (!ws.roomId) return;
      const room = rooms.get(ws.roomId);
      if (!room) return;

      const eventName = String(data.eventName || "pulse");
      const now = Date.now();
      const scheduledAt = nearestFutureBeat(now + 120, room.sessionStartAt, room.beatIntervalMs);

      broadcast(room, {
        type: "trigger_scheduled",
        eventName,
        from: ws.userId,
        scheduledAt,
        serverNow: now,
      });
    }

    if (data.type === "toggle_ambient") {
      if (!ws.roomId) return;
      const room = rooms.get(ws.roomId);
      if (!room) return;

      room.ambientEnabled = Boolean(data.enabled);
      room.lastAmbientScheduledBeatIndex = null;

      broadcast(room, {
        type: "ambient_update",
        roomId: ws.roomId,
        enabled: room.ambientEnabled,
        serverNow: Date.now(),
      });
    }
  });

  ws.on("close", () => {
    if (!ws.roomId) return;
    const room = rooms.get(ws.roomId);
    if (!room) return;
    room.clients.delete(ws);

    if (room.clients.size === 0) {
      if (room.tickerIntervalId) clearInterval(room.tickerIntervalId);
      rooms.delete(ws.roomId);
      return;
    }

    broadcast(room, {
      type: "presence_update",
      roomId: ws.roomId,
      members: room.clients.size,
      serverNow: Date.now(),
    });
  });
});

server.listen(PORT, () => {
  console.log(`Tempo Love server running on ws://localhost:${PORT}`);
});
