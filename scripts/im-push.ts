/**
 * IM 群机器人推送（issue #10 引入，issue #14 抽成可复用模块）。
 *
 * admin-server（发布通知）和 daily-brief（每日简报）共用同一通道：
 *   - FEISHU_WEBHOOK + FEISHU_SECRET：飞书自定义机器人，interactive 卡片，带签名
 *   - WECOM_WEBHOOK：企业微信群机器人，markdown 消息
 *   - 都没配：dry-run，把本应发送的内容打到日志，不报错（调用方据此返回 sent=false）
 *
 * 环境变量在调用时读取（而非模块加载时），两个入口进程共用同一套取值逻辑。
 */
import { createHmac } from 'node:crypto';
import { site } from '../src/data/site';

/** 站点对外地址，单一来源在 src/data/site.ts 的 site.url */
export const SITE_BASE = site.url;

export type ImChannel = 'feishu' | 'wecom' | null;

export function imChannel(): ImChannel {
  if (process.env.FEISHU_WEBHOOK) return 'feishu';
  if (process.env.WECOM_WEBHOOK) return 'wecom';
  return null;
}

/** 飞书官方签名规则：把 timestamp+"\n"+secret 当作 HmacSHA256 的 key，内容为空串，结果 base64 */
export function feishuSign(timestamp: number, secret: string): string {
  return createHmac('sha256', `${timestamp}\n${secret}`).update('').digest('base64');
}

/** 通道无关的卡片：header 一行标题，body 为 lark_md/markdown 共用的正文，buttons 可选 */
export interface ImCard {
  header: string;
  body: string;
  buttons?: { text: string; url: string }[];
}

export interface ImSendResult {
  channel: ImChannel;
  /** true = 已发出；false = dry-run 或推送失败（失败只记日志，不抛出） */
  sent: boolean;
}

/** 推送一条卡片。未配置通道时 dry-run 打印；推送失败只记日志不抛出（与 #10 行为一致）。 */
export async function sendIm(card: ImCard, tag = 'im-push', dryRunNote = ''): Promise<ImSendResult> {
  const channel = imChannel();

  if (!channel) {
    const note = dryRunNote ? ` ${dryRunNote}` : '';
    console.log(`[${tag}] dry-run（未配置 FEISHU_WEBHOOK/WECOM_WEBHOOK）${note}本应发送：\n${card.header}\n${card.body}`);
    return { channel: null, sent: false };
  }

  try {
    if (channel === 'feishu') {
      const timestamp = Math.floor(Date.now() / 1000);
      const r = await fetch(process.env.FEISHU_WEBHOOK as string, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timestamp: String(timestamp),
          sign: feishuSign(timestamp, process.env.FEISHU_SECRET || ''),
          msg_type: 'interactive',
          card: {
            header: { title: { tag: 'plain_text', content: card.header }, template: 'blue' },
            elements: [
              { tag: 'div', text: { tag: 'lark_md', content: card.body } },
              ...(card.buttons?.length
                ? [
                    {
                      tag: 'action',
                      actions: card.buttons.map((b) => ({
                        tag: 'button',
                        text: { tag: 'plain_text', content: b.text },
                        url: b.url,
                        type: 'primary',
                      })),
                    },
                  ]
                : []),
            ],
          },
        }),
      });
      if (!r.ok) throw new Error(`webhook HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
    } else {
      const buttons = card.buttons?.map((b) => `[${b.text}](${b.url})`).join(' ') ?? '';
      const r = await fetch(process.env.WECOM_WEBHOOK as string, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          msgtype: 'markdown',
          markdown: { content: `**${card.header}**\n${card.body}${buttons ? `\n${buttons}` : ''}` },
        }),
      });
      if (!r.ok) throw new Error(`webhook HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
    }
    console.log(`[${tag}] 已推送到 ${channel === 'feishu' ? '飞书' : '企业微信'}：${card.header}`);
    return { channel, sent: true };
  } catch (e: any) {
    console.error(`[${tag}] 推送失败（${channel}）`, e?.message || e);
    return { channel, sent: false };
  }
}
