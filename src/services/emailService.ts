import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../config/index.js';
import { logger } from '../logger/index.js';
import type { ContactFormData } from '../utils/sanitizer.js';

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (transporter) return transporter;

  if (config.smtp.user && config.smtp.pass) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
    });
  }

  return transporter;
}

export async function sendContactNotification(data: ContactFormData): Promise<boolean> {
  const mailer = getTransporter();

  const emailSubject = `[Website Inquiry] ${data.subject}`;
  const emailBody = `
New Contact Inquiry Received:
------------------------------
Name:    ${data.name}
Email:   ${data.email}
Subject: ${data.subject}

Message:
${data.message}
Sent from: Apex Digital Studio Website
`;

  if (!mailer) {
    logger.info(
      {
        recipient: config.smtp.notificationEmail,
        subject: emailSubject,
        sender: data.email,
      },
      'SMTP not configured: Simulated email delivery logged safely',
    );
    return true;
  }

  try {
    const info = await mailer.sendMail({
      from: `"Website Inquiries" <${config.smtp.user}>`,
      to: config.smtp.notificationEmail,
      replyTo: data.email,
      subject: emailSubject,
      text: emailBody,
    });

    logger.info({ messageId: info.messageId }, 'Inquiry email dispatched successfully');
    return true;
  } catch (err) {
    logger.error({ err }, 'Failed to send notification email via SMTP');
    return false;
  }
}
