const nodemailer = require('nodemailer');

async function sendPasswordReset(toEmail, resetUrl) {
  // No email host configured — log to console (development fallback)
  if (!process.env.EMAIL_HOST) {
    console.log(`\n[Password Reset] Link for ${toEmail}:\n${resetUrl}\n`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'The Farm Gate <noreply@thefarmgate.co.uk>',
    to: toEmail,
    subject: 'Reset your Farm Gate password',
    text: `You requested a password reset.\n\nClick the link below to set a new password. This link expires in 1 hour.\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: `
      <p>You requested a password reset.</p>
      <p>Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
      <p>
        <a href="${resetUrl}"
           style="display:inline-block;padding:12px 24px;background:#1f4f29;color:#fff;border-radius:6px;text-decoration:none;">
          Reset Password
        </a>
      </p>
      <p>If you did not request this, you can ignore this email.</p>
    `,
  });
}

module.exports = { sendPasswordReset };
