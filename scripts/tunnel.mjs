import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const port = process.argv[2] || process.env.PORT || "4173";
const shareFile = new URL("../.share-url", import.meta.url);

function save(url) {
  const clean = String(url).trim().replace(/\/$/, "");
  writeFileSync(shareFile, clean);
  console.log(`\nFriends open this URL (no git needed):\n  ${clean}\n`);
}

function extractUrl(text) {
  const cf = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
  if (cf) return cf[0];
  const lt = text.match(/https:\/\/[a-z0-9.-]+\.loca\.lt/i);
  if (lt) return lt[0];
  const any = text.match(/https:\/\/[a-z0-9.-]+\.(?:trycloudflare\.com|loca\.lt|ngrok-free\.(?:app|dev)|ngrok\.io)/i);
  return any?.[0] ?? null;
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
      windowsHide: true,
    });
    let found = false;
    const onData = (buf) => {
      const s = buf.toString();
      process.stderr.write(s);
      const url = extractUrl(s);
      if (url && !found) {
        found = true;
        save(url);
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("error", reject);
    child.on("exit", (code) => {
      if (!found) reject(new Error(`${command} exited ${code}`));
      else resolve(child);
    });
  });
}

async function main() {
  console.log(`Opening a public tunnel to http://127.0.0.1:${port} …`);
  await new Promise((r) => setTimeout(r, 1500));
  try {
    await run("cloudflared", ["tunnel", "--no-autoupdate", "--url", `http://127.0.0.1:${port}`]);
    return;
  } catch (err) {
    console.error("cloudflared not available, trying npx localtunnel…");
  }
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  await run(npx, ["--yes", "localtunnel", "--port", String(port)]);
}

main().catch((err) => {
  console.error(err);
  console.error("\nCould not open a public tunnel. Friends on your Wi-Fi can still use the LAN URL from the waiting room.");
  process.exit(1);
});
