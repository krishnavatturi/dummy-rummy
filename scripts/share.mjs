import { spawn } from "node:child_process";
import { networkInterfaces } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = String(process.env.PORT || "4173");
const node = process.execPath;
const tsxCli = join(ROOT, "node_modules", "tsx", "dist", "cli.mjs");
const tunnelScript = join(ROOT, "scripts", "tunnel.mjs");

function lanUrls(port) {
  const urls = [];
  for (const addrs of Object.values(networkInterfaces())) {
    for (const a of addrs ?? []) {
      const v4 = a.family === "IPv4" || a.family === 4;
      if (v4 && !a.internal) urls.push(`http://${a.address}:${port}`);
    }
  }
  return urls;
}

/** Never use shell:true with node.exe — Windows splits `C:\Program Files\...`. */
function child(args, extraEnv = {}) {
  return spawn(node, args, {
    cwd: ROOT,
    env: { ...process.env, ...extraEnv },
    stdio: "inherit",
    shell: false,
    windowsHide: true,
  });
}

console.log(`Starting Adda rummy on port ${PORT} …`);
console.log(`You (this PC):  http://localhost:${PORT}`);
for (const u of lanUrls(PORT)) console.log(`Same Wi-Fi:     ${u}`);
console.log("Waiting for a public friend URL (keep this window open) …\n");

const game = child([tsxCli, "server/index.ts"], { PORT });
const tunnel = child([tunnelScript, PORT]);

let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const k of [game, tunnel]) {
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
  if (stopping) return;
  if (code) {
    console.error(`\nNo public URL this time. Open http://localhost:${PORT} on this PC.`);
    console.error("Friends on your Wi-Fi can use the LAN invite from the waiting room.\n");
  }
});
game.on("error", (err) => {
  console.error("Could not start the game server:", err);
  stop(1);
});
tunnel.on("error", (err) => {
  console.error("Could not start the tunnel:", err);
});
