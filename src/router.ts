import fs from 'fs';
import path from 'path';

import { Channel, NewMessage } from './types.js';
import { formatLocalTime } from './timezone.js';
import { logger } from './logger.js';

export function escapeXml(s: string): string {
  if (!s) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatMessages(
  messages: NewMessage[],
  timezone: string,
): string {
  const lines = messages.map((m) => {
    const displayTime = formatLocalTime(m.timestamp, timezone);
    return `<message sender="${escapeXml(m.sender_name)}" time="${escapeXml(displayTime)}">${escapeXml(m.content)}</message>`;
  });

  const header = `<context timezone="${escapeXml(timezone)}" />\n`;

  return `${header}<messages>\n${lines.join('\n')}\n</messages>`;
}

export function stripInternalTags(text: string): string {
  return text.replace(/<internal>[\s\S]*?<\/internal>/g, '').trim();
}

export function formatOutbound(rawText: string): string {
  const text = stripInternalTags(rawText);
  if (!text) return '';
  return text;
}

export function routeOutbound(
  channels: Channel[],
  jid: string,
  text: string,
): Promise<void> {
  const channel = channels.find((c) => c.ownsJid(jid) && c.isConnected());
  if (!channel) throw new Error(`No channel for JID: ${jid}`);
  return channel.sendMessage(jid, text);
}

export function findChannel(
  channels: Channel[],
  jid: string,
): Channel | undefined {
  return channels.find((c) => c.ownsJid(jid));
}

/**
 * Route outbound text, detecting [Image: attachments/...] references.
 * Text segments are sent as messages; image references are sent via sendImage.
 * Falls back to plain text if the channel doesn't support sendImage.
 */
export async function routeOutboundWithImages(
  channel: Channel,
  jid: string,
  text: string,
  groupDir: string,
): Promise<void> {
  if (!channel.sendImage) {
    // Channel doesn't support images — send as plain text
    await channel.sendMessage(jid, text);
    return;
  }

  // Split on [Image: attachments/...] patterns
  const imagePattern = /\[Image:\s*(attachments\/[^\]]+)\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = imagePattern.exec(text)) !== null) {
    // Send any text before this image reference
    const before = text.slice(lastIndex, match.index).trim();
    if (before) {
      await channel.sendMessage(jid, before);
    }

    // Send the image
    const relativePath = match[1];
    const imagePath = path.join(groupDir, relativePath);
    if (fs.existsSync(imagePath)) {
      await channel.sendImage(jid, imagePath);
    } else {
      logger.warn({ imagePath }, 'Image file not found, skipping');
    }

    lastIndex = match.index + match[0].length;
  }

  // Send any remaining text after the last image reference
  const remaining = text.slice(lastIndex).trim();
  if (remaining) {
    await channel.sendMessage(jid, remaining);
  }
}
