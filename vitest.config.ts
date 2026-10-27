import { configDefaults, defineConfig } from 'vitest/config';

// The Next.js preview has its own Node test runner and dependency installation.
export default defineConfig({
  test: { exclude: [...configDefaults.exclude, 'apps/association-os/**'] },
});
