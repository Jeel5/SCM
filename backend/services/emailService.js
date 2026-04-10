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
    pool: true,
    maxConnections: parseInt(process.env.SMTP_MAX_CONNECTIONS || '5', 10),
    maxMessages: parseInt(process.env.SMTP_MAX_MESSAGES || '100', 10),
    auth: { user, pass },
  });
}

const transport = createTransport();

/**
 * Send a raw email payload and log metadata.
 */
async function send({ to, subject, html, text, replyTo = null }) {
  const from = process.env.SMTP_FROM;
  const info = await transport.sendMail({ from, to, subject, text, html, replyTo: replyTo || undefined });
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

function getLoginUrl(explicitUrl) {
  return explicitUrl || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`;
}

function renderEmailLayout({
  preheader,
  title,
  greeting,
  bodyHtml,
  ctaLabel,
  ctaUrl,
  footerNote,
}) {
  const safePreheader = escapeHtml(preheader || 'Important update from TwinChain');
  const safeTitle = escapeHtml(title || 'TwinChain Notification');
  const safeGreeting = escapeHtml(greeting || 'Hi there,');
  const safeFooter = escapeHtml(footerNote || 'This is an automated message from TwinChain SCM.');
  const safeCtaLabel = escapeHtml(ctaLabel || 'Open TwinChain');
  const safeCtaUrl = ctaUrl ? escapeHtml(ctaUrl) : null;

  return `
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${safePreheader}</div>
    <div style="background:#f4f7fb;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#111827;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="background:#0f172a;color:#ffffff;padding:20px 24px;">
            <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.9;">TwinChain SCM</div>
            <div style="font-size:22px;font-weight:700;margin-top:6px;">${safeTitle}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:24px;line-height:1.6;">
            <p style="margin:0 0 14px 0;">${safeGreeting}</p>
            ${bodyHtml}
            ${safeCtaUrl ? `
              <div style="margin:20px 0 8px 0;">
                <a href="${safeCtaUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;padding:10px 16px;border-radius:8px;">${safeCtaLabel}</a>
              </div>
              <p style="font-size:12px;color:#6b7280;margin:8px 0 0 0;">If the button does not work, use this link: ${safeCtaUrl}</p>
            ` : ''}
          </td>
        </tr>
        <tr>
          <td style="padding:14px 24px;border-top:1px solid #e5e7eb;background:#f9fafb;font-size:12px;color:#6b7280;">
            ${safeFooter}
          </td>
        </tr>
      </table>
    </div>
  `;
}

/**
 * Send onboarding credentials for newly created users.
 */
async function sendWelcomeCredentialsEmail({ to, name, organizationName, role, temporaryPassword, loginUrl }) {
  const safeName = escapeHtml(name || 'there');
  const safeOrganizationName = escapeHtml(organizationName || 'TwinChain');
  const safeRole = escapeHtml(role || 'user');
  const effectiveLoginUrl = getLoginUrl(loginUrl);
  const safePassword = escapeHtml(temporaryPassword);

  const bodyHtml = `
    <p style="margin:0 0 12px 0;">Welcome to <strong>${safeOrganizationName}</strong>. Your account has been created with the role <strong>${safeRole}</strong>.</p>
    <p style="margin:0 0 8px 0;">Use the temporary password below to sign in:</p>
    <div style="background:#f3f4f6;border:1px dashed #9ca3af;border-radius:8px;padding:12px;font-family:Consolas,Monaco,monospace;font-size:16px;font-weight:700;letter-spacing:0.04em;display:inline-block;">${safePassword}</div>
    <p style="margin:14px 0 0 0;">For security, please change this password immediately after your first login.</p>
  `;

  return send({
    to,
    subject: `Welcome to ${organizationName || 'TwinChain'}`,
    text: [
      `Hi ${name || 'there'},`,
      '',
      `Welcome to ${organizationName || 'TwinChain'} as ${role || 'user'}.`,
      `Your temporary password is: ${temporaryPassword}`,
      '',
      `Log in here: ${effectiveLoginUrl}`,
      'Please change your password after your first login.',
      '',
      'If you did not expect this email, please contact your administrator.',
    ].join('\n'),
    html: renderEmailLayout({
      preheader: `Welcome to ${organizationName || 'TwinChain'}`,
      title: 'Welcome to TwinChain',
      greeting: `Hi ${safeName},`,
      bodyHtml,
      ctaLabel: 'Sign In to TwinChain',
      ctaUrl: effectiveLoginUrl,
      footerNote: 'If you did not expect this account, contact your administrator.',
    }),
  });
}

/**
 * Send customized onboarding email when superadmin registers a new organization
 * and its first admin user.
 */
async function sendOrganizationAdminOnboardingEmail({ to, name, organizationName, temporaryPassword, loginUrl }) {
  const safeName = escapeHtml(name || 'there');
  const safeOrganizationName = escapeHtml(organizationName || 'your company');
  const effectiveLoginUrl = getLoginUrl(loginUrl);
  const safePassword = escapeHtml(temporaryPassword);

  const bodyHtml = `
    <p style="margin:0 0 12px 0;">Great news. Your company <strong>${safeOrganizationName}</strong> has been successfully registered on TwinChain SCM.</p>
    <p style="margin:0 0 12px 0;">Your admin account is now active. Use the credentials below to log in and complete setup.</p>
    <p style="margin:0 0 8px 0;"><strong>Username:</strong> ${escapeHtml(to)}</p>
    <p style="margin:0 0 8px 0;"><strong>Temporary password:</strong></p>
    <div style="background:#f3f4f6;border:1px dashed #9ca3af;border-radius:8px;padding:12px;font-family:Consolas,Monaco,monospace;font-size:16px;font-weight:700;letter-spacing:0.04em;display:inline-block;">${safePassword}</div>
    <p style="margin:14px 0 0 0;">Please change your password immediately after first login for security.</p>
  `;

  return send({
    to,
    subject: `${organizationName || 'Your company'} is now registered on TwinChain`,
    text: [
      `Hi ${name || 'there'},`,
      '',
      `Your company ${organizationName || ''} is successfully registered on TwinChain SCM.`,
      'Your admin account is now active.',
      `Username: ${to}`,
      `Temporary password: ${temporaryPassword}`,
      '',
      `Login here: ${effectiveLoginUrl}`,
      'Please change your password immediately after first login.',
    ].join('\n'),
    html: renderEmailLayout({
      preheader: 'Your company has been registered',
      title: 'Company Registration Complete',
      greeting: `Hi ${safeName},`,
      bodyHtml,
      ctaLabel: 'Login to TwinChain',
      ctaUrl: effectiveLoginUrl,
      footerNote: 'If you did not expect this email, contact TwinChain support immediately.',
    }),
  });
}

  /**
   * Send verification email for pending email-change requests.
   */
async function sendEmailChangeVerification({ to, name, verifyUrl }) {
  const safeName = escapeHtml(name || 'there');
  const effectiveVerifyUrl = verifyUrl;

  const bodyHtml = `
    <p style="margin:0 0 12px 0;">We received a request to change the email address on your TwinChain account.</p>
    <p style="margin:0;">Please confirm this change to continue.</p>
  `;

  return send({
    to,
    subject: 'Confirm your new email address',
    text: [
      `Hi ${name || 'there'},`,
      '',
      'We received a request to change your email address.',
      `Verify here: ${effectiveVerifyUrl}`,
      '',
      'If you did not request this change, ignore this email.',
    ].join('\n'),
    html: renderEmailLayout({
      preheader: 'Confirm your new email address',
      title: 'Email Verification Required',
      greeting: `Hi ${safeName},`,
      bodyHtml,
      ctaLabel: 'Verify Email Address',
      ctaUrl: effectiveVerifyUrl,
      footerNote: 'If this was not you, no further action is required.',
    }),
  });
}

/**
 * Send a simple single-message notification email.
 */
async function sendSimpleNotification({ to, subject, message }) {
  const safeMessageHtml = String(message || '')
    .split(/\r?\n/)
    .map((line) => `<p style="margin:0 0 10px 0;">${escapeHtml(line)}</p>`)
    .join('');

  return send({
    to,
    subject,
    text: message,
    html: renderEmailLayout({
      preheader: subject || 'TwinChain notification',
      title: subject || 'Notification',
      greeting: 'Hello,',
      bodyHtml: safeMessageHtml,
      footerNote: 'You are receiving this because notifications are enabled for your account.',
    }),
  });
}

/**
 * Send a customized lead notification to superadmins when someone requests a demo
 * or submits a contact message from the public site.
 */
async function sendPublicInquiryEmail({
  to,
  requestType,
  firstName,
  lastName,
  workEmail,
  company,
  inquiry = null,
  message,
  pageUrl = null,
}) {
  const safeFirstName = escapeHtml(firstName || 'there');
  const safeLastName = escapeHtml(lastName || '');
  const safeCompany = escapeHtml(company || 'Unknown company');
  const safeInquiry = inquiry ? escapeHtml(inquiry) : null;
  const safeMessage = escapeHtml(message || '');
  const safePageUrl = pageUrl ? escapeHtml(pageUrl) : null;
  const leadLabel = requestType === 'demo' ? 'Demo Request' : 'Contact Message';
  const leadSubject = requestType === 'demo'
    ? `New demo request from ${company || workEmail || 'website visitor'}`
    : `New contact message from ${company || workEmail || 'website visitor'}`;

  const bodyHtml = `
    <p style="margin:0 0 12px 0;">A new <strong>${leadLabel}</strong> was submitted from the public website.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin:12px 0 16px 0;">
      <tr>
        <td style="padding:10px 12px;background:#f9fafb;border-bottom:1px solid #e5e7eb;width:180px;"><strong>Name</strong></td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${safeFirstName} ${safeLastName}</td>
      </tr>
      <tr>
        <td style="padding:10px 12px;background:#f9fafb;border-bottom:1px solid #e5e7eb;"><strong>Email</strong></td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(workEmail || 'Not provided')}</td>
      </tr>
      <tr>
        <td style="padding:10px 12px;background:#f9fafb;border-bottom:1px solid #e5e7eb;"><strong>Company</strong></td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${safeCompany}</td>
      </tr>
      ${safeInquiry ? `
      <tr>
        <td style="padding:10px 12px;background:#f9fafb;border-bottom:1px solid #e5e7eb;"><strong>Inquiry Type</strong></td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${safeInquiry}</td>
      </tr>` : ''}
      <tr>
        <td style="padding:10px 12px;background:#f9fafb;vertical-align:top;"><strong>Message</strong></td>
        <td style="padding:10px 12px;white-space:pre-wrap;">${safeMessage || 'No message provided'}</td>
      </tr>
    </table>
    ${safePageUrl ? `<p style="margin:0 0 10px 0;"><strong>Source page:</strong> ${safePageUrl}</p>` : ''}
    <p style="margin:0;">Reply to this email to contact the requester directly.</p>
  `;

  return send({
    to,
    subject: leadSubject,
    replyTo: workEmail || undefined,
    text: [
      `New ${leadLabel} received from the public website.`,
      '',
      `Name: ${firstName || ''} ${lastName || ''}`.trim(),
      `Email: ${workEmail || 'Not provided'}`,
      `Company: ${company || 'Unknown company'}`,
      inquiry ? `Inquiry Type: ${inquiry}` : null,
      '',
      'Message:',
      message || 'No message provided',
      pageUrl ? `\nSource page: ${pageUrl}` : null,
    ].filter(Boolean).join('\n'),
    html: renderEmailLayout({
      preheader: `${leadLabel} received from the public website`,
      title: leadLabel,
      greeting: 'Hi superadmin,',
      bodyHtml,
      footerNote: 'This lead was captured from the TwinChain public website.',
    }),
  });
}

/**
 * Send organization account-status email for suspend/reactivate/deactivate actions.
 */
async function sendOrganizationStatusUpdateEmail({
  to,
  name,
  organizationName,
  status,
  reason,
  loginUrl,
}) {
  const safeName = escapeHtml(name || 'there');
  const safeOrgName = escapeHtml(organizationName || 'your organization');
  const safeReason = reason ? escapeHtml(reason) : null;
  const effectiveLoginUrl = getLoginUrl(loginUrl);

  const statusConfig = {
    suspended: {
      subject: `Access suspended for ${organizationName || 'your organization'}`,
      title: 'Organization Suspended',
      preheader: 'Your organization access has been suspended',
      textLines: [
        `Your organization ${organizationName || ''} has been suspended.`,
        reason ? `Reason: ${reason}` : null,
        'Please contact your superadmin or support for assistance.',
      ],
      bodyHtml: `
        <p style="margin:0 0 12px 0;">Your organization <strong>${safeOrgName}</strong> has been suspended.</p>
        ${safeReason ? `<p style="margin:0 0 12px 0;"><strong>Reason:</strong> ${safeReason}</p>` : ''}
        <p style="margin:0;">Please contact your superadmin or support for next steps.</p>
      `,
      ctaLabel: null,
      ctaUrl: null,
    },
    reactivated: {
      subject: `${organizationName || 'Your organization'} is active again`,
      title: 'Organization Reactivated',
      preheader: 'Your organization access has been restored',
      textLines: [
        `Your organization ${organizationName || ''} has been reactivated.`,
        `Login here: ${effectiveLoginUrl}`,
      ],
      bodyHtml: `
        <p style="margin:0 0 12px 0;">Good news. Your organization <strong>${safeOrgName}</strong> is active again.</p>
        <p style="margin:0;">You can now sign in and continue using TwinChain SCM.</p>
      `,
      ctaLabel: 'Login to TwinChain',
      ctaUrl: effectiveLoginUrl,
    },
    deactivated: {
      subject: `${organizationName || 'Your organization'} has been deactivated`,
      title: 'Organization Deactivated',
      preheader: 'Your organization has been deactivated',
      textLines: [
        `Your organization ${organizationName || ''} has been deactivated by a superadmin.`,
        'Access is currently disabled. Please contact support if this seems incorrect.',
      ],
      bodyHtml: `
        <p style="margin:0 0 12px 0;">Your organization <strong>${safeOrgName}</strong> has been deactivated by a superadmin.</p>
        <p style="margin:0;">Access is currently disabled. Please contact support if this seems incorrect.</p>
      `,
      ctaLabel: null,
      ctaUrl: null,
    },
  };

  const selected = statusConfig[status] || statusConfig.deactivated;

  return send({
    to,
    subject: selected.subject,
    text: [
      `Hi ${name || 'there'},`,
      '',
      ...selected.textLines.filter(Boolean),
    ].join('\n'),
    html: renderEmailLayout({
      preheader: selected.preheader,
      title: selected.title,
      greeting: `Hi ${safeName},`,
      bodyHtml: selected.bodyHtml,
      ctaLabel: selected.ctaLabel,
      ctaUrl: selected.ctaUrl,
      footerNote: 'This is an account status update from TwinChain SCM.',
    }),
  });
}

/**
 * Send account update email for org users (role/status changes).
 */
async function sendUserAccountUpdateEmail({
  to,
  name,
  organizationName,
  roleChangedTo = null,
  accountStatus = null,
  loginUrl,
}) {
  const safeName = escapeHtml(name || 'there');
  const safeOrgName = escapeHtml(organizationName || 'your organization');
  const safeRole = roleChangedTo ? escapeHtml(roleChangedTo) : null;
  const effectiveLoginUrl = getLoginUrl(loginUrl);

  const updates = [];
  const textLines = [];

  if (safeRole) {
    updates.push(`<p style="margin:0 0 10px 0;">Your role has been updated to <strong>${safeRole}</strong>.</p>`);
    textLines.push(`Your role has been updated to ${roleChangedTo}.`);
  }

  if (accountStatus === 'reactivated') {
    updates.push('<p style="margin:0 0 10px 0;">Your account has been reactivated and you can sign in again.</p>');
    textLines.push('Your account has been reactivated. You can sign in again.');
  } else if (accountStatus === 'deactivated') {
    updates.push('<p style="margin:0 0 10px 0;">Your account has been deactivated. Please contact your administrator for access.</p>');
    textLines.push('Your account has been deactivated. Please contact your administrator for access.');
  }

  if (updates.length === 0) {
    updates.push('<p style="margin:0;">Your account settings were updated by an administrator.</p>');
    textLines.push('Your account settings were updated by an administrator.');
  }

  const canLogin = accountStatus !== 'deactivated';

  return send({
    to,
    subject: 'Your account has been updated',
    text: [
      `Hi ${name || 'there'},`,
      '',
      `Your account in ${organizationName || 'your organization'} has been updated.`,
      ...textLines,
      ...(canLogin ? ['', `Login here: ${effectiveLoginUrl}`] : []),
    ].join('\n'),
    html: renderEmailLayout({
      preheader: 'Your account settings were updated',
      title: 'Account Update',
      greeting: `Hi ${safeName},`,
      bodyHtml: `
        <p style="margin:0 0 12px 0;">Your account in <strong>${safeOrgName}</strong> has been updated.</p>
        ${updates.join('')}
      `,
      ctaLabel: canLogin ? 'Login to TwinChain' : null,
      ctaUrl: canLogin ? effectiveLoginUrl : null,
      footerNote: 'If you did not expect this change, contact your administrator.',
    }),
  });
}

/**
 * Send pickup reminder email for pending returns.
 */
async function sendReturnPickupReminderEmail({ to, name, rmaNumber, pickupWindow = null, returnsUrl = null }) {
  const safeName = escapeHtml(name || 'there');
  const safeRma = escapeHtml(rmaNumber || 'your return');
  const effectiveReturnsUrl = returnsUrl || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/returns`;

  return send({
    to,
    subject: `Pickup reminder for return ${rmaNumber || ''}`.trim(),
    text: [
      `Hi ${name || 'there'},`,
      '',
      `This is a reminder that return ${rmaNumber || ''} is scheduled for pickup soon.`,
      pickupWindow ? `Pickup window: ${pickupWindow}` : null,
      'Please keep the package ready and handed over to the pickup agent.',
      '',
      `Track returns here: ${effectiveReturnsUrl}`,
    ].filter(Boolean).join('\n'),
    html: renderEmailLayout({
      preheader: 'Your return pickup is scheduled soon',
      title: 'Return Pickup Reminder',
      greeting: `Hi ${safeName},`,
      bodyHtml: `
        <p style="margin:0 0 12px 0;">This is a reminder that return <strong>${safeRma}</strong> is scheduled for pickup soon.</p>
        ${pickupWindow ? `<p style="margin:0 0 12px 0;"><strong>Pickup window:</strong> ${escapeHtml(pickupWindow)}</p>` : ''}
        <p style="margin:0;">Please keep the package ready for handover.</p>
      `,
      ctaLabel: 'Open Returns',
      ctaUrl: effectiveReturnsUrl,
      footerNote: 'You are receiving this reminder because return notifications are enabled.',
    }),
  });
}

/**
 * Run an email task without blocking the request lifecycle.
 */
function dispatchInBackground(taskName, task) {
  setImmediate(async () => {
    try {
      await task();
    } catch (error) {
      logger.error('Background email task failed', {
        taskName,
        error,
      });
    }
  });
}

export default {
  send,
  sendWelcomeCredentialsEmail,
  sendOrganizationAdminOnboardingEmail,
  sendEmailChangeVerification,
  sendSimpleNotification,
  sendPublicInquiryEmail,
  sendOrganizationStatusUpdateEmail,
  sendUserAccountUpdateEmail,
  sendReturnPickupReminderEmail,
  dispatchInBackground,
};
