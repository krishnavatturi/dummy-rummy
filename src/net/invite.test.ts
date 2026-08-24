import { describe, expect, it } from "vitest";
import {
  advertisedPort,
  bestInviteOrigin,
  inviteHint,
  isLoopbackOrigin,
  makeInviteLink,
} from "./invite";

describe("invite links", () => {
  it("builds a room query on the given origin", () => {
    expect(makeInviteLink("https://adda.example", "tcwk")).toBe("https://adda.example/?room=TCWK");
  });

  it("prefers a public tunnel origin over localhost", () => {
    expect(
      bestInviteOrigin("http://localhost:4173", {
        publicOrigin: "https://abc.trycloudflare.com",
        lanOrigins: ["http://192.168.1.8:4173"],
        port: 4173,
      }),
    ).toBe("https://abc.trycloudflare.com");
  });

  it("falls back to LAN when the host is on loopback", () => {
    expect(isLoopbackOrigin("http://127.0.0.1:5173")).toBe(true);
    expect(
      bestInviteOrigin("http://localhost:5173", {
        publicOrigin: null,
        lanOrigins: ["http://10.0.0.4:5173"],
        port: 5173,
      }),
    ).toBe("http://10.0.0.4:5173");
  });

  it("uses the browser/proxy port from Host, not the inner realtime port", () => {
    expect(advertisedPort("localhost:5173", 8787)).toBe(5173);
    expect(advertisedPort("192.168.1.8:4173", 8787)).toBe(4173);
    expect(advertisedPort("abc.trycloudflare.com", 4173)).toBe(4173);
  });

  it("explains local vs public invites", () => {
    expect(inviteHint("https://abc.trycloudflare.com", { publicOrigin: "https://abc.trycloudflare.com", lanOrigins: [], port: 4173 })).toMatch(
      /browser/i,
    );
    expect(inviteHint("http://localhost:5173", { publicOrigin: null, lanOrigins: [], port: 5173 })).toMatch(/share/i);
  });
});
