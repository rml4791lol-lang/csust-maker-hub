import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfm } from "micromark-extension-gfm";
import type { DatabaseSync } from "node:sqlite";

export class ArticleMediaError extends Error {}
export const MEDIA_ID_PATTERN = /^[a-f0-9]{32}$/;
const mediaUrl = /^\/api\/media\/([a-f0-9]{32})$/;

/** Parse actual Markdown nodes: image-looking text in code is never a binding. */
export function articleMediaIds(body: string, format: string): string[] {
  if (format === "plain") return [];
  if (format !== "markdown") throw new ArticleMediaError("正文格式无效");
  // Match react-markdown + remark-gfm in both the editor preview and reader.
  // CommonMark alone misreads footnotes as link definitions and misses images.
  const tree = fromMarkdown(body, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] });
  const definitions = new Map<string, string>();
  type Node = { type: string; url?: string; identifier?: string; children?: Node[] };
  function visit(node: Node, fn: (node: Node) => void) {
    fn(node);
    node.children?.forEach(child => visit(child, fn));
  }
  visit(tree, node => {
    if (node.type === "definition" && node.identifier && !definitions.has(node.identifier)) {
      definitions.set(node.identifier, node.url ?? "");
    }
  });
  const ids = new Set<string>();
  visit(tree, node => {
    if (node.type === "html") throw new ArticleMediaError("正文不支持 HTML，请使用格式工具栏");
    if (node.type === "image" || node.type === "imageReference") {
      const url = node.type === "image" ? node.url : definitions.get(node.identifier ?? "");
      const id = url?.match(mediaUrl)?.[1];
      if (!id) throw new ArticleMediaError("图片请通过编辑器上传，不支持外部图片地址");
      ids.add(id);
    }
    if (node.type === "link" || node.type === "linkReference") {
      const value = node.type === "link" ? node.url : definitions.get(node.identifier ?? "");
      try {
        const url = new URL(value ?? "");
        if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error();
      } catch { throw new ArticleMediaError("正文链接仅支持 HTTP 或 HTTPS 地址"); }
    }
  });
  if (ids.size > 50) throw new ArticleMediaError("每篇文章最多使用 50 张图片");
  return [...ids];
}

/** Called inside the article transaction; never trust client-supplied media IDs. */
export function bindArticleMedia(db: DatabaseSync, itemId: string, body: string, format: string) {
  const ids = articleMediaIds(body, format);
  const exists = db.prepare("SELECT id FROM media_assets WHERE id = ?");
  for (const id of ids) {
    if (!exists.get(id)) throw new ArticleMediaError("正文包含不存在的图片，请重新上传");
  }
  db.prepare("DELETE FROM item_media WHERE item_id = ?").run(itemId);
  const insert = db.prepare("INSERT INTO item_media (item_id, media_id) VALUES (?, ?)");
  ids.forEach(id => insert.run(itemId, id));
}
