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

const MIME_MAP: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx':
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.csv': 'text/csv',
  '.txt': 'text/plain',
  '.zip': 'application/zip',
  '.gz': 'application/gzip',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.html': 'text/html',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
};

function getMimetype(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_MAP[ext] || 'application/octet-stream';
}

/**
 * Route outbound text, detecting [Image: attachments/...] and [File: attachments/...] references.
 * Text segments are sent as messages; media references are sent via sendImage/sendDocument.
 * Falls back to plain text if the channel doesn't support the media type.
 */
export async function routeOutboundWithImages(
  channel: Channel,
  jid: string,
  text: string,
  groupDir: string,
): Promise<void> {
  if (!channel.sendImage && !channel.sendDocument) {
    await channel.sendMessage(jid, text);
    return;
  }

  // Match both [Image: attachments/...] and [File: attachments/...] in order
  const mediaPattern = /\[(Image|File):\s*(attachments\/[^\]]+)\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = mediaPattern.exec(text)) !== null) {
    const before = text.slice(lastIndex, match.index).trim();
    if (before) {
      await channel.sendMessage(jid, before);
    }

    const type = match[1]; // "Image" or "File"
    const relativePath = match[2];
    const fullPath = path.join(groupDir, relativePath);

    if (fs.existsSync(fullPath)) {
      if (type === 'Image' && channel.sendImage) {
        await channel.sendImage(jid, fullPath);
      } else if (type === 'File' && channel.sendDocument) {
        const mimetype = getMimetype(fullPath);
        const fileName = path.basename(fullPath);
        await channel.sendDocument(jid, fullPath, mimetype, fileName);
      } else {
        // Channel doesn't support this type — mention it in text
        await channel.sendMessage(
          jid,
          `[Unsupported: ${path.basename(fullPath)}]`,
        );
      }
    } else {
      logger.warn({ fullPath, type }, 'Media file not found, skipping');
    }

    lastIndex = match.index + match[0].length;
  }

  const remaining = text.slice(lastIndex).trim();
  if (remaining) {
    await channel.sendMessage(jid, remaining);
  }
}
