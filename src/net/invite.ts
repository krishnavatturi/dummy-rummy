export type HostInfo = {
  publicOrigin: string | null;
  lanOrigins: string[];
  port: number;
};

export function makeInviteLink(origin: string, code: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/?room=${encodeURIComponent(code.trim().toUpperCase())}`;
}

export function isLoopbackOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  } catch {
    return false;
  }
}

/** Port friends should hit: the page/proxy Host, not the inner WebSocket port. */
export function advertisedPort(hostHeader: string | undefined, fallback: number): number {
  const host = hostHeader ?? "";
  const m = host.match(/:(\d+)$/);
  if (m) return Number(m[1]);
  return fallback;
}

/** Prefer a tunnel URL, then the page origin if it is reachable, then a LAN address. */
export function bestInviteOrigin(pageOrigin: string, info: HostInfo | null): string {
  if (info?.publicOrigin) return info.publicOrigin.replace(/\/$/, "");
  if (!isLoopbackOrigin(pageOrigin)) return pageOrigin.replace(/\/$/, "");
  return info?.lanOrigins[0]?.replace(/\/$/, "") ?? pageOrigin.replace(/\/$/, "");
}

export function inviteHint(origin: string, info: HostInfo | null): string {
  if (info?.publicOrigin) {
    return "Anyone with this link can sit. They only need a browser — no git.";
  }
  if (isLoopbackOrigin(origin)) {
    return "This is a local address. Friends on your Wi-Fi can use the LAN link, or run npm run share for a public URL.";
  }
  return "Friends on the same network can open this link. For the internet, run npm run share.";
}
