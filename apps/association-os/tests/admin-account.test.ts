import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLocalAccount, localAccountPath, readLocalAccount, verifyLocalAccount } from "../src/lib/admin-account.ts";

test("local setup requires opt-in, stores only hashes, atomically refuses replacement and gives environment credentials precedence", async () => {
  const directory = mkdtempSync(join(tmpdir(), "association-auth-test-"));
  const previous = { data: process.env.AI_ASSOCIATION_DATA_DIR, setup: process.env.AI_ASSOCIATION_ALLOW_LOCAL_SETUP, user: process.env.ADMIN_USER, password: process.env.ADMIN_PASSWORD };
  process.env.AI_ASSOCIATION_DATA_DIR = directory;
  delete process.env.ADMIN_USER;
  delete process.env.ADMIN_PASSWORD;
  delete process.env.AI_ASSOCIATION_ALLOW_LOCAL_SETUP;
  try {
    await assert.rejects(createLocalAccount("fixture-owner", "fixture-long-password"));
    process.env.AI_ASSOCIATION_ALLOW_LOCAL_SETUP = "1";
    await assert.rejects(createLocalAccount("a", "short"));
    const results = await Promise.allSettled([
      createLocalAccount("fixture-owner", "fixture-long-password"),
      createLocalAccount("fixture-owner", "fixture-long-password"),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const account = readLocalAccount();
    assert.ok(account);
    assert.equal(await verifyLocalAccount(account, "fixture-owner", "fixture-long-password"), true);
    assert.equal(await verifyLocalAccount(account, "fixture-owner", "wrong-password"), false);
    assert.equal(await verifyLocalAccount(account, "other-owner", "fixture-long-password"), false);
    const stored = readFileSync(localAccountPath(), "utf8");
    assert.doesNotMatch(stored, /fixture-long-password/);
    await assert.rejects(createLocalAccount("replacement", "replacement-password"));
    assert.equal(readFileSync(localAccountPath(), "utf8"), stored);
    process.env.ADMIN_USER = "environment-owner";
    assert.equal(readLocalAccount(), null);
    await assert.rejects(createLocalAccount("replacement", "replacement-password"));
  } finally {
    const restore = (key: string, value: string | undefined) => { if (value === undefined) delete process.env[key]; else process.env[key] = value; };
    restore("AI_ASSOCIATION_DATA_DIR", previous.data); restore("AI_ASSOCIATION_ALLOW_LOCAL_SETUP", previous.setup);
    restore("ADMIN_USER", previous.user); restore("ADMIN_PASSWORD", previous.password);
    rmSync(directory, { recursive: true, force: true });
  }
});
