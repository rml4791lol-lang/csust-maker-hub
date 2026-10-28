import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { request as httpRequest } from "node:http";

test("loopback setup rejects forwarded/foreign requests, creates once, and closes", async () => {
  const directory = mkdtempSync(join(tmpdir(), "association-setup-test-"));
  const child = spawn(process.execPath, ["--experimental-strip-types", "scripts/setup-admin.ts"], {
    cwd: new URL("../", import.meta.url), windowsHide: true,
    env: { ...process.env, AI_ASSOCIATION_DATA_DIR: directory, AI_ASSOCIATION_ALLOW_LOCAL_SETUP: "1", AI_ASSOCIATION_SETUP_PORT: "3191", ADMIN_USER: "", ADMIN_PASSWORD: "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let exited = false;
  const exit = once(child, "exit").then(() => { exited = true; });
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Local setup did not start")), 10_000);
      child.stdout.on("data", (chunk) => { if (String(chunk).includes("Local administrator setup:")) { clearTimeout(timer); resolve(); } });
      child.once("error", (error) => { clearTimeout(timer); reject(error); });
      child.once("exit", () => { clearTimeout(timer); reject(new Error("Local setup exited before listening")); });
    });
    const address = "http://127.0.0.1:3191";
    for (const headers of [{ "x-forwarded-for": "127.0.0.1" }, { forwarded: "for=127.0.0.1" }, { host: "example.test:3191" }, { "sec-fetch-site": "cross-site" }]) {
      const status = await new Promise<number | undefined>((resolve, reject) => {
        const request = httpRequest(address, { headers }, (response) => { response.resume(); resolve(response.statusCode); });
        request.once("error", reject); request.end();
      });
      assert.equal(status, 403, JSON.stringify(headers));
    }
    const page = await fetch(address);
    assert.equal(page.status, 200);
    const html = await page.text();
    const token = html.match(/'X-Setup-Token':'([a-f0-9]+)'/)?.[1];
    assert.ok(token);
    const body = JSON.stringify({ username: "fixture-owner", password: "fixture-long-password" });
    const headers = { "Content-Type": "application/json", origin: address, "X-Setup-Token": token };
    assert.equal((await fetch(`${address}/account`, { method: "POST", headers: { ...headers, origin: "http://foreign.test" }, body })).status, 403);
    assert.equal((await fetch(`${address}/account`, { method: "POST", headers: { ...headers, "X-Setup-Token": "wrong" }, body })).status, 403);
    assert.equal((await fetch(`${address}/account`, { method: "POST", headers: { ...headers, "x-forwarded-host": "127.0.0.1:3191" }, body })).status, 403);
    assert.equal((await fetch(`${address}/account`, { method: "POST", headers, body })).status, 201);
    await exit;
    const stored = readFileSync(join(directory, "admin-auth", "account.json"), "utf8");
    assert.doesNotMatch(stored, /fixture-long-password/);
    await assert.rejects(fetch(address));
  } finally {
    if (!exited) { child.kill(); await exit; }
    rmSync(directory, { recursive: true, force: true });
  }
});
