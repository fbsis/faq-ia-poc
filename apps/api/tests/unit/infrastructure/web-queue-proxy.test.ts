import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const repositoryRoot = new URL("../../../../../", import.meta.url);

describe("Bull Board web proxy", () => {
  it("forwards the queue dashboard through the Vite development server", () => {
    const viteConfig = readFileSync(new URL("apps/web/vite.config.ts", repositoryRoot), "utf8");

    expect(viteConfig).toContain('"/admin/queues": apiProxyTarget');
  });

  it("forwards the queue dashboard through the production web server", () => {
    const nginxConfig = readFileSync(new URL("docker/web-server.conf", repositoryRoot), "utf8");

    expect(nginxConfig).toContain("location /admin/queues");
    expect(nginxConfig).toContain("proxy_pass http://api:3000");
  });
});
