import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { config } from "../config.js";

function cleanupReplyText(text) {
  const normalized = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");

  const markers = [
    /^On .*wrote:$/im,
    /^From: .*$/im,
    /^Sent from my .*$/im,
    /^---+\s*Original Message\s*---+$/im
  ];

  let cutoff = normalized.length;
  for (const marker of markers) {
    const match = normalized.match(marker);
    if (match?.index !== undefined) {
      cutoff = Math.min(cutoff, match.index);
    }
  }

  return normalized.slice(0, cutoff).trim();
}

function envelopeAddress(message) {
  return message.from?.value?.[0]?.address || "";
}

function envelopeName(message) {
  return message.from?.value?.[0]?.name || "";
}

export function canReadInbox() {
  return Boolean(config.imap.host && config.imap.user && config.imap.pass);
}

export async function fetchRecentReplies() {
  if (!canReadInbox()) {
    throw new Error("IMAP is not fully configured.");
  }

  const client = new ImapFlow({
    host: config.imap.host,
    port: config.imap.port,
    secure: config.imap.secure,
    auth: {
      user: config.imap.user,
      pass: config.imap.pass
    },
    tls: {
      rejectUnauthorized: config.imap.tlsRejectUnauthorized
    }
  });

  await client.connect();

  try {
    const lock = await client.getMailboxLock(config.imap.inbox);
    try {
      const since = new Date(Date.now() - config.imap.lookbackDays * 24 * 60 * 60 * 1000);
      const messages = [];

      for await (const message of client.fetch({ since }, { uid: true, envelope: true, source: true, internalDate: true })) {
        const parsed = await simpleParser(message.source);
        const fromEmail = envelopeAddress(parsed) || envelopeAddress(message.envelope) || parsed.from?.value?.[0]?.address || "";
        const subject = parsed.subject || message.envelope?.subject || "";
        const replyText = cleanupReplyText(parsed.text || parsed.html || "");

        if (!fromEmail || !replyText) {
          continue;
        }

        messages.push({
          uid: String(message.uid || ""),
          message_id: parsed.messageId || "",
          from_email: fromEmail.toLowerCase(),
          from_name: envelopeName(parsed) || envelopeName(message.envelope) || "",
          subject,
          received_at: message.internalDate?.toISOString?.() || new Date().toISOString(),
          in_reply_to: parsed.inReplyTo || "",
          references: Array.isArray(parsed.references) ? parsed.references.join(" ") : (parsed.references || ""),
          reply_text: replyText
        });
      }

      return messages;
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}
