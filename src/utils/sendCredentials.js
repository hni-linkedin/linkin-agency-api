const nodemailer = require('nodemailer');
const logger = require('./logger');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST || !process.env.SMTP_PORT || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
}

async function sendCredentialsEmail({ to, role, email, password }) {
  const tx = getTransporter();
  if (!tx) {
    logger.warn('SMTP not configured. Skipping credentials email.', { to, role });
    return;
  }

  const subject = `Your LinkinAgency ${role} account`;
  const html = `
    <p>Your account has been created on LinkinAgency.</p>
    <p><b>Email:</b> ${email}</p>
    <p><b>Temporary Password:</b> ${password}</p>
    <p>You will be asked to set a new password on first login.</p>
  `;

  await tx.sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to,
    subject,
    html,
  });
}

module.exports = { sendCredentialsEmail };
