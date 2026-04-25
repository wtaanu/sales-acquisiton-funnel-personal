import nodemailer from "nodemailer";
import { config } from "../config.js";

const BLOCKED_SMTP_HOSTS = new Set(["relay.mailchannels.net"]);

function assertAllowedSmtpHost() {
  const host = String(config.smtp.host || "").trim().toLowerCase();
  if (BLOCKED_SMTP_HOSTS.has(host)) {
    throw new Error(`Blocked SMTP host configured: ${host}`);
  }
}

export function canSendEmail() {
  const host = String(config.smtp.host || "").trim().toLowerCase();
  return Boolean(
    config.smtp.host &&
      config.smtp.user &&
      config.smtp.pass &&
      config.smtp.fromEmail &&
      !BLOCKED_SMTP_HOSTS.has(host)
  );
}

export function createTransport() {
  if (!canSendEmail()) {
    throw new Error("SMTP is not fully configured.");
  }

  assertAllowedSmtpHost();

  return nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass
    },
    tls: {
      rejectUnauthorized: config.smtp.tlsRejectUnauthorized
    }
  });
}

export async function sendMail(message) {
  const readReceiptTo =
    config.smtp.readReceiptTo || config.smtp.replyTo || config.smtp.fromEmail || undefined;
  const receiptHeaders =
    config.smtp.enableReadReceipts && readReceiptTo
      ? {
          "Disposition-Notification-To": readReceiptTo,
          "Return-Receipt-To": readReceiptTo,
          "X-Confirm-Reading-To": readReceiptTo
        }
      : {};

  const transporter = createTransport();
  return transporter.sendMail({
    from: `"${config.smtp.fromName}" <${config.smtp.fromEmail}>`,
    replyTo: config.smtp.replyTo || undefined,
    headers: {
      ...receiptHeaders,
      ...(message.headers || {})
    },
    ...message
  });
}
