import { getAudioNow, playEvent, unlockAudio } from "./audio";
import { computeClockOffset, serverToAudioTime } from "./sync";

const joinForm = document.querySelector("#join-form");
const roomInput = document.querySelector("#room-input");
const statusEl = document.querySelector("#status");
const metaEl = document.querySelector("#meta");
const reactionEl = document.querySelector("#reaction");
const beatOrb = document.querySelector("#beat-orb");
const moodSelect = document.querySelector("#mood-select");
const energyFill = document.querySelector("#energy-fill");
const sparkLayer = document.querySelector("#spark-layer");
const pads = [...document.querySelectorAll(".pad")];
const loopToggles = [...document.querySelectorAll(".loop-toggle")];
const body = document.body;

let ws;
let clockOffsetMs = 0;
let roomId = "";
let members = 0;
let tempo = 90;
let userId = "";
let beatIntervalMs = Math.round(60000 / 90);
let sessionStartAt = 0;
let lastBeatIndex = -1;
let lastPairMoment = 0;
const activeLoops = new Set();
let energy = 0;

function setStatus(text) {
  statusEl.textContent = text;
}

function setMeta() {
  metaEl.textContent = roomId
    ? `Room ${roomId} | ${members}/2 people | ${tempo} BPM`
    : "";
}

function setReaction(text) {
  reactionEl.textContent = text;
}

function wsUrl() {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const host = location.hostname;
  const savedPort = localStorage.getItem("tempo-love-server-port");
  const port = savedPort || "3322";
  return `${protocol}//${host}:${port}`;
}

function flash() {
  body.classList.remove("pulse-flash");
  requestAnimationFrame(() => body.classList.add("pulse-flash"));
}

function bumpBeat() {
  beatOrb.classList.remove("beat-hit");
  requestAnimationFrame(() => beatOrb.classList.add("beat-hit"));
}

function setEnergy(next) {
  energy = Math.max(0, Math.min(100, next));
  energyFill.style.width = `${energy}%`;
}

function boostEnergy(amount = 12) {
  setEnergy(energy + amount);
}

function spawnSpark() {
  const node = document.createElement("span");
  node.className = "spark";
  node.style.left = `${Math.random() * 100}%`;
  node.style.animationDuration = `${2.4 + Math.random() * 1.4}s`;
  sparkLayer.appendChild(node);
  setTimeout(() => node.remove(), 3800);
}

function sendTrigger(eventName) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(
    JSON.stringify({
      type: "trigger",
      eventName,
      clientSentAt: Date.now(),
    }),
  );
  boostEnergy(7);
}

function toggleLoop(eventName, btn) {
  if (activeLoops.has(eventName)) {
    activeLoops.delete(eventName);
    btn.classList.remove("active");
  } else {
    activeLoops.add(eventName);
    btn.classList.add("active");
  }

  if (activeLoops.size === 0) {
    setReaction("No loop running. Tap to start a vibe.");
    return;
  }
  setReaction(`Looping: ${[...activeLoops].join(", ")}`);
  boostEnergy(10);
}

function doPing() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const clientSentAt = Date.now();
  ws.send(JSON.stringify({ type: "sync_ping", clientSentAt }));
}

function connectAndJoin(targetRoomId) {
  ws = new WebSocket(wsUrl());

  ws.addEventListener("open", () => {
    setStatus("Connected. Joining room...");
    ws.send(JSON.stringify({ type: "join_room", roomId: targetRoomId }));
    doPing();
  });

  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);

    if (msg.type === "welcome") {
      userId = msg.userId;
      return;
    }

    if (msg.type === "sync_pong") {
      const receivedAt = Date.now();
      const offset = computeClockOffset(msg.clientSentAt, receivedAt, msg.serverNow);
      clockOffsetMs = Number.isFinite(offset) ? offset : 0;
      return;
    }

    if (msg.type === "joined_room") {
      roomId = msg.roomId;
      members = msg.members;
      tempo = msg.tempo || tempo;
      beatIntervalMs = msg.beatIntervalMs || beatIntervalMs;
      sessionStartAt = msg.sessionStartAt || Date.now();
      setStatus(members === 2 ? "You are in sync together." : "Waiting for one more person...");
      setMeta();
      setReaction("Try a tap, then turn on a loop.");
      return;
    }

    if (msg.type === "presence_update") {
      members = msg.members;
      setStatus(members === 2 ? "Both are here. Tap gently." : "One person is here. Waiting...");
      setMeta();
      if (members === 2) setReaction("You are not alone now. Build a groove together.");
      return;
    }

    if (msg.type === "room_full") {
      setStatus("Room is full. Try another room name.");
      return;
    }

    if (msg.type === "trigger_scheduled") {
      const nowMs = Date.now();
      const when = serverToAudioTime({
        scheduledAt: msg.scheduledAt,
        nowClientMs: nowMs,
        offsetMs: clockOffsetMs,
        audioNowSec: getAudioNow(),
      });
      playEvent(msg.eventName, when);
      flash();
      spawnSpark();
      boostEnergy(10);
      if (msg.from !== userId) {
        const t = Date.now();
        if (t - lastPairMoment < 800) {
          setReaction("Nice! That felt like a duet.");
        } else {
          setReaction(`They played ${msg.eventName}. Your turn?`);
        }
      } else {
        lastPairMoment = Date.now();
      }
    }
  });

  ws.addEventListener("close", () => {
    setStatus("Connection closed.");
    setReaction("Rejoin to continue.");
  });
}

joinForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const value = roomInput.value.trim();
  if (!value) return;
  unlockAudio();
  setStatus("Connecting...");
  connectAndJoin(value);
});

for (const pad of pads) {
  pad.addEventListener("click", () => {
    unlockAudio();
    sendTrigger(pad.dataset.sound || "pulse");
  });
}

for (const btn of loopToggles) {
  btn.addEventListener("click", () => {
    unlockAudio();
    toggleLoop(btn.dataset.loop || "pulse", btn);
  });
}

window.addEventListener("keydown", (e) => {
  if (e.key === "1") sendTrigger("pulse");
  if (e.key === "2") sendTrigger("glow");
  if (e.key === "3") sendTrigger("rain");
  if (e.key === "4") sendTrigger("bloom");
  if (e.key === "5") sendTrigger("drift");
  if (e.key === "6") sendTrigger("spark");
});

moodSelect.addEventListener("change", () => {
  body.dataset.mood = moodSelect.value;
  setReaction(`Mood changed to ${moodSelect.value}.`);
});

setInterval(() => {
  if (!sessionStartAt || !roomId) return;
  const now = Date.now() + clockOffsetMs;
  const beat = Math.floor((now - sessionStartAt) / beatIntervalMs);
  if (beat !== lastBeatIndex) {
    lastBeatIndex = beat;
    bumpBeat();
    for (const eventName of activeLoops) {
      sendTrigger(eventName);
    }
  }
}, 40);

setInterval(() => {
  setEnergy(energy - 2.2);
}, 450);

setMeta();
setInterval(doPing, 5000);
setStatus("Enter a room to begin.");
setReaction("Press 1 to 6, or turn on loops.");
