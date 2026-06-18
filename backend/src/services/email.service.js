const nodemailer = require('nodemailer');
const { getConfig } = require('../config/env');
const logger = require('../utils/logger');

let transporter = null;

/**
 * Lazily builds the nodemailer transport.
 * - If SMTP_URL is configured, mail is delivered through that SMTP server.
 * - Otherwise the built-in JSON transport is used (no network, no
 *   credentials) so the notification feature works out of the box in
 *   development / CI — the message is logged instead of delivered.
 */
const getTransporter = () => {
  if (!transporter) {
    const config = getConfig();
    if (config.smtpUrl) {
      transporter = nodemailer.createTransport(config.smtpUrl);
    } else if (config.isProduction) {
      // The JSON transport reports success but delivers nothing. Silently
      // "succeeding" in production would mean notifications are never sent
      // and nobody notices — fail loudly instead.
      throw new Error('SMTP_URL is required in production: refusing to use the no-op JSON mail transport');
    } else {
      // Dev/CI: log-only transport so the feature works without credentials.
      transporter = nodemailer.createTransport({ jsonTransport: true });
    }
  }
  return transporter;
};

/**
 * Sends an email and resolves with nodemailer's info object.
 * Throws on transport failure so the caller (the worker) can retry.
 */
const sendEmail = async ({ to, subject, text, html }) => {
  const config = getConfig();
  const info = await getTransporter().sendMail({
    from: config.emailFrom,
    to,
    subject,
    text,
    html,
  });
  logger.info('Email sent', { to, subject, messageId: info.messageId });
  return info;
};

/** Resets the cached transport (used in tests). */
const resetTransporter = () => {
  transporter = null;
};

module.exports = { sendEmail, getTransporter, resetTransporter };
