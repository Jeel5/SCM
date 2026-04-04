import nodemailer from 'nodemailer';
import logger from '../utils/logger.js';

/**
 * Create mail transport using SMTP env config or JSON transport fallback.
 */
function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
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

/**
 * Send a raw email payload and log metadata.
 */
async function send({ to, subject, html, text }) {
  const from = process.env.SMTP_FROM;
  const info = await transport.sendMail({ from, to, subject, text, html });
  logger.info('Email sent', {
    to,
    subject,
    messageId: info.messageId,
    transport: process.env.SMTP_HOST ? 'smtp' : 'jsonTransport',
  });
  return info;
}

/**
 * Escape HTML special characters for safe template interpolation.
 */
function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Send onboarding credentials for newly created users.
 */
async function sendWelcomeCredentialsEmail({ to, name, organizationName, role, temporaryPassword, loginUrl }) {
  const safeName = escapeHtml(name || 'there');
  const safeOrganizationName = escapeHtml(organizationName || 'TwinChain');
  const safeRole = escapeHtml(role || 'user');
  const safeLoginUrl = escapeHtml(loginUrl || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`);

  return send({
    to,
    subject: `Welcome to ${organizationName || 'SCM'}`,
    text: [
      `Hi ${name || 'there'},`,
      '',
      `Welcome to ${organizationName || 'SCM'} as ${role || 'user'}.`,
      `Your temporary password is: ${temporaryPassword}`,
      '',
      `Log in here: ${loginUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`}`,
      'Please change your password after your first login.',
      '',
      'If you did not expect this email, please contact your administrator.',
    ].join('\n'),
    html: `
      <p>Hi ${safeName},</p>
      <p>Welcome to <strong>${safeOrganizationName}</strong> as <strong>${safeRole}</strong>.</p>
      <p>Your temporary password is:</p>
      <p style="font-size:16px;font-weight:700;letter-spacing:0.04em;">${escapeHtml(temporaryPassword)}</p>
      <p><a href="${safeLoginUrl}">${safeLoginUrl}</a></p>
      <p>Please change your password after your first login.</p>
      <p>If you did not expect this email, please contact your administrator.</p>
    `,
  });
}

  /**
   * Send verification email for pending email-change requests.
   */
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

/**
 * Send a simple single-message notification email.
 */
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
  sendWelcomeCredentialsEmail,
  sendEmailChangeVerification,
  sendSimpleNotification,
};
