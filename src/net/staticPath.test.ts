import { describe, expect, it } from "vitest";
import { resolve as pathResolve } from "node:path";
import { resolvePublicFile } from "./staticPath";

const dist = pathResolve("/tmp/adda-dist");

describe("resolvePublicFile", () => {
  it("maps / to index.html inside dist", () => {
    expect(resolvePublicFile(dist, "/")).toBe(pathResolve(dist, "index.html"));
    expect(resolvePublicFile(dist, "/index.html")).toBe(pathResolve(dist, "index.html"));
  });

  it("keeps asset paths under dist", () => {
    expect(resolvePublicFile(dist, "/assets/app.js")).toBe(pathResolve(dist, "assets/app.js"));
  });

  it("rejects path traversal", () => {
    expect(resolvePublicFile(dist, "/../secret")).toBeNull();
    expect(resolvePublicFile(dist, "/assets/../../secret")).toBeNull();
  });
});
