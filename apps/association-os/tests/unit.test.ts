// ============================================================
// 单元测试：状态流转规则 + 字段编码校验
// 运行：pnpm test
// ============================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { canTransition, CONTRIBUTION_FLOW } from "../src/lib/workflow.ts";
import { encodeValue, type FieldDef } from "../src/lib/admin-schema.ts";

const numField: FieldDef = { key: "hours", label: "耗时", type: "number" };
const tagsField: FieldDef = { key: "skills", label: "技能", type: "tags" };

/* ---------- 状态流转 ---------- */

test("贡献状态：draft 不能直接 approved（防绕过审核）", () => {
  assert.equal(canTransition(CONTRIBUTION_FLOW, "draft", "approved"), false);
});

test("贡献状态：draft 可以提交为 pending", () => {
  assert.equal(canTransition(CONTRIBUTION_FLOW, "draft", "pending"), true);
});

test("贡献状态：pending 可以通过或打回", () => {
  assert.equal(canTransition(CONTRIBUTION_FLOW, "pending", "approved"), true);
  assert.equal(canTransition(CONTRIBUTION_FLOW, "pending", "draft"), true);
});

test("贡献状态：approved 是终态", () => {
  assert.equal(canTransition(CONTRIBUTION_FLOW, "approved", "pending"), false);
});

test("贡献状态：相同状态允许（幂等保存）", () => {
  assert.equal(canTransition(CONTRIBUTION_FLOW, "pending", "pending"), true);
});

/* ---------- 字段编码 ---------- */

test("数值：负数被 clamp 为 0", () => {
  assert.equal(encodeValue(-5, numField), 0);
});

test("数值：小数被取整", () => {
  assert.equal(encodeValue(3.9, numField), 3);
});

test("数值：非数字降级为 0", () => {
  assert.equal(encodeValue("abc", numField), 0);
});

test("标签：逗号分隔字符串转为 JSON 数组", () => {
  assert.equal(encodeValue("前端, Astro", tagsField), '["前端","Astro"]');
});

test("标签：中文逗号也支持", () => {
  assert.equal(encodeValue("前端，Astro", tagsField), '["前端","Astro"]');
});

test("标签：空字符串得到空数组", () => {
  assert.equal(encodeValue("", tagsField), "[]");
});
