/** Build a separate public, seed-only preview. Never reads the live database. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stage = path.join(app, `.next-readonly-preview-${Date.now()}`);
await fs.mkdir(stage, { recursive: false });
const write = async (relative, body) => {
  const target = path.join(stage, relative);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, body);
};
const modules = { projects: 'projects', library: 'items', members: 'members', competitions: 'competitions', activities: 'activities', achievements: 'awards', footprints: 'contributions' };
const feeds = ['meta', 'items', 'members', 'departments', 'footprints'];
async function copySource(relative = 'src') {
  for (const entry of await fs.readdir(path.join(app, relative), { withFileTypes: true })) {
    const rel = `${relative}/${entry.name}`;
    if (/^src\/(middleware|proxy)\./.test(rel) || /^src\/app\/(api|publish|admin|login)(\/|$)/.test(rel) || /\/new(\/|$)|\/edit(\/|$)/.test(rel)) continue;
    if (entry.isDirectory()) { await copySource(rel); continue; }
    if (!/\.(tsx?|css)$/.test(rel)) { await fs.mkdir(path.dirname(path.join(stage, rel)), { recursive: true }); await fs.copyFile(path.join(app, rel), path.join(stage, rel)); continue; }
    let code = await fs.readFile(path.join(app, rel), 'utf8');
    // This Next version prefetches server segments absent from static exports.
    // Use document navigation for the read-only build; keep all page interactions.
    code = code.replaceAll('from "next/link"', 'from "@/components/preview-link"');
    if (rel === 'src/components/command-menu.tsx') code = code.replace('router.push(href)', 'window.location.assign(href === "/" ? href : `${href}/`)');
    code = code.replace(/import \{ connection \} from "next\/server";\r?\n/g, '').replace(/await connection\(\);/g, '').replace(/export const instant = false;/g, '');
    for (const feed of feeds) code = code.replaceAll(`"/api/${feed}"`, `"/preview-data/${feed}.json"`);
    if (rel === 'src/components/app-shell.tsx') {
      code = code.replace('数据来源待核验', '只读预览 · 当前内容含示例数据，待协会核验');
      code = code.replace('meta.dataSource === "seed" ? "当前内容含示例数据，待协会核验" : "内容由协会录入，待核验"', '"只读预览 · 当前内容含示例数据，待协会核验"');
    }
    const detail = rel.match(/^src\/app\/([^/]+)\/\[id\]\/page.tsx$/);
    if (detail) {
      const module = detail[1];
      const filter = module === 'library' ? " WHERE status IN ('已发布', '已收录', '报名中', '已归档')" : module === 'footprints' ? " WHERE status = 'approved'" : '';
      code += `\nexport const dynamicParams = false;\nexport async function generateStaticParams() {\n  const { getDb } = await import('@/lib/db');\n  return (getDb().prepare(${JSON.stringify(`SELECT id FROM ${modules[module]}${filter}`)}).all() as { id: string }[]).map(row => ({ id: row.id }));\n}\n`;
    }
    await write(rel, code);
  }
}
await copySource();
await write('src/components/preview-link.tsx', `import type { AnchorHTMLAttributes } from 'react';\ntype Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { href: string; prefetch?: boolean; replace?: boolean; scroll?: boolean };\nexport default function PreviewLink({ href, prefetch: _prefetch, replace: _replace, scroll: _scroll, ...props }: Props) { const local = href.startsWith('/') && !href.includes('.') && !href.includes('#') && !href.includes('?'); return <a {...props} href={local && !href.endsWith('/') ? href + '/' : href} />; }\n`);
await fs.cp(path.join(app, 'public'), path.join(stage, 'public'), { recursive: true, filter: source => !source.endsWith('.md') });
for (const name of ['package.json', 'tsconfig.json']) await fs.copyFile(path.join(app, name), path.join(stage, name));
await write('next.config.ts', `import type { NextConfig } from 'next';\nconst config: NextConfig = { output: 'export', trailingSlash: true, images: { unoptimized: true }, experimental: { cpus: 1 }, turbopack: { root: ${JSON.stringify(app)}, rules: { '*.css': { loaders: ['@tailwindcss/turbopack'], as: '*.css' } } } };\nexport default config;\n`);
// No login form, credentials, mutations or admin routes in the deployed preview.
await write('src/components/admin-auth-provider.tsx', `"use client";\nimport type { ReactNode } from 'react';\nexport function AdminAuthProvider({ children }: { children: ReactNode }) { return children; }\nexport function useAdminAuth() { return { requireAdmin: async (_afterLogin?: () => void) => false, reauthenticate: () => { window.location.assign('/publish/'); } }; }\n`);
const previewPage = `import Link from 'next/link';\nimport { PageHeader } from '@/components/page-header';\nexport default function PreviewNotice() { return <div className="official-page"><PageHeader title="内容维护暂未开放" description="当前为官网只读预览。数据库与图片持久存储接通后，管理员可在这里发布和修改内容。" /><Link href="/" className="inline-flex min-h-12 items-center text-base text-primary">返回首页</Link></div>; }\n`;
for (const route of ['publish', 'login', 'admin']) await write(`src/app/${route}/page.tsx`, previewPage);
for (const feed of ['meta', 'members', 'departments']) {
  let code = await fs.readFile(path.join(app, `src/app/api/${feed}/route.ts`), 'utf8');
  code = code.replace('await ensureDynamic();', '');
  await write(`src/app/preview-data/${feed}.json/route.ts`, `export const dynamic = 'force-static';\n${code}`);
}
await write('src/app/preview-data/items.json/route.ts', `import { listPublicItems } from '@/lib/public-records';\nexport const dynamic = 'force-static';\nexport function GET() { return Response.json(listPublicItems()); }\n`);
await write('src/app/preview-data/footprints.json/route.ts', `import { listPublicFootprints } from '@/lib/footprint-service';\nexport const dynamic = 'force-static';\nexport function GET() { return Response.json(listPublicFootprints()); }\n`);
await write('public/robots.txt', 'User-agent: *\nDisallow: /\n');
const env = { ...process.env, AI_ASSOCIATION_DATA_DIR: path.join(stage, 'seed-data'), NEXT_TELEMETRY_DISABLED: '1' };
delete env.AI_ASSOCIATION_BUILD_DIR;
for (const key of ['ADMIN_USER', 'ADMIN_PASSWORD', 'ADMIN_SESSION_SECRET']) delete env[key];
console.log(`PREVIEW_STAGE=${stage}`);
const result = spawnSync(process.execPath, [path.join(app, 'node_modules/next/dist/bin/next'), 'build'], { cwd: stage, env, stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status || 1);
const upload = path.join(stage, 'upload');
await fs.mkdir(upload);
await fs.cp(path.join(stage, 'out'), path.join(upload, 'dist'), { recursive: true });
await fs.writeFile(path.join(upload, 'package.json'), JSON.stringify({ name: 'csust-maker-hub-readonly-preview', private: true, version: '0.1.0' }, null, 2));
console.log(`PREVIEW_UPLOAD=${upload}`);
