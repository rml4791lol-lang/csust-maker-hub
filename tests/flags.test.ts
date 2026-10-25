import { describe, it, expect, vi } from 'vitest';

// flagEnabled / flag 文件加载逻辑（模拟 content/flags.json 的读取）
vi.mock('node:fs', () => ({
  readFileSync: (p: URL | string) => {
    if (String(p).includes('flags.json')) {
      return JSON.stringify([
        { key: 'home.cta', label: '行动引导', audience: 'all', enabled: false },
        { key: 'tools', label: '工具导航', audience: 'all', enabled: true },
      ]);
    }
    throw new Error('not found');
  },
}));

describe('功能开关', () => {
  it('声明的开关返回配置值', async () => {
    const { flagEnabled } = await import('../src/data/flags');
    expect(flagEnabled('home.cta')).toBe(false);
    expect(flagEnabled('tools')).toBe(true);
  });

  it('未声明的 key 默认启用（新区块不用先登记开关）', async () => {
    const { flagEnabled } = await import('../src/data/flags');
    expect(flagEnabled('home.never.registered')).toBe(true);
  });

  it('开关文件缺失时全部按启用处理', async () => {
    vi.resetModules();
    vi.doMock('node:fs', () => ({
      readFileSync: () => {
        throw new Error('no file');
      },
    }));
    const { flagEnabled } = await import('../src/data/flags');
    expect(flagEnabled('home.cta')).toBe(true);
  });
});

describe('工具目录', () => {
  it('按 kind 分组且空分组不出现', async () => {
    vi.resetModules();
    vi.doMock('node:fs', () => ({
      readFileSync: (p: URL | string) => {
        if (String(p).includes('tools.json')) {
          return JSON.stringify([
            { name: '乙', url: 'https://b.xin', kind: 'tool', desc: '', audience: 'all' },
            { name: '甲', url: 'https://a.xin', kind: 'tool', desc: '', audience: 'all' },
            { name: '后台', url: 'https://a.xin/admin', kind: 'internal', desc: '', audience: 'core' },
          ]);
        }
        if (String(p).includes('flags.json')) return '[]';
        throw new Error('not found');
      },
    }));
    const { groupedTools, kindLabel } = await import('../src/data/tools');
    expect(groupedTools.map((g) => g.kind)).toEqual(['tool', 'internal']);
    expect(groupedTools[0].items.map((t) => t.name)).toEqual(['甲', '乙']); // 组内按名称排序
    expect(groupedTools[0].label).toBe(kindLabel.tool);
  });
});
