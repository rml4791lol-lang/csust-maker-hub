import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./markdown-content.css";

const MEDIA_URL = /^\/api\/media\/[a-f0-9]{32}$/;

/** Keep the preview and public reader on the same, deliberately small format. */
export function MarkdownContent({ body, format }: { body: string; format?: string | null }) {
  if (format !== "markdown") return <div className="article-body article-plain">{body}</div>;

  return <div className="article-body"><ReactMarkdown
    remarkPlugins={[remarkGfm]}
    skipHtml
    urlTransform={(url, key) => {
      if (key === "src") return MEDIA_URL.test(url) ? url : "";
      try {
        const parsed = new URL(url);
        return ["http:", "https:"].includes(parsed.protocol) && !parsed.username && !parsed.password ? url : "";
      } catch { return ""; }
    }}
    components={{
      a: ({ href, children }) => href ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> : <span>{children}</span>,
      img: ({ src, alt, title }) => typeof src === "string" && MEDIA_URL.test(src) ? <span className="article-media">
        {/* Native images keep draft media out of an image optimizer's shared cache. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt ?? ""} title={title} loading="lazy" decoding="async" />
        {title && <span className="article-caption">{title}</span>}
      </span> : <span className="article-image-unavailable">图片地址无效，请在编辑器中重新上传。</span>,
      table: ({ children }) => <div className="article-table"><table>{children}</table></div>,
    }}
  >{body}</ReactMarkdown></div>;
}
