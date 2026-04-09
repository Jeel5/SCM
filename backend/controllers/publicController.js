import { asyncHandler, AppError } from '../errors/index.js';
import userRepo from '../repositories/UserRepository.js';
import emailService from '../services/emailService.js';

function normalizeRecipients(values) {
  return Array.from(new Set(values
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .map((value) => value.toLowerCase())))
    .map((email) => values.find((value) => String(value || '').trim().toLowerCase() === email) || email);
}

async function getSuperadminRecipients() {
  const superadmins = await userRepo.findByRole('superadmin');
  const dbRecipients = (superadmins || [])
    .filter((user) => user?.email)
    .map((user) => user.email);

  const envRecipients = String(process.env.SUPERADMIN_LEAD_EMAILS || process.env.SUPERADMIN_LEAD_EMAIL || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return normalizeRecipients([...dbRecipients, ...envRecipients]);
}

async function sendInquiryNotifications(type, recipients, payload) {
  await Promise.all(recipients.map((to) => emailService.sendPublicInquiryEmail({
    to,
    requestType: type,
    ...payload,
  })));
}

export const requestDemo = asyncHandler(async (req, res) => {
  const { firstName, lastName, workEmail, company, message } = req.body;
  const recipients = await getSuperadminRecipients();

  if (!recipients.length) {
    throw new AppError('Superadmin notification email is not configured', 503);
  }

  emailService.dispatchInBackground('public-request-demo-email', async () => {
    await sendInquiryNotifications('demo', recipients, {
      firstName,
      lastName,
      workEmail,
      company,
      message,
      inquiry: 'Request a Demo',
      pageUrl: req.body.pageUrl || req.headers.referer || null,
    });
  });

  res.status(202).json({
    success: true,
    message: 'Demo request received. Our team will contact you shortly.',
  });
});

export const contactMessage = asyncHandler(async (req, res) => {
  const { firstName, lastName, workEmail, company, inquiry, message } = req.body;
  const recipients = await getSuperadminRecipients();

  if (!recipients.length) {
    throw new AppError('Superadmin notification email is not configured', 503);
  }

  emailService.dispatchInBackground('public-contact-message-email', async () => {
    await sendInquiryNotifications('contact', recipients, {
      firstName,
      lastName,
      workEmail,
      company,
      message,
      inquiry: inquiry || 'Contact message',
      pageUrl: req.body.pageUrl || req.headers.referer || null,
    });
  });

  res.status(202).json({
    success: true,
    message: 'Message received. We will get back to you soon.',
  });
});