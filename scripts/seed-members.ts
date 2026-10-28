/**
 * 把当前占位成员导出为 content/members.json（只用于初始化/重置演示数据）。
 * 平时成员数据以 content/members.json 为准：管理端「同步成员档案」会用它覆盖为真实账号数据。
 * 用法：pnpm seed:members
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { members } from '../src/data/members';

const out = join(process.cwd(), 'content/members.json');
writeFileSync(out, JSON.stringify(members, null, 2) + '\n', 'utf8');
console.log(`已导出 ${members.length} 位成员到 content/members.json`);
