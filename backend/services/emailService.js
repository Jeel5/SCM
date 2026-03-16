import nodemailer from 'nodemailer';
import logger from '../utils/logger.js';

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  // Fallback keeps local/dev flows functional without external SMTP.
  if (!host || !user || !pass) {
    return nodemailer.createTransport({ jsonTransport: true });
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

const transport = createTransport();

async function send({ to, subject, html, text }) {
  const from = process.env.SMTP_FROM || 'TwinChain <no-reply@twinchain.local>';
  const info = await transport.sendMail({ from, to, subject, text, html });
  logger.info('Email sent', {
    to,
    subject,
    messageId: info.messageId,
    transport: process.env.SMTP_HOST ? 'smtp' : 'jsonTransport',
  });
  return info;
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function sendEmailChangeVerification({ to, name, verifyUrl }) {
  const safeName = escapeHtml(name || 'there');
  const safeUrl = escapeHtml(verifyUrl);
  return send({
    to,
    subject: 'Confirm your new email address',
    text: `Hi ${name || 'there'},\n\nPlease verify your new email address by opening this link:\n${verifyUrl}\n\nIf you did not request this change, ignore this email.`,
    html: `
      <p>Hi ${safeName},</p>
      <p>Please confirm your new email address by clicking the link below:</p>
      <p><a href="${safeUrl}">${safeUrl}</a></p>
      <p>If you did not request this change, you can ignore this email.</p>
    `,
  });
}

async function sendSimpleNotification({ to, subject, message }) {
  const safeMessage = escapeHtml(message);
  return send({
    to,
    subject,
    text: message,
    html: `<p>${safeMessage}</p>`,
  });
}

export default {
  send,
  sendEmailChangeVerification,
  sendSimpleNotification,
};
