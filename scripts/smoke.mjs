#!/usr/bin/env node
/**
 * 构建烟雾检查：构建产物不是空站，且信息架构符合「展示活动成果 + 成员能力」的定位。
 * 跑法：node scripts/smoke.mjs（需先 pnpm build）
 */
import { existsSync, readFileSync } from 'node:fs';
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
const pages = ['index.html', 'achievements/index.html', 'members/index.html', 'contribute/index.html', 'members/m01/index.html'];
for (const p of pages) must(existsSync(join(DIST, p)), `缺关键页面：dist/${p}`);

// 2. 已移除的冗余页面不应再产出
for (const gone of ['library', 'tools', 'resources', 'stats', 'about']) {
  must(!existsSync(join(DIST, gone)), `不应再产出页面：dist/${gone}`);
}

// 3. 首页包含核心模块与定位
const home = read('index.html');
for (const label of ['AI 创客协会', '云塘校区', '活动与成果', '成员能力', '提交我的记录', '活动记录', '科创港']) {
  must(home.includes(label), `首页缺少关键内容：${label}`);
}
must(home.includes('示例数据'), '首页缺少示例数据提示');
must(home.includes('/photos/first-meeting-group.jpg'), '首页缺少第一次会议合影');
must(home.includes('技术部'), '首页缺少部门信息');

// 4. 成果页 / 成员页 / 提交页的关键内容
const ach = read('achievements/index.html');
must(ach.includes('成果条目'), '成果页缺少统计条');
must(ach.includes('全部类型'), '成果页缺少类型筛选');

const members = read('members/index.html');
must(members.includes('能力总览'), '成员页缺少能力总览');
must(members.includes('高频能力标签'), '成员页缺少能力标签');
must(members.includes('五个部门'), '成员页缺少部门介绍');
must(members.includes('协会怎么分工'), '成员页缺少部门分工');

const contribute = read('contribute/index.html');
must(contribute.includes('提交审核'), '提交页缺少提交按钮');
must(contribute.includes('公开授权'), '提交页缺少授权确认');

// 4.5 照片文件存在
for (const photo of ['first-meeting-group.jpg', 'president-lecture.jpg', 'member-sharing.jpg', 'innovation-port-visit.jpg', 'innovation-port-aerial.jpg', 'lounge.jpg']) {
  must(existsSync(join(DIST, 'photos', photo)), `缺少照片：dist/photos/${photo}`);
}

// 5. noindex 与 robots
must(home.includes('noindex'), '首页缺少 noindex');
must(existsSync(join(DIST, 'robots.txt')), '缺少 robots.txt');

if (errors.length) {
  console.error('✗ 烟雾检查失败：');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log(`✓ 烟雾检查通过（${pages.length} 个关键页面、核心模块、noindex、冗余页面已移除）`);
