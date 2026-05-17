import { loadGameData, saveGameData } from "./game-storage.js";

const ARM_ENDPOINTS = [
  { id: "left-arm", label: "左腕", shoulder: 11, elbow: 13, wrist: 15 },
  { id: "right-arm", label: "右腕", shoulder: 12, elbow: 14, wrist: 16 },
];

const POSE_BODY_CONNECTIONS = [
  [11, 12],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
];

const FRUIT_TYPES = [
  { name: "apple", skin: "#f45b4f", flesh: "#ffd7b2", juice: "#ff6b58", seed: "#7a2f22", asset: "./assets/fruit/apple.svg" },
  { name: "orange", skin: "#f2a43b", flesh: "#ffd36d", juice: "#ffb13b", seed: "#a75c16", asset: "./assets/fruit/orange.svg" },
  { name: "lime", skin: "#8fd34f", flesh: "#d6ff8d", juice: "#b6ef59", seed: "#47772b", asset: "./assets/fruit/lime.svg" },
  { name: "berry", skin: "#cc5bd6", flesh: "#f0a3ff", juice: "#da6fea", seed: "#692869", asset: "./assets/fruit/berry.svg" },
  { name: "melon", skin: "#42bd87", flesh: "#ff7e79", juice: "#ff6b74", seed: "#2d1f22", asset: "./assets/fruit/melon.svg" },
];

const SPECIAL_TYPES = {
  freeze: { name: "freeze", label: "冰冻", skin: "#5ed8ff", flesh: "#e6fbff", juice: "#88f7ff", seed: "#2075a4", tone: "136, 247, 255" },
  double: { name: "double", label: "双倍", skin: "#ffd24d", flesh: "#fff1a8", juice: "#ffd166", seed: "#9b6b00", tone: "255, 209, 102" },
  frenzy: { name: "frenzy", label: "狂热", skin: "#ff7a42", flesh: "#ffd1a3", juice: "#ff8a3d", seed: "#8a2e16", tone: "255, 122, 66" },
};

const imageAssets = {
  background: loadImage("./assets/fruit/dojo-bg.svg"),
  bomb: loadImage("./assets/fruit/bomb.svg"),
  fruits: new Map(FRUIT_TYPES.map((type) => [type.name, loadImage(type.asset)])),
};

const TRACK_TIMEOUT_MS = 360;
const POSE_VISIBILITY_THRESHOLD = 0.25;
const ARM_BLADE_MIN_SPEED = 0.28;
const FPS_SAMPLE_MS = 500;
const ROUND_DURATION_MS = 45000;
const START_DELAY_MS = 5000;
const RESULT_RETURN_DELAY_MS = 5000;
const FREEZE_DURATION_MS = 4200;
const FREEZE_TIME_SCALE = 0.32;
const DOUBLE_DURATION_MS = 6000;
const FRENZY_DURATION_MS = 7000;
const FRENZY_SPAWN_INTERVAL_MS = 300;
const FRENZY_BURST_FRUIT_COUNT = 3;
const BOMB_SCORE_PENALTY = 100;
const BOMB_TIME_PENALTY_MS = 1000;
const SPECIAL_SAFE_START_MS = 10000;
const SPECIAL_SPAWN_WINDOW_MS = ROUND_DURATION_MS - 9000;
const SPECIAL_TYPES_ORDER = [
  { key: "freeze", special: "freeze", side: "left" },
  { key: "double", special: "double", side: "right" },
  { key: "frenzy", special: "frenzy", side: "left" },
];
const BACKGROUND_MUSIC_SRC = "./Halfbrick - Welcome, Fruit Ninja.mp3";
const BACKGROUND_MUSIC_VOLUME = 0.34;
const LEADERBOARD_LIMIT = 8;

const els = {
  canvas: document.querySelector("#gameCanvas"),
  frame: document.querySelector(".canvas-frame"),
  startGameButton: document.querySelector("#startGameButton"),
  startCameraButton: document.querySelector("#startCameraButton"),
  musicButton: document.querySelector("#musicButton"),
  startOverlay: document.querySelector("#startOverlay"),
  playerNameInput: document.querySelector("#playerNameInput"),
  startRoundButton: document.querySelector("#startRoundButton"),
  startError: document.querySelector("#startError"),
  menuScoreValue: document.querySelector("#menuScoreValue"),
  menuBestValue: document.querySelector("#menuBestValue"),
  leaderboardList: document.querySelector("#leaderboardList"),
  settlementOverlay: document.querySelector("#settlementOverlay"),
  settlementName: document.querySelector("#settlementName"),
  settlementScore: document.querySelector("#settlementScore"),
  centerMessage: document.querySelector("#centerMessage"),
  scoreValue: document.querySelector("#scoreValue"),
  scoreTile: document.querySelector("#scoreTile"),
  scoreMultiplier: document.querySelector("#scoreMultiplier"),
  specialStatusRow: document.querySelector("#specialStatusRow"),
  comboValue: document.querySelector("#comboValue"),
  lifeValue: document.querySelector("#lifeValue"),
  timerTile: document.querySelector("#timerTile"),
  bestValue: document.querySelector("#bestValue"),
  fruitValue: document.querySelector("#fruitValue"),
  bombValue: document.querySelector("#bombValue"),
  missValue: document.querySelector("#missValue"),
  inputModeValue: document.querySelector("#inputModeValue"),
  detectedValue: document.querySelector("#detectedValue"),
  dangerValue: document.querySelector("#dangerValue"),
  fpsValue: document.querySelector("#fpsValue"),
  cameraPreview: document.querySelector("#cameraPreview"),
  handOverlay: document.querySelector("#handOverlay"),
  cameraPlaceholder: document.querySelector("#cameraPlaceholder"),
  leftHandStatus: document.querySelector("#leftHandStatus"),
  rightHandStatus: document.querySelector("#rightHandStatus"),
  difficultyRow: document.querySelector("#difficultyRow"),
};

const ctx = els.canvas.getContext("2d");

const state = {
  running: false,
  roundOver: false,
  countdownRemainingMs: 0,
  countdownTickAt: 0,
  settlementVisible: false,
  settlementTimerId: 0,
  lastTime: 0,
  spawnAt: 0,
  roundStartedAt: 0,
  roundEndsAt: 0,
  roundTickAt: 0,
  roundTimeLeftMs: ROUND_DURATION_MS,
  specialMarks: new Set(),
  specialSchedule: [],
  specialSpawnElapsedMs: 0,
  freezeUntil: 0,
  doubleUntil: 0,
  frenzyUntil: 0,
  frenzySpawnAt: 0,
  playerName: "",
  lastScore: 0,
  leaderboard: [],
  score: 0,
  combo: 0,
  best: 0,
  fruitHits: 0,
  bombHits: 0,
  misses: 0,
  detectedCount: 0,
  dangerCount: 0,
  fps: 0,
  fpsFrames: 0,
  fpsSampleAt: 0,
  difficulty: "normal",
  objects: [],
  particles: [],
  trails: [],
  shake: {
    intensity: 0,
    endAt: 0,
    duration: 0,
  },
  flash: {
    tone: "66, 245, 221",
    endAt: 0,
    duration: 0,
    alpha: 0,
  },
  bladePoints: new Map(),
  poseMasks: new Map(),
  armBones: new Map(),
  width: 1,
  height: 1,
  dpr: 1,
  pointerDown: false,
  audio: null,
  music: null,
  musicEnabled: true,
  cameraRunning: false,
  cameraStarting: false,
  poseLoopRunning: false,
  armTracks: new Map(),
};

bindEvents();
resizeCanvas();
renderStats();
syncMusicButton();
renderStartScreen();
showStartScreen();
loadStoredData();
startCamera();
requestAnimationFrame(loop);

async function loadStoredData() {
  const data = await loadGameData();
  state.playerName = data.fruitYolo.playerName;
  state.lastScore = data.fruitYolo.lastScore;
  state.leaderboard = data.fruitYolo.leaderboard;
  state.best = Math.max(data.fruitYolo.best, ...state.leaderboard.map((entry) => entry.score), 0);
  renderStats();
  renderStartScreen();
}

function persistYoloData(fields) {
  void saveGameData({
    fruitYolo: fields,
  });
}

function bindEvents() {
  window.addEventListener("resize", resizeCanvas);
  els.startGameButton.addEventListener("click", toggleGame);
  els.startCameraButton?.addEventListener("click", startCamera);
  els.musicButton.addEventListener("click", toggleMusic);
  els.startRoundButton.addEventListener("click", toggleGame);
  els.playerNameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      toggleGame();
    }
  });

  els.difficultyRow.addEventListener("click", (event) => {
    const button = event.target.closest("[data-level]");
    if (!button || state.running) return;
    state.difficulty = button.dataset.level;
    [...els.difficultyRow.children].forEach((item) => {
      item.classList.toggle("is-active", item === button);
    });
  });

  els.canvas.addEventListener("pointerdown", (event) => {
    state.pointerDown = true;
    els.canvas.setPointerCapture(event.pointerId);
    addBladePoint("pointer", canvasPoint(event), performance.now());
  });

  els.canvas.addEventListener("pointermove", (event) => {
    if (!state.pointerDown) return;
    addBladePoint("pointer", canvasPoint(event), performance.now());
  });

  els.canvas.addEventListener("pointerup", (event) => {
    state.pointerDown = false;
    els.canvas.releasePointerCapture(event.pointerId);
    clearBlade("pointer");
  });

  els.canvas.addEventListener("pointercancel", () => {
    state.pointerDown = false;
    clearBlade("pointer");
  });
}

function toggleGame() {
  if (state.settlementVisible) return;

  if (state.running) {
    if (state.countdownRemainingMs > 0) {
      updateStartCountdown(performance.now());
      state.countdownTickAt = 0;
    }
    state.running = false;
    els.startGameButton.textContent = "继续";
    pauseBackgroundMusic();
    showCenterMessage("YOLO PAUSED");
    return;
  }

  if (!preparePlayerName()) return;
  ensureAudio();

  if (shouldStartFreshRound()) {
    resetGame();
    beginStartCountdown(performance.now());
  } else if (state.countdownRemainingMs > 0) {
    state.countdownTickAt = performance.now();
  }

  const now = performance.now();
  state.running = true;
  state.lastTime = now;
  els.startGameButton.textContent = "暂停";
  playBackgroundMusic();
  hideStartScreen();
  if (state.countdownRemainingMs > 0) {
    showCountdownMessage();
  } else {
    hideCenterMessage();
  }
}

function shouldStartFreshRound() {
  return (
    state.roundOver ||
    (state.roundStartedAt === 0 && state.countdownRemainingMs <= 0 && state.objects.length === 0)
  );
}

function preparePlayerName() {
  const name = normalizePlayerName(els.playerNameInput.value);
  if (!name) {
    showStartScreen("请输入班级姓名");
    els.playerNameInput.focus();
    return false;
  }

  state.playerName = name;
  persistYoloData({ playerName: state.playerName });
  els.playerNameInput.value = name;
  els.startError.textContent = "";
  return true;
}

function toggleMusic() {
  state.musicEnabled = !state.musicEnabled;
  ensureAudio();
  if (state.musicEnabled && state.running) {
    playBackgroundMusic();
  } else {
    pauseBackgroundMusic();
  }
  syncMusicButton();
}

function beginStartCountdown(now) {
  state.countdownRemainingMs = START_DELAY_MS;
  state.countdownTickAt = now;
  state.roundStartedAt = 0;
  state.roundEndsAt = 0;
  state.roundTickAt = 0;
  showCountdownMessage();
}

function updateStartCountdown(now) {
  if (state.countdownRemainingMs <= 0) return;

  const elapsed = state.countdownTickAt ? Math.max(0, now - state.countdownTickAt) : 0;
  state.countdownTickAt = now;
  state.countdownRemainingMs = Math.max(0, state.countdownRemainingMs - elapsed);
  showCountdownMessage();

  if (state.countdownRemainingMs <= 0) {
    state.countdownTickAt = 0;
    startRoundClock(now);
    state.spawnAt = now + 380;
    hideCenterMessage();
  }
}

function showCountdownMessage() {
  renderRoundTimer();
  showCenterMessage(`准备 ${Math.ceil(state.countdownRemainingMs / 1000)}`);
}

function startRoundClock(now) {
  if (!state.roundStartedAt || state.roundTimeLeftMs <= 0) {
    state.roundStartedAt = now;
    state.roundTimeLeftMs = ROUND_DURATION_MS;
    state.specialMarks = new Set();
    state.specialSchedule = createSpecialSchedule();
    state.specialSpawnElapsedMs = 0;
  } else {
    state.roundStartedAt = now - (ROUND_DURATION_MS - state.roundTimeLeftMs);
  }

  state.roundEndsAt = now + state.roundTimeLeftMs;
  state.roundTickAt = now;
  state.roundOver = false;
  renderRoundTimer();
}

function resetGame() {
  state.roundOver = false;
  state.countdownRemainingMs = 0;
  state.countdownTickAt = 0;
  state.roundStartedAt = 0;
  state.roundEndsAt = 0;
  state.roundTickAt = 0;
  state.roundTimeLeftMs = ROUND_DURATION_MS;
  state.specialMarks = new Set();
  state.specialSchedule = createSpecialSchedule();
  state.specialSpawnElapsedMs = 0;
  state.freezeUntil = 0;
  state.doubleUntil = 0;
  state.frenzyUntil = 0;
  state.frenzySpawnAt = 0;
  state.score = 0;
  state.combo = 0;
  state.fruitHits = 0;
  state.bombHits = 0;
  state.misses = 0;
  state.detectedCount = 0;
  state.dangerCount = 0;
  state.objects = [];
  state.particles = [];
  state.trails = [];
  state.shake.intensity = 0;
  state.shake.endAt = 0;
  state.flash.alpha = 0;
  state.flash.endAt = 0;
  state.bladePoints.clear();
  state.poseMasks.clear();
  state.armBones.clear();
  state.armTracks.clear();
  renderStats();
}

async function startCamera() {
  if (state.cameraRunning || state.cameraStarting) return;

  state.cameraStarting = true;
  setCameraButton("加载模型", true);
  setCameraPlaceholder("加载骨骼模型");
  syncArmStatus();

  let stream = null;

  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Camera API unavailable");
    }

    const { PoseLandmarker, FilesetResolver } = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18");
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm",
    );

    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: "user",
      },
      audio: false,
    });

    els.cameraPreview.srcObject = stream;
    await els.cameraPreview.play();
    setCameraPlaceholder("正在启用骨骼识别");

    const landmarker = await createPoseLandmarker(PoseLandmarker, vision);

    state.cameraRunning = true;
    state.cameraStarting = false;
    state.poseLoopRunning = true;
    if (els.inputModeValue) els.inputModeValue.textContent = "骨骼";
    setCameraButton("识别已启动", true);
    els.cameraPlaceholder.classList.add("is-hidden");
    requestAnimationFrame(() => poseLoop(landmarker));
  } catch (error) {
    console.error(error);
    stopCameraStream(stream);
    els.cameraPreview.srcObject = null;
    state.cameraStarting = false;
    setCameraButton("重试识别", false);
    setCameraPlaceholder("识别不可用，点击重试");
    if (els.inputModeValue) els.inputModeValue.textContent = "鼠标";
  }
}

async function createPoseLandmarker(PoseLandmarker, vision) {
  const baseOptions = {
    modelAssetPath:
      "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task",
  };
  const options = {
    runningMode: "VIDEO",
    numPoses: 1,
    minPoseDetectionConfidence: 0.35,
    minPosePresenceConfidence: 0.35,
    minTrackingConfidence: 0.35,
  };

  try {
    return await PoseLandmarker.createFromOptions(vision, {
      ...options,
      baseOptions: {
        ...baseOptions,
        delegate: "GPU",
      },
    });
  } catch (error) {
    console.warn("GPU pose delegate failed; falling back to CPU.", error);
    return PoseLandmarker.createFromOptions(vision, {
      ...options,
      baseOptions: {
        ...baseOptions,
        delegate: "CPU",
      },
    });
  }
}

function setCameraButton(text, disabled) {
  if (!els.startCameraButton) return;
  els.startCameraButton.textContent = text;
  els.startCameraButton.disabled = disabled;
}

function setCameraPlaceholder(text) {
  els.cameraPlaceholder.textContent = text;
  els.cameraPlaceholder.classList.remove("is-hidden");
}

function stopCameraStream(stream) {
  for (const track of stream?.getTracks?.() ?? []) {
    track.stop();
  }
}

function poseLoop(landmarker) {
  if (!state.poseLoopRunning) return;

  const video = els.cameraPreview;
  const now = performance.now();
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    const result = landmarker.detectForVideo(video, now);
    updatePose(result, now);
    drawPoseOverlay(result.landmarks ?? []);
  }

  requestAnimationFrame(() => poseLoop(landmarker));
}

function updatePose(result, now) {
  const seen = new Set();
  const pose = result.landmarks?.[0];

  if (pose) {
    updatePoseMask("pose", pose, now);
    for (const endpoint of ARM_ENDPOINTS) {
      const wrist = pose[endpoint.wrist];
      const elbow = pose[endpoint.elbow];
      if (!isLandmarkVisible(wrist) || !isLandmarkVisible(elbow)) continue;

      const wristPoint = normalizedToStagePoint(wrist);
      const elbowPoint = normalizedToStagePoint(elbow);
      const track = getArmTrack(endpoint, wristPoint, elbowPoint, now);

      updateArmTrack(track, wristPoint, elbowPoint, now);
      seen.add(track.id);
      state.armBones.set(track.id, {
        id: track.id,
        label: endpoint.label,
        elbow: track.elbow,
        wrist: track.point,
        speed: track.speed,
        t: now,
      });
      addBladePoint(track.id, track.point, now);
    }
  }

  for (const [id, track] of state.armTracks) {
    if (!seen.has(id) && now - track.lastSeenAt > TRACK_TIMEOUT_MS) {
      state.armTracks.delete(id);
      state.armBones.delete(id);
      clearBlade(id);
    }
  }

  syncArmStatus();
}

function getArmTrack(endpoint, wrist, elbow, now) {
  const track = state.armTracks.get(endpoint.id);
  if (track) return track;

  const nextTrack = {
    id: endpoint.id,
    label: endpoint.label,
    point: { ...wrist },
    elbow: { ...elbow },
    previousPoint: { ...wrist },
    velocity: { x: 0, y: 0 },
    speed: 0,
    lastSeenAt: now,
    path: [],
  };
  state.armTracks.set(endpoint.id, nextTrack);
  return nextTrack;
}

function updateArmTrack(track, point, elbow, now) {
  const dt = Math.max(16, now - track.lastSeenAt);
  const blend = 0.42;
  const smoothed = {
    x: track.point.x * (1 - blend) + point.x * blend,
    y: track.point.y * (1 - blend) + point.y * blend,
  };
  const smoothedElbow = {
    x: track.elbow.x * (1 - blend) + elbow.x * blend,
    y: track.elbow.y * (1 - blend) + elbow.y * blend,
  };

  track.previousPoint = track.point;
  track.velocity = {
    x: (smoothed.x - track.point.x) / dt,
    y: (smoothed.y - track.point.y) / dt,
  };
  track.speed = distance(smoothed, track.point) / dt;
  track.point = smoothed;
  track.elbow = smoothedElbow;
  track.lastSeenAt = now;
  track.path.push({ ...smoothed, t: now });
  track.path = track.path.filter((item) => now - item.t < 420).slice(-18);
}

function syncArmStatus() {
  const tracks = [...state.armTracks.values()]
    .filter((track) => performance.now() - track.lastSeenAt < TRACK_TIMEOUT_MS)
    .sort((a, b) => a.id.localeCompare(b.id));
  updateArmText(els.leftHandStatus, tracks.find((track) => track.id === "left-arm"));
  updateArmText(els.rightHandStatus, tracks.find((track) => track.id === "right-arm"));
}

function updateArmText(element, track) {
  if (!track) {
    element.textContent = "等待";
    return;
  }

  const x = Math.round((track.point.x / state.width) * 100);
  const y = Math.round((track.point.y / state.height) * 100);
  element.textContent = `${x}, ${y}`;
}

function loop(now) {
  const dt = Math.min(0.034, (now - state.lastTime) / 1000 || 0.016);
  state.lastTime = now;

  if (state.running) {
    if (state.countdownRemainingMs > 0) {
      updateStartCountdown(now);
    } else {
      updateRound(now);
    }
  }

  if (state.running && state.countdownRemainingMs <= 0) {
    maybeSpawnSpecial(now);
    maybeSpawnFrenzy(now);
    maybeSpawn(now);
    updateObjects(dt * getWorldTimeScale(now));
    updateParticles(dt);
    pruneBlades(now);
    checkSlices(now);
  } else {
    updateParticles(dt);
    pruneBlades(now);
  }

  updateYoloTelemetry(now);
  updateHudEffects(now);
  draw(now);
  requestAnimationFrame(loop);
}

function updateRound(now) {
  const elapsedSinceTick = state.roundTickAt ? Math.max(0, now - state.roundTickAt) : 0;
  state.specialSpawnElapsedMs += elapsedSinceTick;
  if (isFreezeActive(now)) {
    state.roundEndsAt += elapsedSinceTick;
  }
  state.roundTickAt = now;
  state.roundTimeLeftMs = Math.max(0, state.roundEndsAt - now);
  renderRoundTimer();

  if (state.roundTimeLeftMs <= 0) {
    endRound();
  }
}

function endRound() {
  state.running = false;
  state.roundOver = true;
  state.countdownRemainingMs = 0;
  state.countdownTickAt = 0;
  state.roundTimeLeftMs = 0;
  state.combo = 0;
  pauseBackgroundMusic();
  recordRoundScore();
  els.startGameButton.textContent = "开局";
  hideCenterMessage();
  renderStats();
  showSettlementScreen();
}

function recordRoundScore() {
  state.lastScore = state.score;

  const name = state.playerName || normalizePlayerName(els.playerNameInput.value) || "未命名";
  state.leaderboard.push({
    name,
    score: state.score,
    at: Date.now(),
  });
  state.leaderboard = mergeLeaderboardByName(state.leaderboard);
  persistYoloData({
    best: state.best,
    lastScore: state.lastScore,
    playerName: state.playerName,
    leaderboard: state.leaderboard,
  });
  renderStartScreen();
}

function mergeLeaderboardByName(entries) {
  const byName = new Map();
  for (const entry of entries) {
    const name = normalizePlayerName(entry.name) || "未命名";
    const normalized = {
      name,
      score: Math.max(0, Math.round(Number(entry.score) || 0)),
      at: Number(entry.at) || 0,
    };
    const current = byName.get(name);
    if (!current || normalized.score > current.score || (normalized.score === current.score && normalized.at < current.at)) {
      byName.set(name, normalized);
    }
  }

  return [...byName.values()].sort((a, b) => b.score - a.score || a.at - b.at).slice(0, LEADERBOARD_LIMIT);
}

function getWorldTimeScale(now) {
  return now < state.freezeUntil ? FREEZE_TIME_SCALE : 1;
}

function isFreezeActive(now = performance.now()) {
  return now < state.freezeUntil;
}

function isDoubleActive(now = performance.now()) {
  return now < state.doubleUntil;
}

function isFrenzyActive(now = performance.now()) {
  return now < state.frenzyUntil;
}

function createSpecialSchedule() {
  return SPECIAL_TYPES_ORDER.map((item) => ({
    ...item,
    at: random(SPECIAL_SAFE_START_MS, SPECIAL_SPAWN_WINDOW_MS),
  }));
}

function maybeSpawnSpecial(now) {
  const elapsed = state.specialSpawnElapsedMs;
  if (elapsed < SPECIAL_SAFE_START_MS) return;

  if (state.specialSchedule.length === 0) {
    state.specialSchedule = createSpecialSchedule();
  }

  for (const mark of state.specialSchedule) {
    if (state.specialMarks.has(mark.key) || elapsed < mark.at) continue;
    state.specialMarks.add(mark.key);
    spawnSpecialObject(mark.special, mark.side);
  }
}

function maybeSpawnFrenzy(now) {
  if (!isFrenzyActive(now) || now < state.frenzySpawnAt) return;

  for (let index = 0; index < FRENZY_BURST_FRUIT_COUNT; index += 1) {
    spawnFrenzyFruit(index % 2 === 0 ? "left" : "right", index);
  }
  state.frenzySpawnAt = now + FRENZY_SPAWN_INTERVAL_MS;
}

function maybeSpawn(now) {
  if (now < state.spawnAt) return;

  const fast = state.difficulty === "fast";
  const count = Math.random() < (fast ? 0.62 : 0.38) ? (fast && Math.random() < 0.32 ? 3 : 2) : 1;
  for (let index = 0; index < count; index += 1) {
    spawnObject(index * 80);
  }

  const delay = (fast ? random(300, 560) : random(480, 780)) * (isFreezeActive(now) ? 1.65 : 1);
  state.spawnAt = now + delay;
}

function spawnObject(offset = 0) {
  const width = state.width;
  const height = state.height;
  const fast = state.difficulty === "fast";
  const isBomb = Math.random() < (fast ? 0.18 : 0.13);
  const radius = isBomb ? random(26, 34) : random(38, 58);
  const x = random(width * 0.16, width * 0.84);
  const vx = random(-260, 260) + (width / 2 - x) * 0.18;
  const vy = -random(height * (fast ? 1.12 : 1.04), height * (fast ? 1.42 : 1.26)) - offset;
  const type = FRUIT_TYPES[Math.floor(Math.random() * FRUIT_TYPES.length)];

  state.objects.push({
    id: crypto.randomUUID(),
    kind: isBomb ? "bomb" : "fruit",
    trackId: `${isBomb ? "BOMB" : "FRUIT"}-${Math.floor(random(100, 999))}`,
    confidenceSeed: random(0, Math.PI * 2),
    type,
    x,
    y: height + radius + offset * 0.2,
    vx,
    vy,
    radius,
    rotation: random(0, Math.PI * 2),
    spin: random(-4, 4),
    sliced: false,
    missed: false,
  });
}

function spawnSpecialObject(special = "freeze", side = "left", index = 0) {
  const specialType = SPECIAL_TYPES[special] ?? SPECIAL_TYPES.freeze;
  const width = state.width;
  const height = state.height;
  const fromLeft = side === "left";
  const radius = random(42, 52);
  const y = clamp(random(height * 0.34, height * 0.68) + index * random(-30, 30), radius + 24, height - radius - 80);
  const vx = (fromLeft ? 1 : -1) * random(380, 540);
  const vy = random(-130, 70);

  state.objects.push({
    id: crypto.randomUUID(),
    kind: "special",
    special,
    trackId: `${specialType.label}-${Math.floor(random(100, 999))}`,
    confidenceSeed: random(0, Math.PI * 2),
    type: specialType,
    x: fromLeft ? -radius - 36 : width + radius + 36,
    y,
    vx,
    vy,
    radius,
    gravityScale: 0.12,
    rotation: random(0, Math.PI * 2),
    spin: random(-5.5, 5.5),
    sliced: false,
    missed: false,
  });

  showText(specialType.label, fromLeft ? 126 : width - 126, y, specialType.juice);
}

function spawnFrenzyFruit(side = "left", index = 0) {
  const width = state.width;
  const height = state.height;
  const fromLeft = side === "left";
  const radius = random(34, 50);
  const type = FRUIT_TYPES[Math.floor(Math.random() * FRUIT_TYPES.length)];

  state.objects.push({
    id: crypto.randomUUID(),
    kind: "fruit",
    trackId: `RUSH-${Math.floor(random(100, 999))}`,
    confidenceSeed: random(0, Math.PI * 2),
    type,
    x: fromLeft ? -radius - index * 18 : width + radius + index * 18,
    y: random(height * 0.2, height * 0.68),
    vx: (fromLeft ? 1 : -1) * random(520, 780),
    vy: random(-420, -120),
    radius,
    gravityScale: 0.75,
    frenzy: true,
    rotation: random(0, Math.PI * 2),
    spin: random(-7, 7),
    sliced: false,
    missed: false,
  });
}

function updateObjects(dt) {
  const height = state.height;
  const gravity = state.difficulty === "fast" ? 980 : 900;

  for (const object of state.objects) {
    object.x += object.vx * dt;
    object.y += object.vy * dt;
    object.vy += gravity * (object.gravityScale ?? 1) * dt;
    object.rotation += object.spin * dt;

    if (object.kind === "fruit" && !object.frenzy && !object.sliced && !object.missed && object.y - object.radius > height + 48) {
      object.missed = true;
      state.misses += 1;
      renderStats();
      showText("MISS 0", object.x, height - 88, "#ff6a4a");
    }
  }

  state.objects = state.objects.filter(
    (object) =>
      object.y - object.radius < height + 180 &&
      object.y + object.radius > -220 &&
      object.x + object.radius > -220 &&
      object.x - object.radius < state.width + 220 &&
      !object.sliced,
  );
}

function updateParticles(dt) {
  for (const particle of state.particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    if (!particle.noGravity) {
      particle.vy += (particle.gravity ?? 760) * dt;
    }
    particle.life -= dt;
    particle.rotation += particle.spin * dt;
    if (particle.drag) {
      const drag = Math.max(0, 1 - particle.drag * dt);
      particle.vx *= drag;
      particle.vy *= drag;
    }
  }

  state.particles = state.particles.filter((particle) => particle.life > 0);
}

function pruneBlades(now) {
  for (const [key, points] of state.bladePoints) {
    const fresh = points.filter((point) => now - point.t < 180);
    if (fresh.length === 0) {
      state.bladePoints.delete(key);
    } else {
      state.bladePoints.set(key, fresh.slice(-8));
    }
  }

  state.trails = state.trails.filter((trail) => now - trail.t < 230);
}

function checkSlices(now) {
  for (const [source, points] of state.bladePoints) {
    if (points.length < 2) continue;

    const a = points[points.length - 2];
    const b = points[points.length - 1];
    const speed = distance(a, b) / Math.max(1, b.t - a.t);
    if (speed < 0.58) continue;

    state.trails.push({ a, b, t: now, source });

    for (const object of state.objects) {
      if (object.sliced) continue;
      const gap = distanceToSegment({ x: object.x, y: object.y }, a, b);
      if (gap <= getSliceHitRadius(object, 0.9)) {
        sliceObject(object, source);
      }
    }
  }

  for (const bone of state.armBones.values()) {
    if (now - bone.t > TRACK_TIMEOUT_MS || bone.speed < ARM_BLADE_MIN_SPEED) continue;

    state.trails.push({ a: bone.elbow, b: bone.wrist, t: now, source: bone.id });
    for (const object of state.objects) {
      if (object.sliced) continue;
      const gap = distanceToSegment({ x: object.x, y: object.y }, bone.elbow, bone.wrist);
      if (gap <= getSliceHitRadius(object, 0.86)) {
        sliceObject(object, bone.id);
      }
    }
  }
}

function getSliceHitRadius(object, baseRatio) {
  const ratio = object.kind === "bomb" ? baseRatio * 0.7 : baseRatio;
  return object.radius * ratio;
}

function sliceObject(object, source) {
  object.sliced = true;
  const blade = getSliceBlade(source, object);

  if (object.kind === "bomb") {
    state.bombHits += 1;
    state.combo = 0;
    applyBombPenalty(object);
    createSlashEffect(object, blade, "#ff375f");
    createExplosion(object.x, object.y);
    createShockwave(object.x, object.y, "#ff375f", object.radius * 3.5);
    triggerHitFeedback("255, 55, 95", 14, 260, 0.22);
    playTone("bomb", 1);
    showText("DANGER", object.x, object.y, "#ff375f");
  } else if (object.kind === "special") {
    activateSpecialObject(object, blade);
  } else {
    state.fruitHits += 1;
    state.combo += 1;
    const baseScore = 12 + Math.min(72, state.combo * 4);
    const earnedScore = isDoubleActive() ? baseScore * 2 : baseScore;
    state.score += earnedScore;
    state.best = Math.max(state.best, state.score);
    persistYoloData({ best: state.best });
    createSlashEffect(object, blade, object.type.juice);
    createJuice(object);
    createJuiceSpray(object, blade);
    createHalves(object);
    createShockwave(object.x, object.y, object.type.juice, object.radius * 2.25);
    triggerHitFeedback("66, 245, 221", Math.min(9, 3 + state.combo * 0.45), 150, 0.12);
    playTone("fruit", state.combo);
    showText(isDoubleActive() ? `x2 +${earnedScore}` : state.combo > 2 ? `LOCK x${state.combo}` : `+${earnedScore}`, object.x, object.y, object.type.juice);
  }

  renderStats();
}

function applyBombPenalty(object) {
  const now = performance.now();
  const useScorePenalty = Math.random() < 0.5;
  if (useScorePenalty) {
    state.score = Math.max(0, state.score - BOMB_SCORE_PENALTY);
    showText(`-${BOMB_SCORE_PENALTY}`, object.x, object.y - object.radius * 0.9, "#ff375f");
  } else {
    state.roundEndsAt = Math.max(now, state.roundEndsAt - BOMB_TIME_PENALTY_MS);
    state.roundTimeLeftMs = Math.max(0, state.roundEndsAt - now);
    showText("-1s", object.x, object.y - object.radius * 0.9, "#ff375f");
  }

  triggerHudPulse(els.scoreTile, "is-bomb");
  triggerHudPulse(els.timerTile, "is-bomb");
}

function activateSpecialObject(object, blade) {
  const specialType = SPECIAL_TYPES[object.special] ?? SPECIAL_TYPES.freeze;
  state.fruitHits += 1;
  state.combo += 1;
  state.score += 40 + Math.min(40, state.combo * 2);
  state.best = Math.max(state.best, state.score);
  persistYoloData({ best: state.best });

  if (object.special === "freeze") {
    state.freezeUntil = Math.max(state.freezeUntil, performance.now() + FREEZE_DURATION_MS);
  } else if (object.special === "double") {
    state.doubleUntil = Math.max(state.doubleUntil, performance.now() + DOUBLE_DURATION_MS);
  } else if (object.special === "frenzy") {
    state.frenzyUntil = Math.max(state.frenzyUntil, performance.now() + FRENZY_DURATION_MS);
    state.frenzySpawnAt = 0;
  }

  createSlashEffect(object, blade, specialType.juice);
  createFreezeBurst(object, specialType.juice);
  createShockwave(object.x, object.y, specialType.juice, object.radius * 3.3);
  triggerHitFeedback(specialType.tone, object.special === "frenzy" ? 12 : 9, 220, 0.18);
  playTone(object.special, state.combo);
  showText(specialType.label, object.x, object.y, specialType.juice);
}

function triggerHudPulse(element, className) {
  if (!element) return;
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
  window.setTimeout(() => {
    element.classList.remove(className);
  }, 430);
}

function getSliceBlade(source, object) {
  const points = state.bladePoints.get(source);
  if (points?.length >= 2) {
    return {
      a: points[points.length - 2],
      b: points[points.length - 1],
    };
  }

  const bone = state.armBones.get(source);
  if (bone) {
    return {
      a: bone.elbow,
      b: bone.wrist,
    };
  }

  return {
    a: { x: object.x - object.radius, y: object.y + object.radius * 0.18 },
    b: { x: object.x + object.radius, y: object.y - object.radius * 0.18 },
  };
}

function createSlashEffect(object, blade, color) {
  const angle = Math.atan2(blade.b.y - blade.a.y, blade.b.x - blade.a.x);
  const length = Math.max(object.radius * 3.1, distance(blade.a, blade.b) * 1.2);

  state.particles.push({
    kind: "slash",
    x: object.x,
    y: object.y,
    vx: 0,
    vy: 0,
    length,
    width: Math.max(12, object.radius * 0.35),
    color,
    life: 0.2,
    maxLife: 0.2,
    rotation: angle,
    spin: 0,
    noGravity: true,
  });

  for (let index = 0; index < 10; index += 1) {
    const offset = random(-object.radius * 0.95, object.radius * 0.95);
    const side = index % 2 === 0 ? 1 : -1;
    const life = random(0.16, 0.28);
    state.particles.push({
      kind: "glint",
      x: object.x + Math.cos(angle) * offset,
      y: object.y + Math.sin(angle) * offset,
      vx: Math.cos(angle + side * Math.PI * 0.5) * random(40, 160),
      vy: Math.sin(angle + side * Math.PI * 0.5) * random(40, 160),
      length: random(18, 42),
      color,
      life,
      maxLife: life,
      rotation: angle + random(-0.42, 0.42),
      spin: random(-3, 3),
      noGravity: true,
      drag: 4.8,
    });
  }
}

function createJuiceSpray(object, blade) {
  const angle = Math.atan2(blade.b.y - blade.a.y, blade.b.x - blade.a.x);
  const normal = angle + Math.PI * 0.5;

  for (let index = 0; index < 18; index += 1) {
    const side = index % 2 === 0 ? 1 : -1;
    const spread = normal * side + random(-0.52, 0.52);
    const speed = random(220, 680);
    const life = random(0.22, 0.46);
    state.particles.push({
      kind: "streak",
      x: object.x + random(-object.radius * 0.28, object.radius * 0.28),
      y: object.y + random(-object.radius * 0.28, object.radius * 0.28),
      vx: Math.cos(spread) * speed + object.vx * 0.12,
      vy: Math.sin(spread) * speed + object.vy * 0.08,
      length: random(16, 46),
      radius: random(2, 5),
      color: object.type.juice,
      life,
      maxLife: life,
      rotation: spread,
      spin: random(-3, 3),
      gravity: 520,
      drag: 1.2,
    });
  }
}

function createShockwave(x, y, color, radius) {
  state.particles.push({
    kind: "ring",
    x,
    y,
    vx: 0,
    vy: 0,
    radius: radius * 0.28,
    maxRadius: radius,
    color,
    life: 0.34,
    maxLife: 0.34,
    rotation: 0,
    spin: 0,
    noGravity: true,
  });
}

function createFreezeBurst(object, color = "#88f7ff") {
  for (let index = 0; index < 46; index += 1) {
    const angle = random(0, Math.PI * 2);
    const speed = random(110, 520);
    const life = random(0.38, 0.9);
    state.particles.push({
      kind: index % 3 === 0 ? "glint" : "spark",
      x: object.x + random(-object.radius * 0.35, object.radius * 0.35),
      y: object.y + random(-object.radius * 0.35, object.radius * 0.35),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      length: random(18, 50),
      radius: random(2, 6),
      color: index % 2 === 0 ? color : "#ffffff",
      life,
      maxLife: life,
      rotation: angle,
      spin: random(-5, 5),
      gravity: 90,
      drag: 2.7,
    });
  }
}

function triggerHitFeedback(tone, intensity, duration, alpha) {
  const now = performance.now();
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    intensity = 0;
    alpha *= 0.45;
  }

  state.shake.intensity = Math.max(state.shake.intensity, intensity);
  state.shake.duration = duration;
  state.shake.endAt = Math.max(state.shake.endAt, now + duration);
  state.flash.tone = tone;
  state.flash.alpha = Math.max(state.flash.alpha, alpha);
  state.flash.duration = duration;
  state.flash.endAt = Math.max(state.flash.endAt, now + duration);

  if (navigator.vibrate) {
    navigator.vibrate(Math.min(35, Math.max(8, Math.round(duration * 0.08))));
  }
}

function createJuice(object) {
  for (let index = 0; index < 34; index += 1) {
    const life = random(0.5, 1.1);
    state.particles.push({
      kind: "juice",
      x: object.x + random(-object.radius * 0.4, object.radius * 0.4),
      y: object.y + random(-object.radius * 0.4, object.radius * 0.4),
      vx: random(-360, 360),
      vy: random(-460, 70),
      radius: random(3, 10),
      color: object.type.juice,
      life,
      maxLife: life,
      rotation: 0,
      spin: 0,
      gravity: 820,
      drag: 0.4,
    });
  }
}

function createHalves(object) {
  for (const direction of [-1, 1]) {
    state.particles.push({
      kind: "half",
      type: object.type,
      x: object.x,
      y: object.y,
      vx: object.vx * 0.35 + direction * random(140, 230),
      vy: object.vy * 0.25 - random(80, 180),
      radius: object.radius,
      side: direction,
      life: 0.9,
      maxLife: 0.9,
      rotation: object.rotation,
      spin: direction * random(4, 8),
      gravity: 820,
    });
  }
}

function createExplosion(x, y) {
  for (let index = 0; index < 54; index += 1) {
    const angle = random(0, Math.PI * 2);
    const speed = random(180, 720);
    const life = random(0.34, 0.82);
    state.particles.push({
      kind: "spark",
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: random(2, 7),
      color: index % 2 === 0 ? "#ff4f4f" : "#f2c35b",
      life,
      maxLife: life,
      rotation: 0,
      spin: 0,
      gravity: 180,
      drag: 2.6,
    });
  }
}

function showText(text, x, y, color) {
  state.particles.push({
    kind: "text",
    text,
    x,
    y,
    vx: 0,
    vy: -90,
    color,
    life: 0.72,
    maxLife: 0.72,
    rotation: 0,
    spin: 0,
    noGravity: true,
  });
}

function draw(now) {
  const width = state.width;
  const height = state.height;
  ctx.clearRect(0, 0, width, height);

  const jitter = getScreenJitter(now);
  ctx.save();
  ctx.translate(jitter.x, jitter.y);
  drawBackground(width, height);
  drawSpecialBackgroundEffects(now, width, height);

  for (const object of state.objects) {
    drawObject(object);
  }

  drawYoloDetections(now);

  for (const particle of state.particles) {
    drawParticle(particle);
  }

  drawPoseMasks(now);
  drawTrackedArmPaths(now);
  drawBladeTrails(now);
  ctx.restore();
  drawHitFlash(now, width, height);
}

function getScreenJitter(now) {
  if (now >= state.shake.endAt || state.shake.intensity <= 0) {
    state.shake.intensity = 0;
    return { x: 0, y: 0 };
  }

  const remaining = (state.shake.endAt - now) / Math.max(1, state.shake.duration);
  const force = state.shake.intensity * remaining * remaining;
  return {
    x: random(-force, force),
    y: random(-force, force),
  };
}

function drawHitFlash(now, width, height) {
  if (now >= state.flash.endAt || state.flash.alpha <= 0) {
    state.flash.alpha = 0;
    return;
  }

  const remaining = (state.flash.endAt - now) / Math.max(1, state.flash.duration);
  const alpha = state.flash.alpha * remaining;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = `rgba(${state.flash.tone}, 1)`;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function drawSpecialBackgroundEffects(now, width, height) {
  drawFreezeOverlay(now, width, height);
  drawDoubleOverlay(now, width, height);
  drawFrenzyOverlay(now, width, height);
}

function drawFreezeOverlay(now, width, height) {
  if (!isFreezeActive(now)) return;

  const remaining = (state.freezeUntil - now) / FREEZE_DURATION_MS;
  ctx.save();
  ctx.globalAlpha = clamp(remaining * 0.24, 0.06, 0.18);
  ctx.fillStyle = "#88f7ff";
  ctx.fillRect(0, 0, width, height);

  ctx.globalAlpha = clamp(remaining * 0.58, 0.14, 0.36);
  ctx.strokeStyle = "#dffcff";
  ctx.lineWidth = 1;
  for (let x = 18; x < width; x += 68) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x - 42, height);
    ctx.stroke();
  }

  ctx.globalAlpha = clamp(remaining * 0.82, 0.24, 0.62);
  ctx.strokeStyle = "rgba(223, 252, 255, 0.92)";
  ctx.lineWidth = 1.8;
  const drift = (now * 0.025) % 86;
  for (let y = -86 + drift; y < height + 86; y += 86) {
    for (let x = 34; x < width + 72; x += 94) {
      const size = 7 + ((x + y) % 17) * 0.45;
      drawSnowflake(x + Math.sin(now * 0.0015 + y) * 18, y, size);
    }
  }
  ctx.restore();
}

function drawDoubleOverlay(now, width, height) {
  if (!isDoubleActive(now)) return;

  const remaining = (state.doubleUntil - now) / DOUBLE_DURATION_MS;
  ctx.save();
  ctx.globalAlpha = clamp(remaining * 0.18, 0.04, 0.14);
  ctx.fillStyle = "#ffd166";
  ctx.fillRect(0, 0, width, height);

  ctx.globalAlpha = clamp(remaining * 0.48, 0.1, 0.26);
  ctx.strokeStyle = "#fff1a8";
  ctx.lineWidth = 3;
  for (let index = -height; index < width; index += 96) {
    ctx.beginPath();
    ctx.moveTo(index, height);
    ctx.lineTo(index + height * 0.7, 0);
    ctx.stroke();
  }

  ctx.globalAlpha = clamp(remaining * 0.72, 0.18, 0.42);
  ctx.strokeStyle = "rgba(255, 246, 184, 0.92)";
  ctx.lineWidth = 5;
  const lift = (now * 0.16) % 118;
  for (let y = height + 80 - lift; y > -120; y -= 118) {
    for (let x = 44; x < width + 80; x += 116) {
      drawUpArrow(x + Math.sin(now * 0.002 + x * 0.03) * 12, y, 18);
    }
  }
  ctx.restore();
}

function drawFrenzyOverlay(now, width, height) {
  if (!isFrenzyActive(now)) return;

  const remaining = (state.frenzyUntil - now) / FRENZY_DURATION_MS;
  ctx.save();
  ctx.globalAlpha = clamp(remaining * 0.2, 0.06, 0.16);
  ctx.fillStyle = "#ff7a42";
  ctx.fillRect(0, 0, width, height);

  ctx.globalAlpha = clamp(remaining * 0.62, 0.18, 0.38);
  const gradient = ctx.createLinearGradient(0, 0, width, 0);
  gradient.addColorStop(0, "rgba(255, 122, 66, 0.72)");
  gradient.addColorStop(0.22, "rgba(255, 122, 66, 0)");
  gradient.addColorStop(0.78, "rgba(255, 122, 66, 0)");
  gradient.addColorStop(1, "rgba(255, 122, 66, 0.72)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const travel = width / 2 + 180;
  const blockWidth = Math.max(76, width * 0.12);
  const palette = [
    "rgba(255, 79, 216, 0.24)",
    "rgba(66, 245, 221, 0.22)",
    "rgba(255, 209, 102, 0.24)",
    "rgba(156, 255, 124, 0.2)",
  ];
  ctx.globalAlpha = clamp(remaining * 0.82, 0.24, 0.5);
  for (let row = -42; row < height + 76; row += 76) {
    for (let lane = 0; lane < 4; lane += 1) {
      const progress = (now * 0.24 + lane * 142 + row * 1.6) % travel;
      const blockHeight = 30 + (lane % 2) * 14;
      const y = row + (lane % 2) * 18;
      ctx.fillStyle = palette[(lane + Math.floor((row + 42) / 76)) % palette.length];
      ctx.fillRect(progress - blockWidth, y, blockWidth, blockHeight);
      ctx.fillRect(width - progress, y + 22, blockWidth, blockHeight);
    }
  }
  ctx.restore();
}

function drawSnowflake(x, y, size) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((x + y) * 0.01);
  ctx.beginPath();
  for (let arm = 0; arm < 6; arm += 1) {
    ctx.moveTo(0, 0);
    ctx.lineTo(size, 0);
    ctx.moveTo(size * 0.58, 0);
    ctx.lineTo(size * 0.38, size * 0.2);
    ctx.moveTo(size * 0.58, 0);
    ctx.lineTo(size * 0.38, -size * 0.2);
    ctx.rotate(Math.PI / 3);
  }
  ctx.stroke();
  ctx.restore();
}

function drawUpArrow(x, y, size) {
  ctx.beginPath();
  ctx.moveTo(x - size, y + size * 0.35);
  ctx.lineTo(x, y - size * 0.75);
  ctx.lineTo(x + size, y + size * 0.35);
  ctx.moveTo(x, y - size * 0.66);
  ctx.lineTo(x, y + size * 0.72);
  ctx.stroke();
}

function drawBackground(width, height) {
  if (isImageReady(imageAssets.background)) {
    drawCoverImage(imageAssets.background, width, height);
    drawScanGrid(width, height);
    return;
  }

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#1a2a22");
  gradient.addColorStop(0.68, "#0d1510");
  gradient.addColorStop(1, "#09100b");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = "#a7e35f";
  ctx.lineWidth = 1;
  for (let y = 80; y < height; y += 96) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y - 28);
    ctx.stroke();
  }
  ctx.restore();
  drawScanGrid(width, height);
}

function drawScanGrid(width, height) {
  ctx.save();
  ctx.globalAlpha = 0.24;
  ctx.strokeStyle = "#77f6ff";
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 86) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + height * 0.18, height);
    ctx.stroke();
  }

  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = "#9cff7c";
  for (let y = 64; y < height; y += 72) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y - 22);
    ctx.stroke();
  }
  ctx.restore();
}

function drawYoloDetections(now) {
  ctx.save();
  ctx.font = "800 12px Inter, Microsoft YaHei, sans-serif";
  ctx.textBaseline = "top";

  for (const object of state.objects) {
    if (object.sliced || object.missed) continue;
    const confidence = getDetectionConfidence(object, now);
    const boxSize = object.radius * (object.kind === "bomb" ? 2.85 : object.kind === "special" ? 2.72 : 2.52);
    const x = object.x - boxSize / 2;
    const y = object.y - boxSize / 2;
    const color = getObjectDetectionColor(object);
    const label = `${object.kind === "special" ? SPECIAL_TYPES[object.special]?.label ?? "香蕉" : object.trackId} ${Math.round(confidence * 100)}%`;

    drawDetectionCorners(x, y, boxSize, boxSize, color);

    const labelWidth = Math.min(132, Math.max(82, ctx.measureText(label).width + 14));
    const labelX = clamp(x, 8, state.width - labelWidth - 8);
    const labelY = Math.max(8, y - 22);
    ctx.fillStyle =
      object.kind === "bomb" ? "rgba(78, 10, 24, 0.82)" : object.kind === "special" ? "rgba(9, 42, 64, 0.84)" : "rgba(4, 35, 37, 0.82)";
    ctx.fillRect(labelX, labelY, labelWidth, 19);
    ctx.fillStyle = color;
    ctx.fillText(label, labelX + 7, labelY + 4);
  }

  ctx.restore();
}

function getObjectDetectionColor(object) {
  if (object.kind === "bomb") return "#ff375f";
  if (object.kind === "special") return object.type?.juice ?? "#ffd166";
  return "#42f5dd";
}

function drawDetectionCorners(x, y, width, height, color) {
  const corner = Math.min(22, width * 0.28);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;

  ctx.beginPath();
  ctx.moveTo(x, y + corner);
  ctx.lineTo(x, y);
  ctx.lineTo(x + corner, y);
  ctx.moveTo(x + width - corner, y);
  ctx.lineTo(x + width, y);
  ctx.lineTo(x + width, y + corner);
  ctx.moveTo(x + width, y + height - corner);
  ctx.lineTo(x + width, y + height);
  ctx.lineTo(x + width - corner, y + height);
  ctx.moveTo(x + corner, y + height);
  ctx.lineTo(x, y + height);
  ctx.lineTo(x, y + height - corner);
  ctx.stroke();

  ctx.restore();
}

function getDetectionConfidence(object, now) {
  const centerBias = 1 - Math.min(1, distance({ x: object.x, y: object.y }, { x: state.width / 2, y: state.height * 0.48 }) / Math.max(state.width, state.height));
  const pulse = Math.sin(now * 0.006 + object.confidenceSeed) * 0.035;
  return clamp(0.68 + centerBias * 0.26 + pulse, 0.57, 0.99);
}

function drawObject(object) {
  ctx.save();
  ctx.translate(object.x, object.y);
  ctx.rotate(object.rotation);

  if (object.kind === "bomb") {
    drawSprite(imageAssets.bomb, object.radius * 2.6, () => drawBomb(object.radius));
  } else if (object.kind === "special") {
    drawPowerBanana(object);
  } else {
    const image = imageAssets.fruits.get(object.type.name);
    drawSprite(image, object.radius * 2.35, () => drawFruit(object.type, object.radius));
  }

  ctx.restore();
}

function drawPowerBanana(object) {
  const radius = object.radius;
  const type = object.type;
  ctx.save();
  ctx.rotate(-0.35);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = type.juice;
  ctx.shadowBlur = 16;

  const stem = Math.max(5, radius * 0.12);
  ctx.strokeStyle = "#8a5b12";
  ctx.lineWidth = stem;
  ctx.beginPath();
  ctx.moveTo(-radius * 0.88, -radius * 0.12);
  ctx.lineTo(-radius * 1.08, -radius * 0.22);
  ctx.stroke();

  const peelGradient = ctx.createLinearGradient(-radius, -radius * 0.4, radius, radius * 0.38);
  peelGradient.addColorStop(0, "#fff6b8");
  peelGradient.addColorStop(0.42, type.flesh);
  peelGradient.addColorStop(1, type.skin);
  ctx.strokeStyle = peelGradient;
  ctx.lineWidth = radius * 0.48;
  ctx.beginPath();
  ctx.moveTo(-radius * 0.82, -radius * 0.06);
  ctx.bezierCurveTo(-radius * 0.36, radius * 0.64, radius * 0.5, radius * 0.56, radius * 0.98, -radius * 0.16);
  ctx.stroke();

  ctx.strokeStyle = "rgba(121, 72, 4, 0.42)";
  ctx.lineWidth = Math.max(2, radius * 0.06);
  ctx.beginPath();
  ctx.moveTo(-radius * 0.58, radius * 0.06);
  ctx.bezierCurveTo(-radius * 0.18, radius * 0.38, radius * 0.42, radius * 0.32, radius * 0.76, -radius * 0.08);
  ctx.stroke();

  ctx.fillStyle = type.juice;
  ctx.font = `900 ${Math.round(radius * 0.42)}px Inter, Microsoft YaHei, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(type.label, radius * 0.16, -radius * 0.1);
  ctx.restore();
}

function drawFruit(type, radius) {
  const gradient = ctx.createRadialGradient(-radius * 0.32, -radius * 0.38, radius * 0.2, 0, 0, radius);
  gradient.addColorStop(0, "#fff6d2");
  gradient.addColorStop(0.22, type.flesh);
  gradient.addColorStop(1, type.skin);

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(0, 0, radius * 0.95, radius, 0.08, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.42)";
  ctx.lineWidth = Math.max(2, radius * 0.08);
  ctx.stroke();

  ctx.fillStyle = type.seed;
  for (let index = 0; index < 4; index += 1) {
    const angle = (index / 4) * Math.PI * 2 + 0.35;
    ctx.beginPath();
    ctx.ellipse(Math.cos(angle) * radius * 0.25, Math.sin(angle) * radius * 0.18, 2.2, 4.5, angle, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#58a044";
  ctx.beginPath();
  ctx.ellipse(radius * 0.2, -radius * 0.94, radius * 0.18, radius * 0.08, -0.55, 0, Math.PI * 2);
  ctx.fill();
}

function drawBomb(radius) {
  const gradient = ctx.createRadialGradient(-radius * 0.35, -radius * 0.42, radius * 0.2, 0, 0, radius);
  gradient.addColorStop(0, "#68717b");
  gradient.addColorStop(0.62, "#24292e");
  gradient.addColorStop(1, "#080a0c");

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#f2c35b";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(radius * 0.2, -radius * 1.02, radius * 0.38, Math.PI * 0.15, Math.PI * 1.2);
  ctx.stroke();

  ctx.fillStyle = "#ff4f4f";
  ctx.beginPath();
  ctx.arc(radius * 0.62, -radius * 1.2, radius * 0.14, 0, Math.PI * 2);
  ctx.fill();
}

function drawParticle(particle) {
  ctx.save();
  const alpha = Math.max(0, Math.min(1, particle.life / (particle.maxLife ?? 1)));
  ctx.globalAlpha = alpha;
  ctx.translate(particle.x, particle.y);
  ctx.rotate(particle.rotation);

  if (particle.kind === "juice") {
    ctx.shadowColor = particle.color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(0, 0, particle.radius, 0, Math.PI * 2);
    ctx.fill();
  } else if (particle.kind === "spark") {
    ctx.shadowColor = particle.color;
    ctx.shadowBlur = 16;
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(0, 0, particle.radius, 0, Math.PI * 2);
    ctx.fill();
  } else if (particle.kind === "streak" || particle.kind === "glint") {
    ctx.lineCap = "round";
    ctx.strokeStyle = particle.color;
    ctx.shadowColor = particle.color;
    ctx.shadowBlur = particle.kind === "glint" ? 18 : 8;
    ctx.lineWidth = particle.kind === "glint" ? 3 : Math.max(2, particle.radius);
    ctx.beginPath();
    ctx.moveTo(-particle.length / 2, 0);
    ctx.lineTo(particle.length / 2, 0);
    ctx.stroke();
  } else if (particle.kind === "slash") {
    const gradient = ctx.createLinearGradient(-particle.length / 2, 0, particle.length / 2, 0);
    gradient.addColorStop(0, "rgba(255, 255, 255, 0)");
    gradient.addColorStop(0.18, particle.color);
    gradient.addColorStop(0.5, "#ffffff");
    gradient.addColorStop(0.82, particle.color);
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.lineCap = "round";
    ctx.shadowColor = particle.color;
    ctx.shadowBlur = 28;
    ctx.strokeStyle = gradient;
    ctx.lineWidth = particle.width;
    ctx.beginPath();
    ctx.moveTo(-particle.length / 2, 0);
    ctx.lineTo(particle.length / 2, 0);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
    ctx.lineWidth = Math.max(2, particle.width * 0.18);
    ctx.beginPath();
    ctx.moveTo(-particle.length * 0.42, 0);
    ctx.lineTo(particle.length * 0.42, 0);
    ctx.stroke();
  } else if (particle.kind === "ring") {
    const progress = 1 - alpha;
    const radius = particle.radius + (particle.maxRadius - particle.radius) * progress;
    ctx.strokeStyle = particle.color;
    ctx.shadowColor = particle.color;
    ctx.shadowBlur = 20;
    ctx.lineWidth = Math.max(2, 9 * alpha);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
  } else if (particle.kind === "half") {
    drawFruitHalf(particle);
  } else if (particle.kind === "text") {
    ctx.shadowColor = particle.color;
    ctx.shadowBlur = 16;
    ctx.fillStyle = particle.color;
    ctx.font = `${900} ${Math.round(24 + 8 * alpha)}px Inter, Microsoft YaHei, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(particle.text, 0, 0);
  }

  ctx.restore();
}

function drawSprite(image, size, fallback) {
  if (!isImageReady(image)) {
    fallback();
    return;
  }

  ctx.drawImage(image, -size / 2, -size / 2, size, size);
}

function drawFruitHalf(particle) {
  const image = imageAssets.fruits.get(particle.type.name);
  const size = particle.radius * 2.35;

  ctx.scale(particle.side, 1);
  if (isImageReady(image)) {
    ctx.beginPath();
    ctx.rect(0, -size / 2, size / 2, size);
    ctx.clip();
    ctx.drawImage(image, -size / 2, -size / 2, size, size);
    ctx.strokeStyle = particle.type.flesh;
    ctx.lineWidth = Math.max(2, particle.radius * 0.06);
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.42);
    ctx.lineTo(0, size * 0.42);
    ctx.stroke();
    return;
  }

  ctx.beginPath();
  ctx.arc(0, 0, particle.radius, -Math.PI / 2, Math.PI / 2);
  ctx.closePath();
  ctx.fillStyle = particle.type.flesh;
  ctx.fill();
  ctx.strokeStyle = particle.type.skin;
  ctx.lineWidth = Math.max(3, particle.radius * 0.12);
  ctx.stroke();
}

function drawCoverImage(image, width, height) {
  const imageRatio = image.naturalWidth / image.naturalHeight;
  const canvasRatio = width / height;
  const drawWidth = canvasRatio > imageRatio ? width : height * imageRatio;
  const drawHeight = canvasRatio > imageRatio ? width / imageRatio : height;
  ctx.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}

function updatePoseMask(key, landmarks, now) {
  const points = landmarks.map((landmark) => {
    const point = toMirroredPoint(landmark);
    return {
      x: point.x * state.width,
      y: point.y * state.height,
      visible: isLandmarkVisible(landmark),
    };
  });
  const previous = state.poseMasks.get(key);
  state.poseMasks.set(key, {
    key,
    points: previous ? smoothMaskPoints(previous.points, points) : points,
    t: now,
  });
}

function smoothMaskPoints(previous, next) {
  if (!previous || previous.length !== next.length) return next;
  return next.map((point, index) => ({
    x: previous[index].x * 0.58 + point.x * 0.42,
    y: previous[index].y * 0.58 + point.y * 0.42,
    visible: point.visible,
  }));
}

function drawPoseMasks(now) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = "rgba(66, 245, 221, 0.55)";
  ctx.shadowBlur = 24;

  for (const mask of state.poseMasks.values()) {
    if (now - mask.t > 240 || mask.points.length < 29) continue;
    drawSinglePoseMask(mask);
  }

  ctx.restore();
}

function drawTrackedArmPaths(now) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const track of state.armTracks.values()) {
    const points = track.path.filter((point) => now - point.t < 420);
    if (points.length < 2) continue;
    const tone = getHandTone(track.id);
    const head = points[points.length - 1];
    const tail = points[0];
    const speedGlow = clamp(track.speed / 1.15, 0.35, 1);
    const glow = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
    glow.addColorStop(0, `rgba(${tone}, 0)`);
    glow.addColorStop(0.42, `rgba(${tone}, ${0.2 * speedGlow})`);
    glow.addColorStop(1, `rgba(${tone}, ${0.9 * speedGlow})`);

    ctx.globalAlpha = 0.86;
    ctx.shadowColor = `rgba(${tone}, 0.9)`;
    ctx.shadowBlur = 30;
    ctx.strokeStyle = glow;
    ctx.lineWidth = 26;
    strokePath(points);

    ctx.globalAlpha = 0.92;
    ctx.shadowBlur = 16;
    ctx.strokeStyle = glow;
    ctx.lineWidth = 12;
    strokePath(points);

    const core = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
    core.addColorStop(0, "rgba(255, 255, 255, 0)");
    core.addColorStop(0.55, "rgba(255, 255, 255, 0.58)");
    core.addColorStop(1, "rgba(255, 255, 255, 0.98)");
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.strokeStyle = core;
    ctx.lineWidth = 4;
    strokePath(points);

    drawBladeGlints(points, tone, speedGlow);
    drawBladeTip(points, tone, speedGlow);
  }

  ctx.restore();
}

function strokePath(points) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) {
    ctx.lineTo(point.x, point.y);
  }
  ctx.stroke();
}

function drawBladeGlints(points, tone, intensity) {
  ctx.save();
  ctx.globalAlpha = 0.35 * intensity;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
  ctx.shadowColor = `rgba(${tone}, 0.78)`;
  ctx.shadowBlur = 12;
  ctx.lineWidth = 2;

  for (let index = Math.max(1, points.length - 6); index < points.length; index += 2) {
    const point = points[index];
    const previous = points[index - 1];
    const angle = Math.atan2(point.y - previous.y, point.x - previous.x) + Math.PI * 0.5;
    const length = 10 + index * 1.4;
    ctx.beginPath();
    ctx.moveTo(point.x - Math.cos(angle) * length * 0.5, point.y - Math.sin(angle) * length * 0.5);
    ctx.lineTo(point.x + Math.cos(angle) * length * 0.5, point.y + Math.sin(angle) * length * 0.5);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBladeTip(points, tone, intensity) {
  const head = points[points.length - 1];
  const previous = points[points.length - 2];
  const angle = Math.atan2(head.y - previous.y, head.x - previous.x);

  ctx.save();
  ctx.translate(head.x, head.y);
  ctx.rotate(angle);
  ctx.globalAlpha = 0.48 + intensity * 0.42;
  ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
  ctx.shadowColor = `rgba(${tone}, 0.95)`;
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.moveTo(22, 0);
  ctx.lineTo(-8, -7);
  ctx.lineTo(-2, 0);
  ctx.lineTo(-8, 7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawSinglePoseMask(mask) {
  const points = mask.points;
  const tone = getHandTone(mask.key);

  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = `rgba(${tone}, 0.45)`;
  if (points[11]?.visible && points[12]?.visible && points[23]?.visible && points[24]?.visible) {
    ctx.beginPath();
    ctx.moveTo(points[11].x, points[11].y);
    ctx.lineTo(points[12].x, points[12].y);
    ctx.lineTo(points[24].x, points[24].y);
    ctx.lineTo(points[23].x, points[23].y);
    ctx.closePath();
    ctx.fill();
  }

  ctx.globalAlpha = 0.34;
  ctx.lineWidth = 4;
  ctx.strokeStyle = `rgba(${tone}, 0.42)`;
  for (const [start, end] of POSE_BODY_CONNECTIONS) {
    if (!points[start]?.visible || !points[end]?.visible) continue;
    ctx.beginPath();
    ctx.moveTo(points[start].x, points[start].y);
    ctx.lineTo(points[end].x, points[end].y);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
  for (const endpoint of ARM_ENDPOINTS) {
    const armTone = getHandTone(endpoint.id);
    const shoulder = points[endpoint.shoulder];
    const elbow = points[endpoint.elbow];
    const wrist = points[endpoint.wrist];
    if (!shoulder?.visible || !elbow?.visible || !wrist?.visible) continue;

    ctx.shadowColor = `rgba(${armTone}, 0.78)`;
    ctx.shadowBlur = 24;
    ctx.lineWidth = 18;
    ctx.strokeStyle = `rgba(${armTone}, 0.18)`;
    ctx.beginPath();
    ctx.moveTo(shoulder.x, shoulder.y);
    ctx.lineTo(elbow.x, elbow.y);
    ctx.lineTo(wrist.x, wrist.y);
    ctx.stroke();

    ctx.shadowBlur = 14;
    ctx.lineWidth = 9;
    ctx.strokeStyle = `rgba(${armTone}, 0.86)`;
    ctx.beginPath();
    ctx.moveTo(shoulder.x, shoulder.y);
    ctx.lineTo(elbow.x, elbow.y);
    ctx.lineTo(wrist.x, wrist.y);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(255, 249, 239, 0.95)";
    ctx.beginPath();
    ctx.moveTo(shoulder.x, shoulder.y);
    ctx.lineTo(elbow.x, elbow.y);
    ctx.lineTo(wrist.x, wrist.y);
    ctx.stroke();
  }

  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.52;
  ctx.fillStyle = `rgba(${tone}, 0.7)`;
  for (const [start, end] of POSE_BODY_CONNECTIONS) {
    for (const index of [start, end]) {
      const point = points[index];
      if (!point?.visible) continue;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.globalAlpha = 1;
  for (const endpoint of ARM_ENDPOINTS) {
    const armTone = getHandTone(endpoint.id);
    ctx.fillStyle = `rgba(${armTone}, 0.88)`;
    for (const index of [endpoint.shoulder, endpoint.elbow]) {
      const point = points[index];
      if (!point?.visible) continue;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    const wrist = points[endpoint.wrist];
    if (!wrist?.visible) continue;
    ctx.fillStyle = "rgba(255, 249, 239, 0.96)";
    ctx.shadowColor = `rgba(${armTone}, 0.9)`;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(wrist.x, wrist.y, 9, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.shadowBlur = 0;
}

function getPointBounds(points) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return {
    width: maxX - minX,
    height: maxY - minY,
  };
}

function getHandTone(key) {
  const palette = ["66, 245, 221", "255, 79, 216", "156, 255, 124", "255, 209, 102"];
  const value = String(key).split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return palette[value % palette.length];
}

function drawBladeTrails(now) {
  ctx.save();
  ctx.lineCap = "round";
  for (const [key, points] of state.bladePoints) {
    if (points.length < 2) continue;
    const tone = getHandTone(key);
    const gradient = ctx.createLinearGradient(points[0].x, points[0].y, points[points.length - 1].x, points[points.length - 1].y);
    gradient.addColorStop(0, "rgba(255, 255, 255, 0)");
    gradient.addColorStop(0.45, `rgba(${tone}, 0.88)`);
    gradient.addColorStop(1, "rgba(255, 255, 255, 0.95)");
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) {
      ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();
  }

  for (const trail of state.trails) {
    const age = (now - trail.t) / 230;
    ctx.globalAlpha = Math.max(0, 1 - age);
    ctx.strokeStyle = "#fff9ef";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(trail.a.x, trail.a.y);
    ctx.lineTo(trail.b.x, trail.b.y);
    ctx.stroke();
  }
  ctx.restore();
}

function addBladePoint(source, point, now) {
  const points = state.bladePoints.get(source) ?? [];
  const previous = points[points.length - 1];
  if (previous && distance(previous, point) < 2) return;
  points.push({ ...point, t: now });
  state.bladePoints.set(source, points.slice(-10));
}

function clearBlade(source) {
  state.bladePoints.delete(source);
}

function canvasPoint(event) {
  const rect = els.canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function resizeCanvas() {
  const rect = els.frame.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  state.width = Math.max(1, rect.width);
  state.height = Math.max(1, rect.height);
  state.dpr = dpr;
  els.canvas.width = Math.max(1, Math.round(rect.width * dpr));
  els.canvas.height = Math.max(1, Math.round(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function ensureAudio() {
  if (state.audio) {
    if (state.audio.context.state === "suspended") state.audio.context.resume();
    ensureBackgroundMusic();
    return;
  }

  const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContextClass) {
    ensureBackgroundMusic();
    return;
  }

  const context = new AudioContextClass();
  const master = context.createGain();
  const compressor = context.createDynamicsCompressor();
  master.gain.value = 0.18;
  compressor.threshold.value = -18;
  compressor.knee.value = 18;
  compressor.ratio.value = 8;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.22;
  master.connect(compressor);
  compressor.connect(context.destination);
  state.audio = { context, master, compressor };
  ensureBackgroundMusic();
}

function ensureBackgroundMusic() {
  if (state.music) return;

  state.music = new Audio(new URL(BACKGROUND_MUSIC_SRC, window.location.href).href);
  state.music.loop = true;
  state.music.preload = "auto";
  state.music.volume = BACKGROUND_MUSIC_VOLUME;
}

function playBackgroundMusic() {
  ensureBackgroundMusic();
  if (!state.musicEnabled || !state.running) return;

  state.music.volume = BACKGROUND_MUSIC_VOLUME;
  state.music.play().catch(() => {
    pauseBackgroundMusic();
  });
}

function pauseBackgroundMusic() {
  if (!state.music) return;
  state.music.pause();
}

function syncMusicButton() {
  if (!els.musicButton) return;
  els.musicButton.textContent = state.musicEnabled ? "音乐开" : "音乐关";
  els.musicButton.setAttribute("aria-pressed", String(state.musicEnabled));
  els.musicButton.classList.toggle("is-muted", !state.musicEnabled);
}

function playTone(type, combo = 1) {
  if (!state.audio) return;

  if (type === "freeze") {
    const lift = Math.min(180, combo * 12);
    playOscillator("sine", 980 + lift, 420 + lift, 0.26, 0.12, 0);
    playOscillator("triangle", 1480 + lift, 820 + lift, 0.22, 0.08, 0.04);
    playNoiseBurst(0.18, 0.08, "highpass", 1900, 0);
    return;
  }

  if (type === "double") {
    playOscillator("triangle", 760, 1520, 0.2, 0.13, 0);
    playOscillator("sine", 1180, 1980, 0.18, 0.1, 0.04);
    playNoiseBurst(0.12, 0.06, "highpass", 1600, 0);
    return;
  }

  if (type === "frenzy") {
    playOscillator("sawtooth", 420, 840, 0.22, 0.11, 0);
    playOscillator("triangle", 900, 1560, 0.2, 0.12, 0.035);
    playNoiseBurst(0.22, 0.1, "highpass", 1300, 0);
    return;
  }

  if (type === "bomb") {
    playOscillator("sawtooth", 118, 42, 0.36, 0.2, 0);
    playOscillator("square", 72, 34, 0.28, 0.08, 0.015);
    playNoiseBurst(0.34, 0.18, "lowpass", 720, 0);
    playNoiseBurst(0.16, 0.08, "highpass", 1400, 0.035);
    return;
  }

  const lift = Math.min(240, combo * 18);
  playOscillator("triangle", 520 + lift, 930 + lift, 0.16, 0.12, 0);
  playOscillator("sine", 980 + lift, 1580 + lift, 0.11, 0.05, 0.025);
  playNoiseBurst(0.095, 0.075, "highpass", 1050, 0);
}

function playOscillator(type, startFrequency, endFrequency, duration, volume, delay = 0) {
  const { context, master } = state.audio;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const now = context.currentTime + delay;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(startFrequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  oscillator.connect(gain);
  gain.connect(master);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.02);
}

function playNoiseBurst(duration, volume, filterType, frequency, delay = 0) {
  const { context, master } = state.audio;
  const sampleCount = Math.max(1, Math.floor(context.sampleRate * duration));
  const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < sampleCount; index += 1) {
    data[index] = random(-1, 1) * (1 - index / sampleCount);
  }

  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  const now = context.currentTime + delay;

  source.buffer = buffer;
  filter.type = filterType;
  filter.frequency.setValueAtTime(frequency, now);
  filter.Q.value = filterType === "highpass" ? 0.9 : 0.5;
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  source.start(now);
  source.stop(now + duration + 0.02);
}

function drawPoseOverlay(landmarksList) {
  const canvas = els.handOverlay;
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.round(rect.width * dpr);
  const height = Math.round(rect.height * dpr);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const overlay = canvas.getContext("2d");
  overlay.clearRect(0, 0, canvas.width, canvas.height);
  overlay.save();
  overlay.scale(dpr, dpr);
  for (const landmarks of landmarksList) {
    overlay.globalAlpha = 0.38;
    overlay.lineWidth = 2.5;
    overlay.strokeStyle = "#42f5dd";
    for (const [start, end] of POSE_BODY_CONNECTIONS) {
      if (!isLandmarkVisible(landmarks[start]) || !isLandmarkVisible(landmarks[end])) continue;
      const a = toCanvasPoint(landmarks[start], rect);
      const b = toCanvasPoint(landmarks[end], rect);
      overlay.beginPath();
      overlay.moveTo(a.x, a.y);
      overlay.lineTo(b.x, b.y);
      overlay.stroke();
    }

    overlay.globalAlpha = 0.98;
    overlay.lineWidth = 6;
    overlay.strokeStyle = "#ffd166";
    overlay.shadowColor = "rgba(255, 209, 102, 0.72)";
    overlay.shadowBlur = 12;
    for (const endpoint of ARM_ENDPOINTS) {
      if (
        !isLandmarkVisible(landmarks[endpoint.shoulder]) ||
        !isLandmarkVisible(landmarks[endpoint.elbow]) ||
        !isLandmarkVisible(landmarks[endpoint.wrist])
      ) {
        continue;
      }
      const shoulder = toCanvasPoint(landmarks[endpoint.shoulder], rect);
      const elbow = toCanvasPoint(landmarks[endpoint.elbow], rect);
      const wrist = toCanvasPoint(landmarks[endpoint.wrist], rect);
      overlay.beginPath();
      overlay.moveTo(shoulder.x, shoulder.y);
      overlay.lineTo(elbow.x, elbow.y);
      overlay.lineTo(wrist.x, wrist.y);
      overlay.stroke();
    }

    overlay.shadowBlur = 0;
    overlay.globalAlpha = 0.48;
    overlay.fillStyle = "#42f5dd";
    for (const landmark of landmarks) {
      if (!isLandmarkVisible(landmark)) continue;
      const point = toCanvasPoint(landmark, rect);
      overlay.beginPath();
      overlay.arc(point.x, point.y, 3, 0, Math.PI * 2);
      overlay.fill();
    }

    overlay.globalAlpha = 1;
    overlay.fillStyle = "#fff9ef";
    for (const endpoint of ARM_ENDPOINTS) {
      const wrist = landmarks[endpoint.wrist];
      if (!isLandmarkVisible(wrist)) continue;
      const point = toCanvasPoint(wrist, rect);
      overlay.beginPath();
      overlay.arc(point.x, point.y, 4.5, 0, Math.PI * 2);
      overlay.fill();
    }
  }

  overlay.restore();
}

function updateYoloTelemetry(now) {
  state.fpsFrames += 1;
  if (!state.fpsSampleAt) state.fpsSampleAt = now;

  const liveObjects = state.objects.filter((object) => !object.sliced && !object.missed);
  state.detectedCount = liveObjects.length;
  state.dangerCount = liveObjects.filter((object) => object.kind === "bomb").length;

  if (now - state.fpsSampleAt >= FPS_SAMPLE_MS) {
    state.fps = Math.round((state.fpsFrames * 1000) / Math.max(1, now - state.fpsSampleAt));
    state.fpsFrames = 0;
    state.fpsSampleAt = now;
    renderYoloStats();
  } else if (state.fpsFrames === 1) {
    renderYoloStats();
  }
}

function updateHudEffects(now) {
  els.scoreTile?.classList.toggle("is-double", isDoubleActive(now));
  els.timerTile?.classList.toggle("is-freeze", isFreezeActive(now));
  renderSpecialStatus(now);
}

function renderSpecialStatus(now = performance.now()) {
  if (!els.specialStatusRow) return;

  const liveSpecials = new Set(
    state.objects.filter((object) => object.kind === "special" && !object.sliced && !object.missed).map((object) => object.special),
  );
  const statuses = [
    { active: isFreezeActive(now) || liveSpecials.has("freeze"), text: "冻结", className: "is-freeze" },
    { active: isDoubleActive(now) || liveSpecials.has("double"), text: "双倍积分", className: "is-double" },
    { active: isFrenzyActive(now) || liveSpecials.has("frenzy"), text: "狂热", className: "is-frenzy" },
  ].filter((status) => status.active);

  els.specialStatusRow.replaceChildren(
    ...statuses.map((status) => {
      const item = document.createElement("span");
      item.className = `special-status ${status.className}`;
      item.textContent = status.text;
      return item;
    }),
  );
  els.specialStatusRow.classList.toggle("is-empty", statuses.length === 0);
}

function renderYoloStats() {
  if (!els.detectedValue || !els.dangerValue || !els.fpsValue) return;
  els.detectedValue.textContent = String(state.detectedCount);
  els.dangerValue.textContent = String(state.dangerCount);
  els.fpsValue.textContent = String(state.fps);
}

function renderStartScreen() {
  els.playerNameInput.value = state.playerName;
  els.menuScoreValue.textContent = String(state.lastScore);
  els.menuBestValue.textContent = String(Math.max(state.best, ...state.leaderboard.map((entry) => entry.score), 0));
  renderLeaderboard();
}

function renderLeaderboard() {
  els.leaderboardList.replaceChildren();

  if (state.leaderboard.length === 0) {
    const item = document.createElement("li");
    item.className = "leaderboard-empty";
    item.textContent = "暂无成绩";
    els.leaderboardList.append(item);
    return;
  }

  state.leaderboard.forEach((entry, index) => {
    const item = document.createElement("li");
    const rank = document.createElement("span");
    const name = document.createElement("span");
    const score = document.createElement("span");

    rank.className = "rank";
    name.className = "name";
    score.className = "score";
    rank.textContent = `#${index + 1}`;
    name.textContent = entry.name;
    score.textContent = String(entry.score);

    item.append(rank, name, score);
    els.leaderboardList.append(item);
  });
}

function showSettlementScreen() {
  state.settlementVisible = true;
  window.clearTimeout(state.settlementTimerId);
  hideStartScreen();
  els.settlementName.textContent = state.playerName || "未命名";
  els.settlementScore.textContent = String(state.lastScore);
  els.settlementOverlay.classList.remove("is-hidden");
  state.settlementTimerId = window.setTimeout(() => {
    hideSettlementScreen();
    showStartScreen();
  }, RESULT_RETURN_DELAY_MS);
}

function hideSettlementScreen() {
  state.settlementVisible = false;
  window.clearTimeout(state.settlementTimerId);
  state.settlementTimerId = 0;
  els.settlementOverlay.classList.add("is-hidden");
}

function showStartScreen(errorText = "") {
  hideSettlementScreen();
  renderStartScreen();
  els.startOverlay.classList.remove("is-hidden");
  els.startError.textContent = errorText;
  hideCenterMessage();
}

function hideStartScreen() {
  els.startOverlay.classList.add("is-hidden");
  els.startError.textContent = "";
}

function renderStats() {
  if (els.scoreValue) els.scoreValue.textContent = String(state.score);
  if (els.comboValue) els.comboValue.textContent = String(state.combo);
  renderRoundTimer();
  if (els.bestValue) els.bestValue.textContent = String(state.best);
  if (els.fruitValue) els.fruitValue.textContent = String(state.fruitHits);
  if (els.bombValue) els.bombValue.textContent = String(state.bombHits);
  if (els.missValue) els.missValue.textContent = String(state.misses);
  renderYoloStats();
  renderSpecialStatus();
}

function renderRoundTimer() {
  if (!els.lifeValue) return;
  if (state.countdownRemainingMs > 0) {
    els.lifeValue.textContent = `准备${Math.ceil(state.countdownRemainingMs / 1000)}s`;
    return;
  }
  els.lifeValue.textContent = `${Math.ceil(state.roundTimeLeftMs / 1000)}s`;
}

function showCenterMessage(text) {
  els.centerMessage.textContent = text;
  els.centerMessage.classList.remove("is-hidden");
}

function hideCenterMessage() {
  els.centerMessage.classList.add("is-hidden");
}

function normalizePlayerName(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 24);
}

function toCanvasPoint(landmark, rect) {
  return {
    x: landmark.x * rect.width,
    y: landmark.y * rect.height,
  };
}

function normalizedToStagePoint(landmark) {
  const point = toMirroredPoint(landmark);
  return {
    x: point.x * state.width,
    y: point.y * state.height,
  };
}

function isLandmarkVisible(landmark) {
  if (!landmark) return false;
  const visibility = landmark.visibility ?? 1;
  const presence = landmark.presence ?? 1;
  return visibility >= POSE_VISIBILITY_THRESHOLD && presence >= POSE_VISIBILITY_THRESHOLD;
}

function toMirroredPoint(landmark) {
  return {
    x: 1 - landmark.x,
    y: landmark.y,
  };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function distanceToSegment(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return distance(point, a);

  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy)));
  return distance(point, { x: a.x + dx * t, y: a.y + dy * t });
}

function random(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function loadImage(src) {
  const image = new Image();
  image.decoding = "async";
  image.src = src;
  return image;
}

function isImageReady(image) {
  return image?.complete && image.naturalWidth > 0;
}
