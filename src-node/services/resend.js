import { config } from "../config.js";

export function canSendWithResend() {
  return Boolean(config.resend.apiKey && config.resend.fromEmail);
}

export async function sendResendMail(message) {
  if (!canSendWithResend()) {
    throw new Error("Resend is not fully configured.");
  }

  const attachments = Array.isArray(message.attachments)
    ? message.attachments.map((attachment) => ({
        filename: attachment.filename,
        content: Buffer.isBuffer(attachment.content)
          ? attachment.content.toString("base64")
          : attachment.content,
        content_type: attachment.contentType
      }))
    : undefined;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.resend.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: `${config.resend.fromName} <${config.resend.fromEmail}>`,
      to: Array.isArray(message.to) ? message.to : [message.to],
      reply_to: config.resend.replyTo || undefined,
      subject: message.subject,
      text: message.text,
      html: message.html,
      attachments,
      headers: message.headers || undefined
    })
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.message || result.error || `Resend send failed with status ${response.status}`);
  }

  return {
    messageId: result.id,
    provider: "resend",
    raw: result
  };
}
