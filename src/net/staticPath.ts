import { isAbsolute, relative, resolve, sep } from "node:path";

/** Map a request path onto a file under distDir, or null if it would escape. */
export function resolvePublicFile(distDir: string, reqPath: string): string | null {
  const raw = decodeURIComponent((reqPath.split("?")[0] || "/")).replace(/\\/g, "/");
  if (raw.includes("\0")) return null;
  const rel = (raw === "/" ? "index.html" : raw).replace(/^\/+/, "");
  if (!rel || rel.split("/").some((part) => part === "..")) return null;
  const root = resolve(distDir);
  const full = resolve(root, rel);
  const inside = relative(root, full);
  if (!inside || inside.startsWith("..") || inside.startsWith(`..${sep}`) || isAbsolute(inside)) return null;
  return full;
}
