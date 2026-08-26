import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { networkInterfaces } from "node:os";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer, WebSocket } from "ws";
import { BOT_NAMES, LOBBY_TABLES } from "../src/game/lobby";
import { applyAction, type GameAction } from "../src/game/actions";
import { takeBotTurn } from "../src/game/bots";
import { createMatch, currentSeat, discard, drawClosed, getSeatCards } from "../src/game/engine";
import { viewFor } from "../src/game/net";
import { advertisedPort, requestHost } from "../src/net/invite";
import { resolvePublicFile } from "../src/net/staticPath";
import type { GameState, TableConfig, TableSeat } from "../src/game/types";

const PORT = Number(process.env.PORT ?? 8787);
const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const SHARE_FILE = join(ROOT, ".share-url");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".map": "application/json",
};

type ClientMsg =
  | { t: "hello"; name: string }
  | { t: "create"; tableId: string }
  | { t: "join"; code: string }
  | { t: "start"; fillBots?: boolean }
  | { t: "action"; action: GameAction }
  | { t: "leave" };

type Player = {
  id: string;
  name: string;
  avatarHue: number;
  ws: WebSocket;
};

type Room = {
  code: string;
  table: TableConfig;
  hostId: string;
  players: Player[];
  game: GameState | null;
  botTimer: ReturnType<typeof setTimeout> | null;
  turnTimer: ReturnType<typeof setTimeout> | null;
};

const rooms = new Map<string, Room>();
const sockets = new Map<WebSocket, { playerId: string; name: string; roomCode: string | null }>();

function send(ws: WebSocket, msg: unknown) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function roomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return rooms.has(code) ? roomCode() : code;
}

function lanOrigins(port: number): string[] {
  const urls: string[] = [];
  for (const addrs of Object.values(networkInterfaces())) {
    for (const a of addrs ?? []) {
      const v4 = a.family === "IPv4" || a.family === 4;
      if (v4 && !a.internal) urls.push(`http://${a.address}:${port}`);
    }
  }
  return urls;
}

function publicOrigin(): string | null {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, "");
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN.replace(/\/$/, "")}`;
  }
  if (process.env.FLY_APP_NAME) return `https://${process.env.FLY_APP_NAME}.fly.dev`;
  try {
    const raw = readFileSync(SHARE_FILE, "utf8").trim();
    return raw ? raw.replace(/\/$/, "") : null;
  } catch {
    return null;
  }
}

function roomView(room: Room, youId: string) {
  return {
    code: room.code,
    table: room.table,
    hostId: room.hostId,
    youId,
    started: Boolean(room.game),
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      avatarHue: p.avatarHue,
    })),
  };
}

function broadcast(room: Room) {
  for (const p of room.players) {
    send(p.ws, { t: "room", room: roomView(room, p.id) });
    if (room.game) {
      send(p.ws, { t: "state", game: viewFor(room.game, p.id) });
    }
  }
}

function clearTimers(room: Room) {
  if (room.botTimer) clearTimeout(room.botTimer);
  if (room.turnTimer) clearTimeout(room.turnTimer);
  room.botTimer = null;
  room.turnTimer = null;
}

function armTimers(room: Room) {
  clearTimers(room);
  const game = room.game;
  if (!game || (game.phase !== "draw" && game.phase !== "discard")) return;
  const seat = currentSeat(game);
  const token = game.logSeq;

  if (seat.isBot && seat.status === "active") {
    const wait = game.phase === "draw" ? 900 : 1100;
    room.botTimer = setTimeout(() => {
      if (!room.game || room.game.logSeq !== token) return;
      room.game = takeBotTurn(room.game);
      broadcast(room);
      armTimers(room);
    }, wait);
    return;
  }

  room.turnTimer = setTimeout(() => {
    if (!room.game || room.game.logSeq !== token) return;
    const actor = currentSeat(room.game);
    if (actor.isBot) return;
    if (room.game.phase === "draw") {
      room.game = drawClosed(room.game, actor.id);
    } else if (room.game.phase === "discard") {
      const cards = getSeatCards(room.game, actor.id);
      const id = room.game.drawnCardId ?? cards[cards.length - 1]?.id;
      if (id) room.game = discard(room.game, actor.id, id);
    }
    broadcast(room);
    armTimers(room);
  }, 40_000);
}

function fillBots(table: TableConfig, humans: TableSeat[]): TableSeat[] {
  const seats = humans.slice();
  const names = BOT_NAMES.filter((n) => !humans.some((h) => h.name.toLowerCase() === n.toLowerCase()));
  for (let i = 0; seats.length < table.seats; i++) {
    seats.push({
      id: `bot-${i}`,
      name: names[i % names.length]!,
      isBot: true,
      avatarHue: (28 + i * 47) % 360,
    });
  }
  return seats;
}

function leaveRoom(ws: WebSocket) {
  const meta = sockets.get(ws);
  if (!meta?.roomCode) return;
  const room = rooms.get(meta.roomCode);
  meta.roomCode = null;
  if (!room) return;
  room.players = room.players.filter((p) => p.ws !== ws);
  if (room.players.length === 0) {
    clearTimers(room);
    rooms.delete(room.code);
    return;
  }
  if (room.hostId === meta.playerId) room.hostId = room.players[0]!.id;
  broadcast(room);
}

function headerString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function sendJson(res: import("node:http").ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
  });
  res.end(JSON.stringify(body));
}

function serveStatic(reqPath: string, res: import("node:http").ServerResponse): boolean {
  if (!existsSync(DIST)) return false;
  let file = resolvePublicFile(DIST, reqPath);
  if (!file) {
    res.writeHead(403);
    res.end("forbidden");
    return true;
  }
  if (!existsSync(file) || statSync(file).isDirectory()) {
    file = resolvePublicFile(DIST, "/index.html");
  }
  if (!file || !existsSync(file)) return false;
  res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
  return true;
}

const httpServer = createServer((req, res) => {
  const url = req.url ?? "/";
  if (url.startsWith("/api/info")) {
    const port = advertisedPort(requestHost(req.headers.host, headerString(req.headers["x-forwarded-host"])), PORT);
    sendJson(res, 200, {
      publicOrigin: publicOrigin(),
      lanOrigins: lanOrigins(port),
      port,
    });
    return;
  }
  if (serveStatic(url, res)) return;
  res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
  res.end("adda-rummy realtime");
});

const wss = new WebSocketServer({ noServer: true });

httpServer.on("upgrade", (req, socket, head) => {
  const path = req.url?.split("?")[0];
  if (path !== "/ws") {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
});

wss.on("connection", (ws) => {
  const playerId = uid("p");
  sockets.set(ws, { playerId, name: "Player", roomCode: null });
  send(ws, { t: "hello", playerId });

  ws.on("message", (raw) => {
    let msg: ClientMsg;
    try {
      msg = JSON.parse(String(raw)) as ClientMsg;
    } catch {
      send(ws, { t: "error", message: "Bad message." });
      return;
    }
    const meta = sockets.get(ws);
    if (!meta) return;

    if (msg.t === "hello") {
      meta.name = (msg.name || "Player").trim().slice(0, 16) || "Player";
      return;
    }

    if (msg.t === "create") {
      const table = LOBBY_TABLES.find((t) => t.id === msg.tableId) ?? LOBBY_TABLES[0]!;
      leaveRoom(ws);
      const code = roomCode();
      const player: Player = {
        id: playerId,
        name: meta.name,
        avatarHue: 8,
        ws,
      };
      const room: Room = {
        code,
        table,
        hostId: playerId,
        players: [player],
        game: null,
        botTimer: null,
        turnTimer: null,
      };
      rooms.set(code, room);
      meta.roomCode = code;
      send(ws, { t: "room", room: roomView(room, playerId) });
      return;
    }

    if (msg.t === "join") {
      const room = rooms.get(msg.code.trim().toUpperCase());
      if (!room) {
        send(ws, { t: "error", message: "No table with that code." });
        return;
      }
      if (room.game) {
        send(ws, { t: "error", message: "That hand already started." });
        return;
      }
      if (room.players.length >= room.table.seats) {
        send(ws, { t: "error", message: "Table is full." });
        return;
      }
      if (room.players.some((p) => p.id === playerId)) return;
      leaveRoom(ws);
      let name = meta.name;
      if (room.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
        name = `${name} ${room.players.length + 1}`;
        meta.name = name;
      }
      room.players.push({
        id: playerId,
        name,
        avatarHue: (8 + room.players.length * 47) % 360,
        ws,
      });
      meta.roomCode = room.code;
      broadcast(room);
      return;
    }

    if (msg.t === "start") {
      const room = meta.roomCode ? rooms.get(meta.roomCode) : undefined;
      if (!room || room.hostId !== playerId) {
        send(ws, { t: "error", message: "Only the host can deal." });
        return;
      }
      if (room.game) return;
      const humans: TableSeat[] = room.players.map((p) => ({
        id: p.id,
        name: p.name,
        isBot: false,
        avatarHue: p.avatarHue,
      }));
      if (humans.length < 2 && !msg.fillBots) {
        send(ws, { t: "error", message: "Need another player, or fill empty seats with bots." });
        return;
      }
      const seats = msg.fillBots === false && humans.length >= 2 ? humans : fillBots(room.table, humans);
      room.game = createMatch(room.table, seats.slice(0, room.table.seats));
      broadcast(room);
      armTimers(room);
      return;
    }

    if (msg.t === "action") {
      const room = meta.roomCode ? rooms.get(meta.roomCode) : undefined;
      if (!room?.game) {
        send(ws, { t: "error", message: "No hand in play." });
        return;
      }
      room.game = applyAction(room.game, playerId, msg.action);
      broadcast(room);
      armTimers(room);
      return;
    }

    if (msg.t === "leave") {
      leaveRoom(ws);
    }
  });

  ws.on("close", () => {
    leaveRoom(ws);
    sockets.delete(ws);
  });
});

httpServer.listen(PORT, "0.0.0.0", () => {
  const lan = lanOrigins(PORT);
  console.log(`Adda rummy realtime on :${PORT}`);
  if (lan.length) console.log(`LAN: ${lan.join(", ")}`);
});
