import { config } from "../config.js";
import { logInfo, logWarn } from "../lib/logger.js";
import { canSendEmail, sendMail } from "../services/smtp.js";

export async function runSendTestEmailJob() {
  if (!canSendEmail()) {
    logWarn("SMTP not configured; skipping test email send");
    return;
  }

  const targetEmail = config.smtp.replyTo || config.smtp.fromEmail;
  if (!targetEmail) {
    throw new Error("No target email found for test send. Set SMTP_REPLY_TO or SMTP_FROM_EMAIL.");
  }

  const subject = "Anutech Labs SMTP Test";
  const text = [
    "Hi,",
    "",
    "This is a controlled SMTP test from the Anutech Labs client acquisition engine.",
    "",
    "If you received this, SMTP authentication and the basic send flow are working.",
    "",
    "Warm regards,",
    config.defaultSignatureName,
    config.defaultSignatureCompany
  ].join("\n");

  const html = `
    <html>
      <body style="font-family: Arial, Helvetica, sans-serif; color: #1f2937;">
        <p>Hi,</p>
        <p>This is a controlled SMTP test from the <strong>Anutech Labs</strong> client acquisition engine.</p>
        <p>If you received this, SMTP authentication and the basic send flow are working.</p>
        <p>Warm regards,<br>${config.defaultSignatureName}<br><strong>${config.defaultSignatureCompany}</strong></p>
      </body>
    </html>
  `;

  await sendMail({
    to: targetEmail,
    subject,
    text,
    html
  });

  logInfo("Sent SMTP test email", { to: targetEmail, subject });
}
