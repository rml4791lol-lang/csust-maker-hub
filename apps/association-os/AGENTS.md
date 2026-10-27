<!-- BEGIN:nextjs-agent-rules -->

## Next.js preview scope

This directory is an independent Next.js application, not the root Astro site.
Read README.md and docs/HANDOFF.md; install and run all commands here. Preserve
the existing main site and its operational data. The root Astro paths, JSON data
model and static rsync deployment instructions do not apply to this app.
Current user preferences override older visual rules: retain Hero motion,
left-offset geometry and lighting; no decorative tiny labels, minimum 14px for
necessary secondary text and 16px body text.

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
