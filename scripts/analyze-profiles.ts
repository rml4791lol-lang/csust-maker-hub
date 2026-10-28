#!/usr/bin/env tsx
/**
 * 生成成员能力档案：读取 content/submissions.json，调用分析模块写入 content/profiles.json。
 *
 * 默认规则分析（零依赖、可离线）；服务器配置 AI_API_KEY / AI_BASE_URL / AI_MODEL
 * 后自动升级为 LLM 分析，失败回退规则分析。
 *
 * 用法：pnpm analyze
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { members } from '../src/data/members';
import { analyzeWithLLM } from '../src/data/analyze';
import type { Submission } from '../src/data/contributions';

const ROOT = process.cwd();
const SUB_PATH = join(ROOT, 'content/submissions.json');
const PRO_PATH = join(ROOT, 'content/profiles.json');

const submissions = JSON.parse(readFileSync(SUB_PATH, 'utf8')) as Submission[];
const hasLLM = Boolean(process.env.AI_API_KEY && process.env.AI_BASE_URL);
const profiles = await analyzeWithLLM(submissions, members);

writeFileSync(PRO_PATH, JSON.stringify(profiles, null, 2) + '\n', 'utf8');
console.log(
  `已生成 ${profiles.length} 位成员档案（${hasLLM ? 'LLM 分析' : '规则分析；配置 AI_API_KEY/AI_BASE_URL 可启用 LLM'}）`
);
for (const p of profiles.slice(0, 3)) {
  console.log(`- ${p.name}：${p.stats.contributions} 条成果 · 标签 ${p.focusTags.join('/')}`);
}
