import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 5173);
const dataFile = path.join(root, "data", "fruit-data.json");
const leaderboardLimit = 8;

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".mp3", "audio/mpeg"],
]);

createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
    if (url.pathname === "/api/fruit-data") {
      await handleGameDataRequest(request, response);
      return;
    }

    const requestedPath = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
    const filePath = path.resolve(root, `.${requestedPath}`);
    const relativePath = path.relative(root, filePath);

    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      response.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
      response.end("Forbidden");
      return;
    }

    const fileStat = await stat(filePath);
    const resolvedFile = fileStat.isDirectory() ? path.join(filePath, "index.html") : filePath;
    const resolvedStat = await stat(resolvedFile);
    if (!resolvedStat.isFile()) throw new Error("Not a file");
    const extension = path.extname(resolvedFile).toLowerCase();
    response.writeHead(200, {
      "content-type": mimeTypes.get(extension) ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    createReadStream(resolvedFile).pipe(response);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`YOLO Fruit Ninja running at http://127.0.0.1:${port}`);
});

async function handleGameDataRequest(request, response) {
  if (request.method === "GET") {
    sendJson(response, 200, { data: await readGameData() });
    return;
  }

  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  let patch;
  try {
    patch = JSON.parse(await readRequestBody(request));
  } catch {
    sendJson(response, 400, { error: "Invalid JSON" });
    return;
  }

  const data = mergeGameData(await readGameData(), patch);
  await writeGameData(data);
  sendJson(response, 200, { data });
}

async function readGameData() {
  try {
    return normalizeGameData(JSON.parse(await readFile(dataFile, "utf8")));
  } catch {
    return normalizeGameData({});
  }
}

async function writeGameData(data) {
  await mkdir(path.dirname(dataFile), { recursive: true });
  await writeFile(dataFile, `${JSON.stringify(normalizeGameData(data), null, 2)}\n`, "utf8");
}

async function readRequestBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body) > 64 * 1024) throw new Error("Request body too large");
  }
  return body || "{}";
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(payload));
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

  return [...byName.values()].sort((a, b) => b.score - a.score || a.at - b.at).slice(0, leaderboardLimit);
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
