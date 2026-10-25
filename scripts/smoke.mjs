#!/usr/bin/env node
/**
 * 构建烟雾检查：构建产物不是空站。
 * 跑法：node scripts/smoke.mjs（需先 pnpm build）
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const errors = [];

function must(cond, message) {
  if (!cond) errors.push(message);
}

function read(rel) {
  const p = join(DIST, rel);
  if (!existsSync(p)) {
    errors.push(`缺文件：dist/${rel}`);
    return '';
  }
  return readFileSync(p, 'utf8');
}

// 1. 关键页面存在
const pages = [
  'index.html',
  'library/index.html',
  'members/index.html',
  'services/index.html',
  'about/index.html',
  'stats/index.html',
];
for (const p of pages) must(existsSync(join(DIST, p)), `缺关键页面：dist/${p}`);

// 2. 首页包含五类入口
const home = read('index.html');
for (const label of ['攻略', '技能指令', '模板素材', '外部项目', '培训']) {
  must(home.includes(label), `首页缺少分类入口：${label}`);
}

// 3. 首页出现至少一条内容标题（从 library 目录反查一条详情页）
const libDir = join(DIST, 'library');
let detailHtml = '';
let detailId = '';
if (existsSync(libDir)) {
  const entries = readdirSync(libDir, { withFileTypes: true }).filter((d) => d.isDirectory());
  must(entries.length > 0, '内容库没有任何详情页');
  if (entries.length) {
    detailId = entries[0].name;
    detailHtml = read(`library/${detailId}/index.html`);
  }
} else {
  errors.push('缺少 dist/library 目录');
}

// 详情页包含正文与审核信息
if (detailHtml) {
  must(detailHtml.includes('detail-main'), `详情页 ${detailId} 缺少正文区域`);
  must(detailHtml.includes('条目信息'), `详情页 ${detailId} 缺少条目信息区`);
}

// 4. noindex 生效
must(home.includes('noindex'), '首页缺少 noindex');
must(existsSync(join(DIST, 'robots.txt')), '缺少 robots.txt');

if (errors.length) {
  console.error('✗ 烟雾检查失败：');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}

console.log(`✓ 烟雾检查通过（检查了 ${pages.length} 个页面、五类入口、详情页 ${detailId}）`);
