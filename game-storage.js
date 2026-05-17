const STORAGE_ENDPOINT = "./api/fruit-data";
const LEADERBOARD_LIMIT = 8;

const LOCAL_KEYS = {
  fruitYoloBest: "fruitYoloBest",
  fruitYoloLastScore: "fruitYoloLastScore",
  fruitYoloPlayerName: "fruitYoloPlayerName",
  fruitYoloLeaderboard: "fruitYoloLeaderboard",
};

export async function loadGameData() {
  const localData = loadLocalGameData();
  try {
    const response = await fetch(STORAGE_ENDPOINT, { cache: "no-store" });
    if (!response.ok) throw new Error("Storage API unavailable");
    const payload = await response.json();
    const serverData = normalizeGameData(payload.data ?? payload);
    const shouldImportLocal = !hasStoredGameData(serverData) && hasStoredGameData(localData);
    const data = shouldImportLocal ? mergeGameData(serverData, localData) : serverData;
    saveLocalGameData(data);
    if (shouldImportLocal) void postGameData(data);
    return data;
  } catch {
    return localData;
  }
}

function hasStoredGameData(data) {
  const normalized = normalizeGameData(data);
  return (
    normalized.fruitYolo.best > 0 ||
    normalized.fruitYolo.lastScore > 0 ||
    normalized.fruitYolo.playerName.length > 0 ||
    normalized.fruitYolo.leaderboard.length > 0
  );
}

export async function saveGameData(patch) {
  const localData = mergeGameData(loadLocalGameData(), patch);
  saveLocalGameData(localData);

  try {
    const payload = await postGameData(patch);
    const data = normalizeGameData(payload.data ?? payload);
    saveLocalGameData(data);
    return data;
  } catch {
    return localData;
  }
}

async function postGameData(patch) {
  const response = await fetch(STORAGE_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(patch),
  });
  if (!response.ok) throw new Error("Storage API unavailable");
  return response.json();
}

function loadLocalGameData() {
  return normalizeGameData({
    fruitYolo: {
      best: readLocalNumber(LOCAL_KEYS.fruitYoloBest),
      lastScore: readLocalNumber(LOCAL_KEYS.fruitYoloLastScore),
      playerName: readLocalValue(LOCAL_KEYS.fruitYoloPlayerName) || "",
      leaderboard: readLocalJson(LOCAL_KEYS.fruitYoloLeaderboard, []),
    },
  });
}

function saveLocalGameData(data) {
  const normalized = normalizeGameData(data);
  writeLocalValue(LOCAL_KEYS.fruitYoloBest, String(normalized.fruitYolo.best));
  writeLocalValue(LOCAL_KEYS.fruitYoloLastScore, String(normalized.fruitYolo.lastScore));
  writeLocalValue(LOCAL_KEYS.fruitYoloPlayerName, normalized.fruitYolo.playerName);
  writeLocalValue(LOCAL_KEYS.fruitYoloLeaderboard, JSON.stringify(normalized.fruitYolo.leaderboard));
}

function mergeGameData(base, patch) {
  const current = normalizeGameData(base);
  const next = normalizeGameData(current);

  const fruitYolo = patch?.fruitYolo;
  if (fruitYolo && typeof fruitYolo === "object") {
    if (Object.hasOwn(fruitYolo, "best")) {
      next.fruitYolo.best = Math.max(current.fruitYolo.best, normalizeScore(fruitYolo.best));
    }
    if (Object.hasOwn(fruitYolo, "lastScore")) {
      next.fruitYolo.lastScore = normalizeScore(fruitYolo.lastScore);
    }
    if (Object.hasOwn(fruitYolo, "playerName")) {
      next.fruitYolo.playerName = normalizePlayerName(fruitYolo.playerName);
    }
    if (Object.hasOwn(fruitYolo, "leaderboard")) {
      next.fruitYolo.leaderboard = normalizeLeaderboard([...current.fruitYolo.leaderboard, ...normalizeLeaderboard(fruitYolo.leaderboard)]);
    }
  }

  next.fruitYolo.best = Math.max(next.fruitYolo.best, ...next.fruitYolo.leaderboard.map((entry) => entry.score), 0);
  return next;
}

function normalizeGameData(value = {}) {
  const fruitYolo = value.fruitYolo ?? {};
  return {
    fruitYolo: {
      best: normalizeScore(fruitYolo.best),
      lastScore: normalizeScore(fruitYolo.lastScore),
      playerName: normalizePlayerName(fruitYolo.playerName),
      leaderboard: normalizeLeaderboard(fruitYolo.leaderboard),
    },
  };
}

function normalizeLeaderboard(value) {
  if (!Array.isArray(value)) return [];
  const byName = new Map();
  for (const entry of value
    .filter((entry) => entry && typeof entry.name === "string" && Number.isFinite(Number(entry.score)))
    .map((entry) => ({
      name: normalizePlayerName(entry.name) || "未命名",
      score: normalizeScore(entry.score),
      at: Number(entry.at) || 0,
    }))) {
    const current = byName.get(entry.name);
    if (!current || entry.score > current.score || (entry.score === current.score && entry.at < current.at)) {
      byName.set(entry.name, entry);
    }
  }

  return [...byName.values()].sort((a, b) => b.score - a.score || a.at - b.at).slice(0, LEADERBOARD_LIMIT);
}

function normalizePlayerName(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 24);
}

function normalizeScore(value) {
  return Math.max(0, Math.round(Number(value) || 0));
}

function readLocalNumber(key) {
  return normalizeScore(readLocalValue(key));
}

function readLocalJson(key, fallback) {
  try {
    return JSON.parse(readLocalValue(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function readLocalValue(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalValue(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // The local JSON API is the primary store; localStorage is only a browser fallback.
  }
}
