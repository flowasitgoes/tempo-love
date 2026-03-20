import { getAudioNow, playEvent, unlockAudio } from "./audio";
import { computeClockOffset, serverToAudioTime } from "./sync";

const joinForm = document.querySelector("#join-form");
const roomInput = document.querySelector("#room-input");
const statusEl = document.querySelector("#status");
const metaEl = document.querySelector("#meta");
const reactionEl = document.querySelector("#reaction");
const beatOrb = document.querySelector("#beat-orb");
const ambientToggleBtn = document.querySelector("#ambient-toggle");
const copyLinkBtn = document.querySelector("#copy-link");
const timelineBar = document.querySelector("#timeline-bar");
const foldStage = document.querySelector("#fold-stage");
const moodSelect = document.querySelector("#mood-select");
const energyFill = document.querySelector("#energy-fill");
const sparkLayer = document.querySelector("#spark-layer");
const pads = [...document.querySelectorAll(".pad")];
const loopToggles = [...document.querySelectorAll(".loop-toggle")];
const houseToggles = [...document.querySelectorAll(".house-toggle")];
const loveSendBtn = document.querySelector("#love-send");
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
let lastStepIndex = -1;
let lastPairMoment = 0;
const activeLoops = new Set();
const activeHouse = new Set();
let energy = 0;
let ambientEnabled = false;

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

function foldPulse(power = 1) {
  if (!foldStage) return;
  const bend = 8 + Math.min(20, energy * 0.16) + power * 3;
  const shift = ((Date.now() / 70) % 22) - 11;
  foldStage.style.setProperty("--fold-bend", `${bend}px`);
  foldStage.style.setProperty("--fold-shift", `${shift.toFixed(2)}px`);
  foldStage.classList.remove("active");
  requestAnimationFrame(() => foldStage.classList.add("active"));
}

function setEnergy(next) {
  energy = Math.max(0, Math.min(100, next));
  energyFill.style.width = `${energy}%`;
}

function boostEnergy(amount = 12) {
  setEnergy(energy + amount);
  foldPulse(Math.max(0.5, amount / 6));
}

function spawnSpark() {
  const node = document.createElement("span");
  node.className = "spark";
  node.style.left = `${Math.random() * 100}%`;
  node.style.animationDuration = `${2.4 + Math.random() * 1.4}s`;
  sparkLayer.appendChild(node);
  setTimeout(() => node.remove(), 3800);
}

function sendTrigger(eventName, subdivision = 1) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(
    JSON.stringify({
      type: "trigger",
      eventName,
      subdivision,
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

function toggleHouse(name, btn) {
  if (activeHouse.has(name)) {
    activeHouse.delete(name);
    btn.classList.remove("active");
  } else {
    activeHouse.add(name);
    btn.classList.add("active");
  }
  if (activeHouse.size === 0) {
    setReaction("House groove off. Tap your own heartbeat.");
    return;
  }
  setReaction(`Deep house groove: ${[...activeHouse].join(", ")}`);
  boostEnergy(12);
}

function setAmbientEnabled(enabled) {
  ambientEnabled = Boolean(enabled);
  if (ambientToggleBtn) {
    ambientToggleBtn.textContent = ambientEnabled ? "Ambient: On" : "Ambient: Off";
    ambientToggleBtn.classList.toggle("active", ambientEnabled);
  }
}

function doCopyRoomLink() {
  if (!roomId) {
    setReaction("Join a room first, then share the link.");
    return;
  }
  const url = `${location.origin}${location.pathname}?room=${encodeURIComponent(roomId)}`;
  navigator.clipboard
    .writeText(url)
    .then(() => setReaction("Room link copied. Invite gently."))
    .catch(() => setReaction("Copy failed. You can share the room name instead."));
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
      history.replaceState(null, "", `?room=${encodeURIComponent(roomId)}`);
      members = msg.members;
      tempo = msg.tempo || tempo;
      beatIntervalMs = msg.beatIntervalMs || beatIntervalMs;
      sessionStartAt = msg.sessionStartAt || Date.now();
      setAmbientEnabled(msg.ambientEnabled);
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

    if (msg.type === "ambient_update") {
      setAmbientEnabled(msg.enabled);
      setReaction(
        msg.enabled ? "Ambient is on. Breathe together." : "Ambient off. Focus on your taps.",
      );
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
      if (msg.eventName === "ambient") {
        boostEnergy(2);
        return;
      }

      flash();
      spawnSpark();
      boostEnergy(10);
      if (msg.from !== userId) {
        const t = Date.now();
        if (t - lastPairMoment < 800) {
          setReaction("Nice! That felt like a duet.");
        } else if (msg.eventName === "love") {
          setReaction("A love note arrived. Send one back?");
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

for (const btn of houseToggles) {
  btn.addEventListener("click", () => {
    unlockAudio();
    toggleHouse(btn.dataset.house || "kick", btn);
  });
}

ambientToggleBtn.addEventListener("click", () => {
  unlockAudio();
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    setReaction("Join a room first to turn ambient on.");
    return;
  }
  const next = !ambientEnabled;
  setAmbientEnabled(next);
  ws.send(JSON.stringify({ type: "toggle_ambient", enabled: next }));
  setReaction(next ? "Ambient on. Breathe together." : "Ambient off.");
});

copyLinkBtn.addEventListener("click", () => {
  doCopyRoomLink();
});

loveSendBtn.addEventListener("click", () => {
  unlockAudio();
  sendTrigger("love", 2);
  setReaction("Love sent ❤");
});

window.addEventListener("keydown", (e) => {
  if (e.key === "1") sendTrigger("pulse");
  if (e.key === "2") sendTrigger("glow");
  if (e.key === "3") sendTrigger("rain");
  if (e.key === "4") sendTrigger("bloom");
  if (e.key === "5") sendTrigger("drift");
  if (e.key === "6") sendTrigger("spark");
  if (e.key === "7") sendTrigger("kick");
  if (e.key === "8") sendTrigger("clap");
  if (e.key === "9") sendTrigger("hat", 2);
  if (e.key === "0") sendTrigger("loveChord");
});

moodSelect.addEventListener("change", () => {
  body.dataset.mood = moodSelect.value;
  if (foldStage) foldStage.dataset.mood = moodSelect.value;
  setReaction(`Mood changed to ${moodSelect.value}.`);
});

setInterval(() => {
  if (!sessionStartAt || !roomId) return;
  const now = Date.now() + clockOffsetMs;
  const beat = Math.floor((now - sessionStartAt) / beatIntervalMs);
  const step = Math.floor((now - sessionStartAt) / (beatIntervalMs / 2));

  if (timelineBar) {
    const cycle = ((beat % 16) + 16) % 16;
    timelineBar.style.width = `${(cycle / 16) * 100}%`;
  }

  if (beat !== lastBeatIndex) {
    lastBeatIndex = beat;
    bumpBeat();
    foldPulse(1);
    for (const eventName of activeLoops) {
      sendTrigger(eventName);
    }
  }

  if (step !== lastStepIndex) {
    lastStepIndex = step;
    const stepInBar = ((step % 8) + 8) % 8;
    if (activeHouse.has("kick") && stepInBar % 2 === 0) sendTrigger("kick");
    if (activeHouse.has("clap") && (stepInBar === 2 || stepInBar === 6)) sendTrigger("clap");
    if (activeHouse.has("hat") && stepInBar % 2 === 1) sendTrigger("hat", 2);
    if (activeHouse.has("loveChord") && stepInBar === 0) sendTrigger("loveChord");
  }
}, 40);

setInterval(() => {
  setEnergy(energy - 2.2);
}, 450);

setMeta();
setInterval(doPing, 5000);
setStatus("Enter a room to begin.");
setReaction("Press 1 to 6, add house groove, and send love.");

const urlParams = new URLSearchParams(location.search);
const presetRoom = urlParams.get("room");
if (presetRoom) {
  roomInput.value = presetRoom;
  setReaction(`Room ${presetRoom} prefilled. Press Join when ready.`);
}
