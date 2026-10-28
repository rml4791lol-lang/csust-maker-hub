// Run only for local account setup: node --experimental-strip-types scripts/setup-admin.ts
import { createServer, type IncomingMessage } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { createLocalAccount, localAccountExists, usesEnvironmentAccount, validateNewAccount } from "../src/lib/admin-account.ts";

// Alternate port is used only by isolated tests; the product entry uses 3190.
const port = Number(process.env.AI_ASSOCIATION_SETUP_PORT || "3190");
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid local setup port");
const authority = `127.0.0.1:${port}`;
const origin = `http://${authority}`;
const token = randomBytes(32).toString("hex");
const nonce = randomBytes(18).toString("base64");
const returnUrl = "http://127.0.0.1:3100/";
let creating = false;

function localRequest(request: IncomingMessage) {
  return ["127.0.0.1", "::ffff:127.0.0.1"].includes(request.socket.remoteAddress || "")
    && request.headers.host === authority
    && !Object.keys(request.headers).some((name) => name === "forwarded" || name.startsWith("x-forwarded-") || name === "x-real-ip" || name === "via")
    && request.headers["sec-fetch-site"] !== "cross-site";
}
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>创建管理员账号</title>
<style nonce="${nonce}">*{box-sizing:border-box}body{margin:0;background:#0a101b;color:#e8eef8;font:16px/1.7 system-ui,sans-serif;display:grid;min-height:100dvh;place-items:center}main{width:min(460px,100%);padding:32px}h1{font-size:28px;line-height:1.3;margin:0 0 16px}p{color:#aebed3}label{display:block;margin-top:20px}input{width:100%;height:48px;margin-top:8px;padding:0 14px;border:1px solid #3a4a62;border-radius:6px;background:#121d2d;color:inherit;font:inherit}button,a{font:inherit}button{margin-top:28px;width:100%;min-height:48px;background:#dce9fb;border:0;border-radius:6px;color:#142034;font-weight:600;cursor:pointer}button:disabled{opacity:.6;cursor:wait}a{color:#b6d7ff}#error{color:#ffb4b4;white-space:pre-wrap}</style>
<main><h1>创建管理员账号</h1><p>设置一个账号，用来录入和修改协会内容。创建完成后回到预览登录。</p><form id="setup"><label>账号<input name="username" autocomplete="username" required minlength="3" maxlength="64" pattern="[A-Za-z0-9_.@\\-]+" placeholder="3–64 位字母、数字或 _ . @ -"></label><label>密码<input name="password" type="password" autocomplete="new-password" required minlength="12" maxlength="256" placeholder="至少 12 个字符"></label><label>确认密码<input name="confirmation" type="password" autocomplete="new-password" required minlength="12" maxlength="256"></label><p id="error" role="alert"></p><button>创建账号</button></form><p id="result"></p><a href="${returnUrl}">返回预览</a></main>
<script nonce="${nonce}">document.querySelector('#setup').addEventListener('submit',async(event)=>{event.preventDefault();const form=event.currentTarget;const values=new FormData(form);const error=document.querySelector('#error');const button=form.querySelector('button');error.textContent='';if(values.get('password')!==values.get('confirmation')){error.textContent='两次输入的密码不一致';return}button.disabled=true;try{const response=await fetch('/account',{method:'POST',headers:{'Content-Type':'application/json','X-Setup-Token':'${token}'},body:JSON.stringify({username:values.get('username'),password:values.get('password')})});const result=await response.json();if(!response.ok)throw new Error(result.error||'创建失败');form.reset();form.hidden=true;document.querySelector('#result').textContent='账号已创建。请返回预览，点击“编辑内容”并使用刚才的账号密码登录。';}catch(cause){error.textContent=cause.message;button.disabled=false;}});</script></html>`;

if (process.env.AI_ASSOCIATION_ALLOW_LOCAL_SETUP !== "1") throw new Error("Set AI_ASSOCIATION_ALLOW_LOCAL_SETUP=1 to explicitly enable local setup");
if (usesEnvironmentAccount() || localAccountExists()) throw new Error("An administrator is already configured. Local setup is closed.");

const server = createServer(async (request, response) => {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Content-Security-Policy", `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`);
  const json = (status: number, value: object) => { response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" }); response.end(JSON.stringify(value)); };
  if (!localRequest(request)) { json(403, { error: "仅支持从本机直接访问" }); return; }
  if (usesEnvironmentAccount() || localAccountExists()) { json(409, { error: "管理员已配置，初始化已关闭" }); return; }
  if (request.method === "GET" && request.url === "/") { response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); response.end(html); return; }
  if (request.method !== "POST" || request.url !== "/account") { json(404, { error: "Not found" }); return; }
  const supplied = request.headers["x-setup-token"];
  if (request.headers.origin !== origin || request.headers["content-type"] !== "application/json" || typeof supplied !== "string" || supplied.length !== token.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(token))) { json(403, { error: "请从本机初始化页面重试" }); return; }
  if (creating) { json(409, { error: "账号正在创建，请勿重复提交" }); return; }
  creating = true;
  try {
    let size = 0;
    const chunks: Buffer[] = [];
    for await (const chunk of request) { size += chunk.length; if (size > 4096) { json(413, { error: "提交内容过大" }); return; } chunks.push(chunk); }
    let body: { username?: unknown; password?: unknown };
    try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { json(400, { error: "提交格式错误" }); return; }
    if (!body || typeof body !== "object" || Array.isArray(body)) { json(400, { error: "提交格式错误" }); return; }
    const invalid = validateNewAccount(body.username, body.password);
    if (invalid) { json(400, { error: invalid }); return; }
    await createLocalAccount(body.username as string, body.password as string);
    json(201, { ok: true });
    server.close();
    server.closeIdleConnections();
    console.log("Administrator created. Local setup has closed.");
  } catch {
    json(localAccountExists() ? 409 : 500, { error: localAccountExists() ? "管理员已配置，不能重复创建" : "创建失败，请检查本机数据目录权限" });
  } finally { creating = false; }
});
server.requestTimeout = 15_000;
server.headersTimeout = 10_000;
server.listen(port, "127.0.0.1", () => console.log(`Local administrator setup: ${origin}/`));
