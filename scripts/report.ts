import { items, typeMeta } from '../src/data/items';
import { isExpired } from '../src/data/validate';

const byType: Record<string, number> = {};
for (const i of items) byType[i.type] = (byType[i.type] || 0) + 1;

console.log('总计:', items.length, '条');
console.log('--- 按类型 ---');
for (const [t, n] of Object.entries(byType)) console.log(`${(typeMeta as any)[t]?.label ?? t}: ${n}`);
const fromAi = items.filter((i) => i.extra?.sourceName === 'ai.an520.xin');
console.log('--- 来源 ---');
console.log('收录自 ai.an520.xin:', fromAi.length, '条');
console.log('示例/历史:', items.length - fromAi.length, '条');
const expired = items.filter((i) => isExpired(i));
const withExpiry = items.filter((i) => i.expiresAt);
console.log('--- 过期 ---');
console.log('已过期:', expired.length, '条 | 有到期时间:', withExpiry.length, '条 →', withExpiry.map((i) => `${i.id}:${i.expiresAt}`).join(', '));
console.log('--- 明细 ---');
for (const i of items) console.log(`[${i.type}] ${i.id} ${i.title}`);
