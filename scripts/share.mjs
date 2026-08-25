import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = String(process.env.PORT || "4173");
const win = process.platform === "win32";
const tsx = join(ROOT, "node_modules", ".bin", win ? "tsx.cmd" : "tsx");
const tunnelScript = join(ROOT, "scripts", "tunnel.mjs");

function child(command, args, extraEnv = {}) {
  return spawn(command, args, {
    cwd: ROOT,
    env: { ...process.env, ...extraEnv },
    stdio: "inherit",
    shell: win,
    windowsHide: true,
  });
}

console.log(`Starting Adda rummy on port ${PORT} (Windows-safe) …`);
const game = child(tsx, ["server/index.ts"], { PORT });
const tunnel = child(process.execPath, [tunnelScript, PORT]);

const kids = [game, tunnel];
let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const k of kids) {
    try {
      k.kill();
    } catch {
      /* ignore */
    }
  }
  process.exit(code);
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

game.on("exit", (code) => {
  if (!stopping) {
    console.error(`Game server exited (${code ?? "null"})`);
    stop(code || 1);
  }
});
tunnel.on("exit", (code) => {
  if (!stopping) {
    console.error(`Tunnel exited (${code ?? "null"})`);
    stop(code || 1);
  }
});
game.on("error", (err) => {
  console.error("Could not start the game server:", err);
  stop(1);
});
tunnel.on("error", (err) => {
  console.error("Could not start the tunnel:", err);
  stop(1);
});
